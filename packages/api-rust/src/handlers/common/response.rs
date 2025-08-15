use actix_web::{http::StatusCode, HttpResponse};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoResponses, ToSchema};

/// Standard API response wrapper for all simulation endpoints.
///
/// This provides a consistent response format across the API,
/// including success/failure indication, data payload, error information,
/// and request metadata for tracking and debugging.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponse<T> {
    /// Indicates whether the request was processed successfully.
    #[schema(example = true)]
    pub success: bool,

    /// The response data (present only on successful requests).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,

    /// Error information (present only on failed requests).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ApiError>,

    /// Request metadata and timing information.
    pub metadata: ResponseMetadata,
}

/// Detailed error information for failed requests.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    /// Machine-readable error code for programmatic handling.
    #[schema(example = "INVALID_TRANSACTION")]
    pub code: String,

    /// Human-readable error message.
    #[schema(example = "Transaction validation failed")]
    pub message: String,

    /// Additional structured error details.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,

    /// Stack trace for debugging (only in debug builds).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace: Option<String>,

    /// Suggested resolution or workaround for the error.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
}

/// Metadata included with every API response.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ResponseMetadata {
    /// Unique identifier for request tracking and correlation.
    #[schema(example = "req_01234567-89ab-cdef-0123-456789abcdef")]
    pub request_id: String,

    /// UTC timestamp when the response was generated.
    pub timestamp: DateTime<Utc>,

    /// Total processing time in milliseconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = 45)]
    pub execution_time: Option<u64>,
}

// Helper implementations for creating responses
impl<T> ApiResponse<T> {
    /// Creates a successful API response.
    pub fn success(data: T, request_id: impl Into<String>) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            metadata: ResponseMetadata {
                request_id: request_id.into(),
                timestamp: Utc::now(),
                execution_time: None,
            },
        }
    }

    /// Creates a successful API response with execution time.
    pub fn success_with_timing(
        data: T,
        request_id: impl Into<String>,
        execution_time: u64,
    ) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            metadata: ResponseMetadata {
                request_id: request_id.into(),
                timestamp: Utc::now(),
                execution_time: Some(execution_time),
            },
        }
    }

    /// Creates an error API response.
    pub fn error(error: ApiError, request_id: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
            metadata: ResponseMetadata {
                request_id: request_id.into(),
                timestamp: Utc::now(),
                execution_time: None,
            },
        }
    }
}

impl<T: Serialize> From<ApiResponse<T>> for HttpResponse {
    fn from(value: ApiResponse<T>) -> Self {
        let status = if value.success { StatusCode::OK } else { StatusCode::INTERNAL_SERVER_ERROR };

        Self::build(status).json(value)
    }
}

impl ApiError {
    /// Creates a new API error with code and message.
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
            trace: None,
            suggestion: None,
        }
    }

    /// Adds additional details to the error.
    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }

    /// Adds a suggestion for resolving the error.
    pub fn with_suggestion(mut self, suggestion: impl Into<String>) -> Self {
        self.suggestion = Some(suggestion.into());
        self
    }
}

// Standard API response types using IntoResponses
#[derive(IntoResponses)]
pub enum CommonApiResponses {
    /// Bad request - invalid parameters
    #[response(status = 400, description = "Invalid request parameters")]
    BadRequest(#[to_schema] ApiResponse<String>),

    /// Internal server error
    #[response(status = 500, description = "Internal server error")]
    InternalError(#[to_schema] ApiResponse<String>),

    /// Unauthorized access
    #[response(status = 401, description = "Unauthorized")]
    Unauthorized(#[to_schema] ApiResponse<String>),

    /// Not found
    #[response(status = 404, description = "Resource not found")]
    NotFound(#[to_schema] ApiResponse<String>),
}

#[derive(IntoResponses)]
pub enum ValidationErrorResponses {
    /// Validation failed
    #[response(status = 400, description = "Validation error")]
    ValidationError(#[to_schema] ApiResponse<String>),

    /// Address format error
    #[response(status = 400, description = "Invalid address format")]
    InvalidAddress(#[to_schema] ApiResponse<String>),

    /// Limit exceeded
    #[response(status = 400, description = "Limit parameter out of range")]
    InvalidLimit(#[to_schema] ApiResponse<String>),
}

#[derive(IntoResponses)]
pub enum AuthenticationResponses {
    /// Authentication required
    #[response(status = 401, description = "Authentication required")]
    Unauthorized(#[to_schema] ApiResponse<String>),

    /// Invalid API key
    #[response(status = 401, description = "Invalid API key")]
    InvalidApiKey(#[to_schema] ApiResponse<String>),

    /// API key missing
    #[response(status = 401, description = "API key missing")]
    MissingApiKey(#[to_schema] ApiResponse<String>),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_response_creation() {
        let response = ApiResponse::success("test data".to_string(), "req_123".to_string());
        assert!(response.success);
        assert!(response.data.is_some());
        assert!(response.error.is_none());
        assert_eq!(response.metadata.request_id, "req_123");
    }

    #[test]
    fn test_api_error_creation() {
        let error =
            ApiError::new("TEST_ERROR", "Test error message").with_suggestion("Try again later");

        assert_eq!(error.code, "TEST_ERROR");
        assert_eq!(error.message, "Test error message");
        assert!(error.suggestion.is_some());
    }
}
