use super::{ApiError, RpcError, ServiceError};
use alloy_primitives::{Address, B256};
use alloy_rpc_types_eth::BlockNumberOrTag;

/// Extension trait for adding context to errors
pub trait ErrorContext<T> {
    /// Add context to the error about which operation was being performed
    fn with_context(self, context: &str) -> Result<T, ApiError>;

    /// Add context about which transaction was being processed
    fn with_tx_context(self, tx_hash: B256) -> Result<T, ApiError>;

    /// Add context about which block was being processed
    fn with_block_context(self, block: BlockNumberOrTag) -> Result<T, ApiError>;

    /// Add context about which address was involved
    fn with_address_context(self, address: Address) -> Result<T, ApiError>;
}

impl<T, E> ErrorContext<T> for Result<T, E>
where
    E: Into<ApiError>,
{
    fn with_context(self, context: &str) -> Result<T, ApiError> {
        self.map_err(|e| {
            let mut api_error = e.into();
            match &mut api_error {
                ApiError::Service(
                    ServiceError::SimulationFailed { reason, .. } |
                    ServiceError::TraceFailed { reason, .. },
                ) => {
                    *reason = format!("{}: {}", context, reason);
                }
                ApiError::Rpc(RpcError::InternalError { message, .. }) => {
                    *message = format!("{}: {}", context, message);
                }
                _ => {}
            }
            api_error
        })
    }

    fn with_tx_context(self, tx_hash: B256) -> Result<T, ApiError> {
        self.with_context(&format!("Processing transaction 0x{:x}", tx_hash))
    }

    fn with_block_context(self, block: BlockNumberOrTag) -> Result<T, ApiError> {
        self.with_context(&format!("Processing block {:?}", block))
    }

    fn with_address_context(self, address: Address) -> Result<T, ApiError> {
        self.with_context(&format!("Processing address 0x{:x}", address))
    }
}

/// Helper macros for error handling
#[macro_export]
macro_rules! ensure_not_zero {
    ($value:expr, $field:literal) => {
        if $value.is_zero() {
            return Err($crate::error::ValidationError::invalid_field(
                $field,
                "Value cannot be zero",
            )
            .into());
        }
    };
}

#[macro_export]
macro_rules! ensure_valid_hex {
    ($value:expr, $field:literal) => {
        if !$value.starts_with("0x") || $value.len() % 2 != 0 {
            return Err($crate::error::ValidationError::invalid_hex(format!(
                "Field '{}' must be valid hex string with 0x prefix",
                $field
            ))
            .into());
        }
    };
}

#[macro_export]
macro_rules! rpc_call {
    ($provider:expr, $method:ident($($arg:expr),*)) => {{
        use $crate::error::ErrorContext;
        $provider.$method($($arg),*)
            .await
            .with_context(concat!("RPC call: ", stringify!($method)))
    }};
}
