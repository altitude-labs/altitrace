use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use crate::{
    handlers::validation::{
        validate_address, validate_block_number_or_tag, validate_hex_string, validate_uint256,
    },
    types::{shared::StateOverride, BlockOverrides},
    utils::default_true,
};

/// Represents a complete simulation request for transaction execution.
///
/// This structure encapsulates all parameters needed to simulate a transaction
/// on the `HyperEVM` network, including the transaction details, block context,
/// simulation options, and any state or block overrides.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SimulationRequest {
    /// The transaction parameters to simulate.
    #[validate(nested)]
    pub params: SimulationParams,

    /// Optional simulation-specific options.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub options: Option<SimulationOptions>,
}

impl SimulationRequest {
    /// Total number of transaction calls in the simulation.
    pub const fn call_count(&self) -> usize {
        self.params.calls.len()
    }
}

/// Batch simulation request for multiple independent transactions.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BatchSimulationRequest {
    /// Array of independent simulation requests.
    #[validate(length(min = 1, max = 10, message = "Batch must contain 1-10 simulations"))]
    #[validate(nested)]
    pub simulations: Vec<SimulationRequest>,

    /// Common options applied to all simulations.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub common_options: Option<SimulationOptions>,
}

/// Bundle simulation request for interdependent transactions.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BundleSimulationRequest {
    /// Array of transactions to execute sequentially.
    #[validate(length(min = 1, max = 10, message = "Bundle must contain 1-10 transactions"))]
    #[validate(nested)]
    pub bundle: Vec<BundleTransaction>,

    /// Block number to simulate against (hex encoded).
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_block_number_or_tag"))]
    pub block_number: Option<String>,

    /// Block tag to use for simulation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_tag: Option<BlockTag>,

    /// State overrides applied to the entire bundle.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(nested)]
    pub state_overrides: Option<Vec<StateOverride>>,

    /// Block parameter overrides.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(nested)]
    pub block_overrides: Option<BlockOverrides>,

    /// Enable asset change tracking.
    #[serde(default)]
    pub trace_asset_changes: bool,

    /// Enable transfer tracing.
    #[serde(default)]
    pub trace_transfers: bool,

    /// Enable detailed performance profiling.
    #[serde(default)]
    pub enable_profiling: bool,
}

/// Individual transaction within a bundle.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BundleTransaction {
    /// Transaction calls for this bundle entry.
    #[validate(length(min = 1, message = "At least one call is required"))]
    #[validate(nested)]
    pub calls: Vec<TransactionCall>,

    /// Account to execute from.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_address"))]
    pub account: Option<String>,

    /// Gas limit override for this transaction.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_uint256"))]
    pub gas_limit: Option<String>,

    /// Whether this transaction can fail without stopping the bundle.
    #[serde(default)]
    pub allow_failure: bool,
}

/// Gas estimation request.
#[derive(Debug, Clone, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GasEstimationRequest {
    /// The recipient address of the transaction.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_address"))]
    pub to: Option<String>,

    /// The sender address of the transaction.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_address"))]
    pub from: Option<String>,

    /// The transaction data (calldata).
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_hex_string"))]
    pub data: Option<String>,

    /// The value to send with the transaction in wei (hex encoded).
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_uint256"))]
    pub value: Option<String>,

    /// Optimization level for gas estimation.
    #[serde(default)]
    pub optimization_level: OptimizationLevel,

    /// Include alternative implementation suggestions.
    #[serde(default)]
    pub include_alternatives: bool,
}

/// Gas optimization levels.
#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum OptimizationLevel {
    /// No optimization suggestions.
    None,
    /// Standard optimization suggestions.
    #[default]
    Standard,
    /// Aggressive optimization suggestions.
    Aggressive,
}

