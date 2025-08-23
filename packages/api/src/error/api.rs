use super::{
    cache::CacheError, conversion::ConversionError, provider::ProviderError,
    response::ErrorResponse, rpc::RpcError, service::ServiceError, validation::ValidationError,
};
use actix_web::{http::StatusCode, HttpResponse, ResponseError};

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("Invalid request: {message}")]
    BadRequest {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("Authentication required: {reason}")]
    Unauthorized { reason: String },

    #[error("Access denied: {reason}")]
    Forbidden { reason: String },

    #[error("Resource not found: {resource}")]
    NotFound { resource: String },

    #[error("Resource conflict: {details}")]
    Conflict { details: String },

    #[error("Rate limit exceeded")]
    RateLimitExceeded { retry_after: Option<u64> },

    #[error(transparent)]
    Validation(#[from] ValidationError),

    #[error(transparent)]
    Service(#[from] ServiceError),

    #[error(transparent)]
    Rpc(#[from] RpcError),

    #[error(transparent)]
    Cache(#[from] CacheError),

    #[error(transparent)]
    Provider(#[from] ProviderError),

    #[error(transparent)]
    Conversion(#[from] ConversionError),

    #[error("Internal server error")]
    Internal {
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
    },

    #[error("Service temporarily unavailable: {reason}")]
    ServiceUnavailable { reason: String, retry_after: Option<u64> },
}

impl ApiError {
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::BadRequest { message: message.into(), source: None }
    }

    pub fn unauthorized(reason: impl Into<String>) -> Self {
        Self::Unauthorized { reason: reason.into() }
    }

    pub fn forbidden(reason: impl Into<String>) -> Self {
        Self::Forbidden { reason: reason.into() }
    }

    pub fn not_found(resource: impl Into<String>) -> Self {
        Self::NotFound { resource: resource.into() }
    }

    pub fn conflict(details: impl Into<String>) -> Self {
        Self::Conflict { details: details.into() }
    }

    pub const fn rate_limit_exceeded(retry_after: Option<u64>) -> Self {
        Self::RateLimitExceeded { retry_after }
    }

    pub fn internal<E>(source: E) -> Self
    where
        E: std::error::Error + Send + Sync + 'static,
    {
        Self::Internal { source: Box::new(source) }
    }

    pub fn service_unavailable(reason: impl Into<String>) -> Self {
        Self::ServiceUnavailable { reason: reason.into(), retry_after: None }
    }

    pub const fn error_code(&self) -> &'static str {
        match self {
            Self::BadRequest { .. } => "BAD_REQUEST",
            Self::Unauthorized { .. } => "UNAUTHORIZED",
            Self::Forbidden { .. } => "FORBIDDEN",
            Self::NotFound { .. } => "NOT_FOUND",
            Self::Conflict { .. } => "CONFLICT",
            Self::RateLimitExceeded { .. } => "RATE_LIMIT_EXCEEDED",
            Self::Validation(_) => "VALIDATION_ERROR",
            Self::Service(err) => err.error_code(),
            Self::Rpc(err) => err.error_code(),
            Self::Cache(_) => "CACHE_ERROR",
            Self::Provider(_) => "PROVIDER_ERROR",
            Self::Conversion(_) => "CONVERSION_ERROR",
            Self::Internal { .. } => "INTERNAL_ERROR",
            Self::ServiceUnavailable { .. } => "SERVICE_UNAVAILABLE",
        }
    }

    pub fn suggestion(&self) -> Option<&'static str> {
        match self {
            Self::BadRequest { .. } => Some("Please check your request parameters"),
            Self::Unauthorized { .. } => Some("Please provide valid authentication credentials"),
            Self::Forbidden { .. } => Some("Please check your permissions"),
            Self::NotFound { .. } => Some("Please verify the resource identifier"),
            Self::RateLimitExceeded { .. } => Some("Please wait before making another request"),
            Self::Validation(_) => {
                Some("Please ensure all fields meet the validation requirements")
            }
            Self::Service(err) => err.suggestion(),
            Self::Rpc(err) => err.suggestion(),
            Self::Cache(_) => Some("Cache operation failed, please try again"),
            Self::Provider(_) => {
                Some("Provider communication error, please check node connectivity")
            }
            Self::Conversion(_) => Some("Data format error, please check your input"),
            Self::ServiceUnavailable { .. } => Some("Please try again later"),
            _ => None,
        }
    }

    pub fn to_error_response(&self, request_id: Option<String>) -> ErrorResponse {
        let mut response = ErrorResponse::from_error(self, request_id);

        // For service errors that wrap RPC errors, use the RPC error message directly
        if let Self::Service(ServiceError::NodeCommunication(rpc_err)) = self {
            response.error.message = rpc_err.to_string();
        }

        response
    }
}

impl ResponseError for ApiError {
    fn error_response(&self) -> HttpResponse {
        let status = self.status_code();
        HttpResponse::build(status).json(self.to_error_response(None))
    }

    fn status_code(&self) -> StatusCode {
        match self {
            Self::Unauthorized { .. } => StatusCode::UNAUTHORIZED,
            Self::Forbidden { .. } => StatusCode::FORBIDDEN,
            Self::NotFound { .. } => StatusCode::NOT_FOUND,
            Self::Conflict { .. } => StatusCode::CONFLICT,
            Self::RateLimitExceeded { .. } => StatusCode::TOO_MANY_REQUESTS,
            Self::Service(err) => err.status_code(),
            Self::Rpc(err) => err.status_code(),
            Self::Cache(_) | Self::Internal { .. } => StatusCode::INTERNAL_SERVER_ERROR,
            Self::Provider(_) => StatusCode::BAD_GATEWAY,
            Self::BadRequest { .. } | Self::Validation(_) | Self::Conversion(_) => {
                StatusCode::BAD_REQUEST
            }
            Self::ServiceUnavailable { .. } => StatusCode::SERVICE_UNAVAILABLE,
        }
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
