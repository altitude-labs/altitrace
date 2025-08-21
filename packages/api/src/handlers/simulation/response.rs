use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Complete simulation result containing all execution details.
///
/// This is the main response structure for transaction simulation,
/// containing execution status, gas usage, logs, traces, and any errors.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SimulationResult {
    /// Unique identifier for this simulation.
    pub simulation_id: String,

    /// The final block number after simulation (higher than input if new blocks created).
    #[schema(example = "0x123abd", pattern = "^0x[a-fA-F0-9]+$")]
    pub block_number: String,

    /// Overall simulation execution status.
    #[schema(example = "success")]
    pub status: SimulationStatus,

    /// Results for each transaction call in the simulation.
    pub calls: Vec<CallResult>,

    /// Total gas consumed by all calls.
    #[schema(example = "0x5208", pattern = "^0x[a-fA-F0-9]+$")]
    pub gas_used: String,

    /// Total gas used in the simulated block.
    #[schema(example = "0x5208", pattern = "^0x[a-fA-F0-9]+$")]
    pub block_gas_used: String,

    /// Token balance changes (if tracing enabled).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_changes: Option<Vec<AssetChange>>,
}

/// Execution status for the overall simulation.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
#[schema(example = "success")]
pub enum SimulationStatus {
    /// All calls executed successfully.
    Success,
    /// One or more calls reverted.
    Reverted,
    /// Simulation failed due to error.
    Failed,
}

/// Result of a single transaction call within the simulation.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CallResult {
    /// Index of this call within the simulation.
    pub call_index: u32,

    /// Execution status of this specific call.
    #[schema(example = "success")]
    pub status: CallStatus,

    /// Data returned by the call (hex encoded).
    #[schema(
        example = "0x0000000000000000000000000000000000000000000000000000000000000001",
        pattern = "^0x[a-fA-F0-9]*$"
    )]
    pub return_data: String,

    /// Gas consumed by this call.
    #[schema(example = "0x5208", pattern = "^0x[a-fA-F0-9]+$")]
    pub gas_used: String,

    /// Event logs emitted by this call.
    pub logs: Vec<EnhancedLog>,

    /// Error details (present if call failed or reverted).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<CallError>,
}

/// Execution status for individual calls.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
#[schema(example = "success")]
pub enum CallStatus {
    /// Call executed successfully.
    Success,
    /// Call reverted (with or without reason).
    Reverted,
}

/// Event log with optional decoded information for better readability.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EnhancedLog {
    /// Contract address that emitted this log.
    #[schema(
        example = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        pattern = "^0x[a-fA-F0-9]{40}$"
    )]
    pub address: String,

    /// Block hash containing this log (null for simulations).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_hash: Option<String>,

    /// Block number containing this log.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_number: Option<String>,

    /// Raw log data (hex encoded).
    #[schema(example = "0x00000000000000000000000000000000000000000000000000000000000f4240")]
    pub data: String,

    /// Log index within the transaction.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_index: Option<String>,

    /// Transaction hash that created this log (null for simulations).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_hash: Option<String>,

    /// Transaction index within the block (null for simulations).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_index: Option<String>,

    /// Array of indexed log topics.
    pub topics: Vec<String>,

    /// Whether this log was removed due to chain reorganization.
    pub removed: bool,

    /// Human-readable decoded event information (if available).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decoded: Option<DecodedEvent>,
}

/// Human-readable event information decoded from log data.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DecodedEvent {
    /// Event name (e.g., "Transfer", "Approval").
    #[schema(example = "Transfer")]
    pub name: String,

    /// Event signature with types.
    #[schema(example = "Transfer(address,address,uint256)")]
    pub signature: String,

    /// Token/protocol standard (e.g., "ERC20", "ERC721", "Uniswap V2").
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "ERC20")]
    pub standard: Option<String>,

    /// Human-readable description of the event.
    #[schema(example = "Token transfer event")]
    pub description: String,

    /// Decoded event parameters with names and formatted values.
    pub params: Vec<DecodedEventParam>,

    /// One-line human-readable summary.
    #[schema(example = "Transfer 1000.0 USDC from 0x742d... to 0xabc1...")]
    pub summary: String,
}

/// Individual parameter from a decoded event.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DecodedEventParam {
    /// Parameter name from the ABI.
    #[schema(example = "from")]
    pub name: String,

    /// Parameter type (e.g., "address", "uint256", "bool").
    #[schema(example = "address")]
    pub param_type: String,

    /// Formatted parameter value.
    #[schema(example = "0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c")]
    pub value: String,

    /// Whether this parameter was indexed in the event.
    pub indexed: bool,
}

/// Token balance change information.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AssetChange {
    /// Token contract information.
    pub token: TokenInfo,

    /// Balance change details.
    pub value: BalanceChange,
}

/// Token contract information.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TokenInfo {
    /// Token contract address.
    #[schema(
        example = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        pattern = "^0x[a-fA-F0-9]{40}$"
    )]
    pub address: String,

    /// Number of decimal places (if available).
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = 6)]
    pub decimals: Option<u8>,

    /// Token symbol (if available).
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "USDC")]
    pub symbol: Option<String>,
}

/// Balance change information showing before/after/difference.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BalanceChange {
    /// Balance before simulation (hex encoded, smallest unit).
    #[schema(example = "0xf4240", pattern = "^0x[a-fA-F0-9]*$")]
    pub pre: String,

    /// Balance after simulation (hex encoded, smallest unit).
    #[schema(example = "0x1e8480", pattern = "^0x[a-fA-F0-9]*$")]
    pub post: String,

    /// Net change (post - pre, hex encoded).
    /// Positive means gained, negative means lost.
    #[schema(example = "0xf4240", pattern = "^0x[a-fA-F0-9]*$")]
    pub diff: String,
}

/// Detailed error information for failed or reverted calls.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CallError {
    /// Human-readable error reason.
    #[schema(example = "Insufficient balance")]
    pub reason: String,

    /// Error type classification.
    #[schema(example = "execution-reverted")]
    pub error_type: String,

    /// Detailed error message with context.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,

    /// Contract address where the error occurred.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contract_address: Option<String>,
}

/// Storage operation gas usage breakdown.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StorageGasBreakdown {
    /// Gas used for storage read operations (SLOAD).
    #[schema(example = "2100")]
    pub reads: String,

    /// Gas used for storage write operations (SSTORE).
    #[schema(example = "20000")]
    pub writes: String,
}
