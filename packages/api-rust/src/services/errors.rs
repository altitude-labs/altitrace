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
