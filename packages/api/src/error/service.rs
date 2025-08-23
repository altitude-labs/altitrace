use super::{execution::ExecutionError, rpc::RpcError};
use actix_web::http::StatusCode;

#[derive(Debug, thiserror::Error)]
pub enum ServiceError {
    #[error("Simulation failed: {reason}")]
    SimulationFailed {
        reason: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("Trace failed: {reason}")]
    TraceFailed {
        reason: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("Transaction execution failed")]
    ExecutionFailed(#[from] ExecutionError),

    #[error("Block context invalid: {reason}")]
    InvalidBlockContext { reason: String },

    #[error("State override invalid: {reason}")]
    InvalidStateOverride { reason: String },

    #[error("Access list generation failed: {reason}")]
    AccessListFailed { reason: String },

    #[error("Bundle validation failed: {reason}")]
    BundleValidationFailed { reason: String },

    #[error("Gas estimation failed: {reason}")]
    GasEstimationFailed { reason: String },

    #[error("Node communication error")]
    NodeCommunication(#[from] RpcError),

    #[error("Resource exhausted: {resource}")]
    ResourceExhausted { resource: String },

    #[error("Operation timed out after {duration_ms}ms")]
    OperationTimeout { operation: String, duration_ms: u64 },
}

impl ServiceError {
    pub fn simulation_failed(reason: impl Into<String>) -> Self {
        Self::SimulationFailed { reason: reason.into(), source: None }
    }

    pub fn trace_failed(reason: impl Into<String>) -> Self {
        Self::TraceFailed { reason: reason.into(), source: None }
    }

    pub fn invalid_block_context(reason: impl Into<String>) -> Self {
        Self::InvalidBlockContext { reason: reason.into() }
    }

    pub fn invalid_state_override(reason: impl Into<String>) -> Self {
        Self::InvalidStateOverride { reason: reason.into() }
    }

    pub fn access_list_failed(reason: impl Into<String>) -> Self {
        Self::AccessListFailed { reason: reason.into() }
    }

    pub fn bundle_validation_failed(reason: impl Into<String>) -> Self {
        Self::BundleValidationFailed { reason: reason.into() }
    }

    pub fn gas_estimation_failed(reason: impl Into<String>) -> Self {
        Self::GasEstimationFailed { reason: reason.into() }
    }

    pub fn resource_exhausted(resource: impl Into<String>) -> Self {
        Self::ResourceExhausted { resource: resource.into() }
    }

    pub fn timeout(operation: impl Into<String>, duration_ms: u64) -> Self {
        Self::OperationTimeout { operation: operation.into(), duration_ms }
    }

    pub const fn error_code(&self) -> &'static str {
        match self {
            Self::SimulationFailed { .. } => "SIMULATION_FAILED",
            Self::TraceFailed { .. } => "TRACE_FAILED",
            Self::ExecutionFailed(_) => "EXECUTION_FAILED",
            Self::InvalidBlockContext { .. } => "INVALID_BLOCK_CONTEXT",
            Self::InvalidStateOverride { .. } => "INVALID_STATE_OVERRIDE",
            Self::AccessListFailed { .. } => "ACCESS_LIST_FAILED",
            Self::BundleValidationFailed { .. } => "BUNDLE_VALIDATION_FAILED",
            Self::GasEstimationFailed { .. } => "GAS_ESTIMATION_FAILED",
            Self::NodeCommunication(rpc) => rpc.error_code(),
            Self::ResourceExhausted { .. } => "RESOURCE_EXHAUSTED",
            Self::OperationTimeout { .. } => "OPERATION_TIMEOUT",
        }
    }

    pub fn suggestion(&self) -> Option<&'static str> {
        match self {
            Self::SimulationFailed { .. } => {
                Some("Check transaction parameters and ensure the RPC node is accessible")
            }
            Self::TraceFailed { .. } => {
                Some("Ensure the transaction exists and tracing is enabled on the node")
            }
            Self::ExecutionFailed(_) => Some("Review transaction parameters and contract state"),
            Self::InvalidBlockContext { .. } => {
                Some("Use a valid block number or tag (latest, earliest, safe, finalized)")
            }
            Self::InvalidStateOverride { .. } => Some("Check state override format and values"),
            Self::AccessListFailed { .. } => {
                Some("Verify transaction parameters for access list generation")
            }
            Self::BundleValidationFailed { .. } => {
                Some("Check bundle format and transaction dependencies")
            }
            Self::GasEstimationFailed { .. } => {
                Some("Transaction may fail or gas limit is too low")
            }
            Self::NodeCommunication(rpc) => rpc.suggestion(),
            Self::ResourceExhausted { .. } => {
                Some("Try reducing the request size or wait before retrying")
            }
            Self::OperationTimeout { .. } => {
                Some("The operation took too long, try with simpler parameters")
            }
        }
    }

    pub const fn status_code(&self) -> StatusCode {
        match self {
            Self::SimulationFailed { .. } |
            Self::GasEstimationFailed { .. } |
            Self::ExecutionFailed(_) => StatusCode::OK,
            Self::TraceFailed { .. } | Self::AccessListFailed { .. } => {
                StatusCode::INTERNAL_SERVER_ERROR
            }
            Self::InvalidBlockContext { .. } |
            Self::InvalidStateOverride { .. } |
            Self::BundleValidationFailed { .. } => StatusCode::BAD_REQUEST,
            Self::NodeCommunication(rpc) => rpc.status_code(),
            Self::ResourceExhausted { .. } => StatusCode::SERVICE_UNAVAILABLE,
            Self::OperationTimeout { .. } => StatusCode::GATEWAY_TIMEOUT,
        }
    }
}
