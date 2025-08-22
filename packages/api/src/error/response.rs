use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{validation::ValidationErrorDetail, RpcError, ServiceError};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ErrorResponse {
    pub error: ErrorDetail,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after: Option<u64>,
}

impl ErrorResponse {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            error: ErrorDetail {
                code: code.into(),
                message: message.into(),
                details: None,
                suggestion: None,
                retry_after: None,
            },
            request_id: None,
        }
    }

    pub fn with_request_id(mut self, request_id: impl Into<String>) -> Self {
        self.request_id = Some(request_id.into());
        self
    }

    pub fn with_details(mut self, details: Value) -> Self {
        self.error.details = Some(details);
        self
    }

    pub fn with_suggestion(mut self, suggestion: impl Into<String>) -> Self {
        self.error.suggestion = Some(suggestion.into());
        self
    }

    pub const fn with_retry_after(mut self, retry_after: u64) -> Self {
        self.error.retry_after = Some(retry_after);
        self
    }

    pub fn from_error<E>(error: &E, request_id: Option<String>) -> Self
    where
        E: std::error::Error + ErrorResponseProvider,
    {
        let mut response = Self::new(error.error_code(), error.to_string());
        response.request_id = request_id;

        if let Some(suggestion) = error.suggestion() {
            response.error.suggestion = Some(suggestion.to_string());
        }

        if let Some(retry_after) = error.retry_after() {
            response.error.retry_after = Some(retry_after);
        }

        if let Some(details) = error.error_details() {
            response.error.details = Some(details);
        }

        response
    }
}

pub trait ErrorResponseProvider {
    fn error_code(&self) -> &'static str;
    fn suggestion(&self) -> Option<&'static str>;
    fn retry_after(&self) -> Option<u64> {
        None
    }
    fn error_details(&self) -> Option<Value> {
        None
    }
}

impl ErrorResponseProvider for super::api::ApiError {
    fn error_code(&self) -> &'static str {
        self.error_code()
    }

    fn suggestion(&self) -> Option<&'static str> {
        self.suggestion()
    }

    fn retry_after(&self) -> Option<u64> {
        match self {
            Self::RateLimitExceeded { retry_after } |
            Self::ServiceUnavailable { retry_after, .. } => *retry_after,
            _ => None,
        }
    }

    fn error_details(&self) -> Option<Value> {
        match self {
            Self::Validation(err) => {
                let detail = ValidationErrorDetail::from(err.clone());
                Some(serde_json::to_value(detail).unwrap_or(Value::Null))
            }
            Self::Rpc(rpc_err) => {
                let mut details = serde_json::Map::new();
                match rpc_err {
                    RpcError::InvalidParams { method, details: error_details } => {
                        details.insert("method".to_string(), Value::String(method.clone()));
                        details.insert("details".to_string(), Value::String(error_details.clone()));
                    }
                    RpcError::InternalError { code, message, data } => {
                        details.insert("error_code".to_string(), Value::Number((*code).into()));
                        details.insert("message".to_string(), Value::String(message.clone()));
                        if let Some(data) = data {
                            details.insert("data".to_string(), data.clone());
                        }
                    }
                    RpcError::ExecutionReverted { reason, data } => {
                        details.insert("reason".to_string(), Value::String(reason.clone()));
                        if let Some(data) = data {
                            details.insert("revert_data".to_string(), Value::String(data.clone()));
                        }
                    }
                    RpcError::Timeout { method, duration_ms } => {
                        details.insert("method".to_string(), Value::String(method.clone()));
                        details
                            .insert("timeout_ms".to_string(), Value::Number((*duration_ms).into()));
                    }
                    _ => return None,
                }
                Some(Value::Object(details))
            }
            Self::Service(service_err) => {
                let mut details = serde_json::Map::new();
                match service_err {
                    ServiceError::NodeCommunication(ref rpc_err) => {
                        // Delegate to RPC error details
                        return Self::Rpc(rpc_err.clone()).error_details();
                    }
                    ServiceError::SimulationFailed { reason, .. } |
                    ServiceError::TraceFailed { reason, .. } |
                    ServiceError::InvalidBlockContext { reason } |
                    ServiceError::AccessListFailed { reason } => {
                        details.insert("reason".to_string(), Value::String(reason.clone()));
                    }
                    _ => return None,
                }
                Some(Value::Object(details))
            }
            _ => None,
        }
    }
}