/// Core simulation parameters including transaction calls and context.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SimulationParams {
    /// Array of transaction calls to simulate.
    /// Each call represents a transaction that will be executed in the simulation.
    #[validate(length(min = 1, message = "At least one call is required"))]
    #[validate(nested)]
    pub calls: Vec<TransactionCall>,

    /// Optional account address for tracking asset changes.
    /// Required when `traceAssetChanges` or `traceTransfers` is enabled.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_address"))]
    #[schema(
        example = "0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c",
        pattern = "^0x[a-fA-F0-9]{40}$"
    )]
    pub account: Option<String>,

    /// Block number to simulate against (hex encoded).
    /// This will be the PARENT block for the simulation.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_block_number_or_tag"))]
    #[schema(example = "0x123abc", pattern = "^0x[a-fA-F0-9]+$")]
    pub block_number: Option<String>,

    /// Block tag to use as the parent for simulation.
    /// Mutually exclusive with `block_number`.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "latest")]
    pub block_tag: Option<BlockTag>,

    /// Enable or disable EVM validation during simulation.
    /// When false, behaves like `eth_call` with relaxed validation.
    #[serde(default = "default_true")]
    #[schema(example = true)]
    pub validation: bool,

    /// Enable tracking of ERC-20/ERC-721 token balance changes.
    /// Requires `account` parameter to be set.
    #[serde(default)]
    #[schema(example = false)]
    pub trace_asset_changes: bool,

    /// Enable tracking of ETH transfers as ERC-20-like logs.
    /// ETH transfers will appear with address 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.
    /// Requires `account` parameter to be set.
    #[serde(default)]
    #[schema(example = false)]
    pub trace_transfers: bool,
}

/// Represents a single transaction call within a simulation.
#[derive(Debug, Clone, Deserialize, Serialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TransactionCall {
    /// The sender address of the transaction.
    /// If not specified, the zero address will be used.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_address"))]
    #[schema(
        example = "0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c",
        pattern = "^0x[a-fA-F0-9]{40}$"
    )]
    pub from: Option<String>,

    /// The recipient address of the transaction.
    /// For contract creation, this should be None/null.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_address"))]
    #[schema(
        example = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        pattern = "^0x[a-fA-F0-9]{40}$"
    )]
    pub to: Option<String>,

    /// The transaction data (calldata).
    /// For simple ETH transfers, this can be empty or "0x".
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_hex_string"))]
    #[schema(example = "0xa9059cbb000000000000000000000000", pattern = "^0x[a-fA-F0-9]*$")]
    pub data: Option<String>,

    /// The value to send with the transaction in wei (hex encoded).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_uint256"))]
    #[schema(example = "0x0", pattern = "^0x[a-fA-F0-9]*$")]
    pub value: Option<String>,

    /// Gas limit for the transaction (hex encoded).
    /// If not specified, it will be estimated automatically.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_uint256"))]
    #[schema(example = "0x7a120", pattern = "^0x[a-fA-F0-9]*$")]
    pub gas: Option<String>,
}

/// Optional parameters for simulation behavior and output.
#[derive(Debug, Clone, Default, Deserialize, Serialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SimulationOptions {
    /// State overrides to apply during simulation.
    /// Allows modifying account states before execution.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(nested)]
    pub state_overrides: Option<Vec<StateOverride>>,

    /// Block environment overrides.
    /// Allows modifying block parameters like timestamp, number, etc.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(nested)]
    pub block_overrides: Option<BlockOverrides>,
}

/// Block tag options for specifying block context.
#[derive(Debug, Clone, Copy, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
#[schema(example = "latest")]
pub enum BlockTag {
    /// The latest mined block.
    Latest,
    /// The earliest/genesis block.
    Earliest,
    /// The latest safe block (for chains with finality).
    Safe,
    /// The latest finalized block.
    Finalized,
}

impl SimulationParams {
    /// Validates that `account` is provided when asset tracking is enabled.
    pub const fn validate_account_requirement(&self) -> Result<(), &'static str> {
        if (self.trace_asset_changes || self.trace_transfers) && self.account.is_none() {
            return Err(
                "Account parameter is required when traceAssetChanges or traceTransfers is enabled"
            );
        }
        Ok(())
    }

    /// Validates that `block_number` and `block_tag` are mutually exclusive.
    pub const fn validate_block_exclusivity(&self) -> Result<(), &'static str> {
        if self.block_number.is_some() && self.block_tag.is_some() {
            return Err(
                "Cannot specify both 'blockNumber' and 'blockTag' - they are mutually exclusive"
            );
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_state_override_validation() {
        let mut override_state = StateOverride {
            address: Some("0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c".to_string()),
            balance: None,
            nonce: None,
            code: None,
            storage: Some(HashMap::new()),
            state: Some(vec![]),
            state_diff: Some(HashMap::new()),
            move_precompile_to_address: None,
        };

        assert!(override_state.validate_state_exclusivity().is_err());

        override_state.state_diff = None;
        assert!(override_state.validate_state_exclusivity().is_ok());
    }
}
