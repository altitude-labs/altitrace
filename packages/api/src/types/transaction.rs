use crate::{
    handlers::{
        simulation::conversion::convert_block_overrides,
        validation::{validate_address, validate_hex_string, validate_uint256},
    },
    types::shared::BlockOverrides,
};

use alloy_rpc_types::{Bundle as AlloyBundle, TransactionReceipt};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

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

/// Transaction receipt information.
#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TransactionReceiptInfo {
    /// Sender address.
    #[schema(example = "0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c")]
    pub from: String,

    /// Recipient address (None for contract creation).
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")]
    pub to: Option<String>,

    /// Contract address (if contract creation).
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "0x1234567890abcdef1234567890abcdef1234567890")]
    pub contract_address: Option<String>,

    /// Gas used by the transaction.
    #[schema(example = "0x5208")]
    pub gas_used: String,

    /// Effective gas price (hex-encoded wei).
    #[schema(example = "0x3b9aca00")]
    pub effective_gas_price: String,

    /// Cumulative gas used in the block at the time of the transaction.
    #[schema(example = "0x7a120")]
    pub cumulative_gas_used: String,

    /// Transaction type (0 for legacy, 1 for EIP-2930, 2 for EIP-1559).
    #[schema(example = 2)]
    pub transaction_type: u8,

    /// Transaction status.
    #[schema(example = true)]
    pub status: bool,

    /// Logs bloom filter.
    #[schema(
        example = "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    )]
    pub logs_bloom: String,

    /// Number of logs emitted.
    #[schema(example = 2)]
    pub logs_count: u64,
}

impl From<TransactionReceipt> for TransactionReceiptInfo {
    fn from(receipt: TransactionReceipt) -> Self {
        let consensus_receipt = receipt.clone().inner;

        Self {
            from: format!("0x{:x}", receipt.from),
            to: receipt.to.map(|addr| format!("0x{:x}", addr)),
            contract_address: receipt.contract_address.map(|addr| format!("0x{:x}", addr)),
            gas_used: format!("0x{:x}", receipt.gas_used),
            effective_gas_price: format!("0x{:x}", receipt.effective_gas_price),
            cumulative_gas_used: format!("0x{:x}", consensus_receipt.cumulative_gas_used()),
            transaction_type: receipt.transaction_type() as u8,
            status: receipt.status(),
            logs_bloom: format!("0x{}", hex::encode(consensus_receipt.logs_bloom())),
            logs_count: consensus_receipt.logs().len() as u64,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Bundle {
    /// The transactions to execute in the bundle.
    #[validate(length(min = 1, message = "Bundle must contain at least one transaction"))]
    #[validate(nested)]
    pub transactions: Vec<TransactionCall>,
    /// Block overrides to apply during tracing.
    pub block_overrides: Option<BlockOverrides>,
}

impl From<Bundle> for AlloyBundle {
    fn from(bundle: Bundle) -> Self {
        let transactions = bundle
            .transactions
            .into_iter()
            .map(|tx| tx.try_into())
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        let block_override = convert_block_overrides(bundle.block_overrides.unwrap_or_default())
            .map_err(|e| eyre::anyhow!("Failed to convert block overrides: {}", e))
            .ok();

        Self { transactions, block_override }
    }
}
