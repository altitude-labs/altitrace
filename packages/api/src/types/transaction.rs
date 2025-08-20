use alloy_rpc_types::TransactionReceipt;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

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
