use actix_web::http::StatusCode;

#[derive(Debug, Clone, thiserror::Error)]
pub enum RpcError {
    #[error("RPC connection failed: {details}")]
    ConnectionFailed { details: String, endpoint: Option<String> },

    #[error("RPC request timeout")]
    Timeout { method: String, duration_ms: u64 },

    #[error("RPC method not found: {method}")]
    MethodNotFound { method: String },

    #[error("Invalid RPC parameters for {method}: {details}")]
    InvalidParams { method: String, details: String },

    #[error("RPC internal error: {message}")]
    InternalError { code: i32, message: String, data: Option<serde_json::Value> },

    #[error("RPC response parse error: {details}")]
    ParseError { details: String },

    #[error("Node syncing: current block {current}, highest block {highest}")]
    NodeSyncing { current: u64, highest: u64 },

    #[error("Block not found")]
    BlockNotFound,

    #[error("Transaction not found")]
    TransactionNotFound,

    #[error("Execution reverted: {reason}")]
    ExecutionReverted { reason: String, data: Option<String> },

    #[error("Rate limited by node")]
    RateLimited,

    #[error("Transport error: {0}")]
    Transport(String),
}

impl RpcError {
    pub fn connection_failed(details: impl Into<String>) -> Self {
        Self::ConnectionFailed { details: details.into(), endpoint: None }
    }

    pub fn timeout(method: impl Into<String>, duration_ms: u64) -> Self {
        Self::Timeout { method: method.into(), duration_ms }
    }

    pub fn invalid_params(method: impl Into<String>, details: impl Into<String>) -> Self {
        Self::InvalidParams { method: method.into(), details: details.into() }
    }

    pub fn execution_reverted(reason: impl Into<String>) -> Self {
        Self::ExecutionReverted { reason: reason.into(), data: None }
    }

    pub const fn error_code(&self) -> &'static str {
        match self {
            Self::ConnectionFailed { .. } => "RPC_CONNECTION_FAILED",
            Self::Timeout { .. } => "RPC_TIMEOUT",
            Self::MethodNotFound { .. } => "RPC_METHOD_NOT_FOUND",
            Self::InvalidParams { .. } => "RPC_INVALID_PARAMS",
            Self::InternalError { .. } => "RPC_INTERNAL_ERROR",
            Self::ParseError { .. } => "RPC_PARSE_ERROR",
            Self::NodeSyncing { .. } => "NODE_SYNCING",
            Self::BlockNotFound => "BLOCK_NOT_FOUND",
            Self::TransactionNotFound => "TRANSACTION_NOT_FOUND",
            Self::ExecutionReverted { .. } => "EXECUTION_REVERTED",
            Self::RateLimited => "RPC_RATE_LIMITED",
            Self::Transport(_) => "RPC_TRANSPORT_ERROR",
        }
    }

    pub fn suggestion(&self) -> Option<&'static str> {
        match self {
            Self::ConnectionFailed { .. } => {
                Some("Check your RPC endpoint URL and network connectivity")
            }
            Self::Timeout { .. } => {
                Some("RPC request timeout, check if RPC is running and accepting connections")
            }
            Self::MethodNotFound { .. } => Some("The RPC method is not supported by this node"),
            Self::InvalidParams { details, .. } => {
                if details.contains("odd number of digits") {
                    Some("Hex data must have an even number of characters")
                } else if details.contains("Invalid 'data' hex") {
                    Some("The 'data' field must be a valid hex string with 0x prefix")
                } else if details.contains("Failed to convert call") {
                    Some("Check transaction call parameters - address, data, value, gas fields")
                } else {
                    Some("Check the parameters format and types")
                }
            }
            Self::NodeSyncing { .. } => Some("Wait for the node to finish syncing"),
            Self::BlockNotFound => Some("The block may not exist yet or has been pruned"),
            Self::TransactionNotFound => Some("The transaction hash is invalid or not yet mined"),
            Self::ExecutionReverted { .. } => {
                Some("The transaction would revert, check contract conditions")
            }
            Self::RateLimited => Some("Too many requests, please slow down"),
            _ => None,
        }
    }

    pub const fn status_code(&self) -> StatusCode {
        match self {
            Self::ConnectionFailed { .. } | Self::Transport(_) => StatusCode::BAD_GATEWAY,
            Self::Timeout { .. } => StatusCode::GATEWAY_TIMEOUT,
            Self::MethodNotFound { .. } => StatusCode::NOT_IMPLEMENTED,
            Self::InvalidParams { .. } => StatusCode::BAD_REQUEST,
            Self::InternalError { .. } | Self::ParseError { .. } => {
                StatusCode::INTERNAL_SERVER_ERROR
            }
            Self::NodeSyncing { .. } => StatusCode::SERVICE_UNAVAILABLE,
            Self::BlockNotFound | Self::TransactionNotFound => StatusCode::NOT_FOUND,
            Self::ExecutionReverted { .. } => StatusCode::OK,
            Self::RateLimited => StatusCode::TOO_MANY_REQUESTS,
        }
    }
}
