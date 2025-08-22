use redis::RedisError;

#[derive(Debug, thiserror::Error)]
pub enum CacheError {
    #[error("Redis connection error: {0}")]
    Connection(String),

    #[error("Redis operation failed: {0}")]
    Operation(String),

    #[error("Serialization failed: {0}")]
    Serialization(String),

    #[error("Deserialization failed: {0}")]
    Deserialization(String),

    #[error("Cache key not found: {key}")]
    KeyNotFound { key: String },

    #[error("Cache key expired: {key}")]
    KeyExpired { key: String },

    #[error("Invalid TTL value: {ttl}")]
    InvalidTTL { ttl: i64 },

    #[error("Cache pool exhausted")]
    PoolExhausted,

    #[error("Transaction failed: {reason}")]
    TransactionFailed { reason: String },
}

impl From<RedisError> for CacheError {
    fn from(err: RedisError) -> Self {
        match err.kind() {
            redis::ErrorKind::IoError => Self::Connection(err.to_string()),
            _ => Self::Operation(err.to_string()),
        }
    }
}

impl From<serde_json::Error> for CacheError {
    fn from(err: serde_json::Error) -> Self {
        if err.is_data() {
            Self::Deserialization(err.to_string())
        } else {
            Self::Serialization(err.to_string())
        }
    }
}

impl CacheError {
    pub fn key_not_found(key: impl Into<String>) -> Self {
        Self::KeyNotFound { key: key.into() }
    }

    pub fn key_expired(key: impl Into<String>) -> Self {
        Self::KeyExpired { key: key.into() }
    }

    pub const fn invalid_ttl(ttl: i64) -> Self {
        Self::InvalidTTL { ttl }
    }

    pub fn transaction_failed(reason: impl Into<String>) -> Self {
        Self::TransactionFailed { reason: reason.into() }
    }
}
