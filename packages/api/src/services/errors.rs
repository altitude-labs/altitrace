use alloy_rpc_types_eth::BlockNumberOrTag;
use redis::RedisError;
use serde_json::Error;

#[derive(Debug, thiserror::Error)]
pub enum HealthCheckError {
    #[error("Failed to connect to Redis: {0}")]
    ConnectionError(#[from] RedisError),

    #[error("Failed to set test value: {0}")]
    SetError(RedisError),

    #[error("Failed to get test value: {0}")]
    GetError(RedisError),

    #[error("Failed to cleanup test key: {0}")]
    CleanupError(RedisError),

    #[error("Unexpected value in health check")]
    ValueMismatch,

    #[error("Test value not found")]
    ValueNotFound,
}

#[derive(Debug, thiserror::Error)]
pub enum CacheError {
    #[error("Redis error: {0}")]
    Redis(#[from] RedisError),

    #[error("Serialization error: {0}")]
    Serialization(Error),

    #[error("Deserialization error: {0}")]
    Deserialization(Error),

    #[error("Cache operation failed: {0}")]
    OperationFailed(String),

    #[error("Health check failed: {0}")]
    HealthCheckFailed(#[from] HealthCheckError),
}

impl From<Error> for CacheError {
    fn from(err: Error) -> Self {
        if err.is_data() {
            Self::Deserialization(err)
        } else {
            Self::Serialization(err)
        }
    }
}

#[derive(Debug, Clone, thiserror::Error, serde::Deserialize)]
pub enum ProviderError {
    #[error("Stream error: {0}")]
    StreamError(String),
    #[error("Fetch error for block {block}: {error}")]
    FetchError { block: BlockNumberOrTag, error: String },
    #[error("Provider is exhausted or block {0} not found")]
    BlockNotFound(BlockNumberOrTag),
}
