use alloy_primitives::B256;
use alloy_rpc_types_eth::BlockNumberOrTag;

#[derive(Debug, Clone, thiserror::Error)]
pub enum ProviderError {
    #[error("Provider connection failed: {endpoint}")]
    ConnectionFailed { endpoint: String },

    #[error("Unsupported protocol: {protocol}")]
    UnsupportedProtocol { protocol: String },

    #[error("Block not found: {0}")]
    BlockNotFound(BlockNumberOrTag),

    #[error("Transaction not found: {hash}")]
    TransactionNotFound { hash: B256 },

    #[error("Receipt not found for transaction: {hash}")]
    ReceiptNotFound { hash: B256 },

    #[error("Failed to fetch block {block}: {error}")]
    FetchError { block: BlockNumberOrTag, error: String },

    #[error("Provider stream error: {0}")]
    StreamError(String),

    #[error("Provider is not ready")]
    NotReady,

    #[error("Chain ID mismatch: expected {expected}, got {actual}")]
    ChainIdMismatch { expected: u64, actual: u64 },
}

impl ProviderError {
    pub fn connection_failed(endpoint: impl Into<String>) -> Self {
        Self::ConnectionFailed { endpoint: endpoint.into() }
    }

    pub fn unsupported_protocol(protocol: impl Into<String>) -> Self {
        Self::UnsupportedProtocol { protocol: protocol.into() }
    }

    pub const fn transaction_not_found(hash: B256) -> Self {
        Self::TransactionNotFound { hash }
    }

    pub const fn receipt_not_found(hash: B256) -> Self {
        Self::ReceiptNotFound { hash }
    }

    pub fn fetch_error(block: BlockNumberOrTag, error: impl Into<String>) -> Self {
        Self::FetchError { block, error: error.into() }
    }

    pub fn stream_error(error: impl Into<String>) -> Self {
        Self::StreamError(error.into())
    }

    pub const fn chain_id_mismatch(expected: u64, actual: u64) -> Self {
        Self::ChainIdMismatch { expected, actual }
    }
}
