use super::{execution::ExecutionError, rpc::RpcError};
use alloy_transport::{RpcError as AlloyRpcError, TransportError, TransportErrorKind};
use regex::Regex;
use std::sync::LazyLock;

// Convert alloy transport errors
impl From<TransportError> for RpcError {
    fn from(err: TransportError) -> Self {
        match err {
            AlloyRpcError::Transport(transport_kind) => match transport_kind {
                TransportErrorKind::MissingBatchResponse(id) => Self::InternalError {
                    code: -32603,
                    message: format!("Missing batch response for request ID: {:?}", id),
                    data: None,
                },
                TransportErrorKind::BackendGone => Self::ConnectionFailed {
                    details: "Backend connection has been lost".to_string(),
                    endpoint: None,
                },
                TransportErrorKind::PubsubUnavailable => Self::MethodNotFound {
                    method: "Pubsub subscriptions are not available".to_string(),
                },
                TransportErrorKind::HttpError(http_err) => {
                    if http_err.status == 429 {
                        Self::RateLimited
                    } else if http_err.status >= 500 {
                        Self::InternalError {
                            code: http_err.status as i32,
                            message: format!("HTTP error {}: server error", http_err.status),
                            data: None,
                        }
                    } else if http_err.status == 0 ||
                        (http_err.status >= 400 && http_err.status < 500)
                    {
                        // Check if this is a connection timeout or similar
                        let sanitized_body = sanitize_error_message(&http_err.body);
                        if sanitized_body.contains("timeout") ||
                            sanitized_body.contains("connection")
                        {
                            Self::Timeout { method: "http_request".to_string(), duration_ms: 0 }
                        } else {
                            Self::InvalidParams {
                                method: "http_request".to_string(),
                                details: format!("HTTP {}: {}", http_err.status, sanitized_body),
                            }
                        }
                    } else {
                        Self::InvalidParams {
                            method: "http_request".to_string(),
                            details: format!("HTTP {}: request error", http_err.status),
                        }
                    }
                }
                TransportErrorKind::Custom(custom_err) => {
                    let sanitized_message = sanitize_error_message(&custom_err.to_string());
                    Self::InternalError { code: -32603, message: sanitized_message, data: None }
                }
                _ => Self::InternalError {
                    code: -32603,
                    message: "Unknown transport error".to_string(),
                    data: None,
                },
            },
            AlloyRpcError::SerError(ser_err) => {
                Self::ParseError { details: format!("Serialization error: {}", ser_err) }
            }
            AlloyRpcError::DeserError { err, text } => Self::ParseError {
                details: format!("Deserialization error: {} - text: {}", err, text),
            },
            AlloyRpcError::ErrorResp(error_payload) => {
                // Convert error payload to string and check for execution reverts
                let error_str = error_payload.to_string();

                if error_str.contains("execution reverted") || error_str.contains("revert") {
                    Self::ExecutionReverted {
                        reason: "Transaction execution reverted".to_string(),
                        data: Some(error_str),
                    }
                } else {
                    Self::InternalError {
                        code: -32603,
                        message: format!("RPC error: {}", error_str),
                        data: None,
                    }
                }
            }
            AlloyRpcError::NullResp => {
                Self::ParseError { details: "Received null response from RPC".to_string() }
            }
            AlloyRpcError::UnsupportedFeature(feature) => {
                Self::MethodNotFound { method: format!("Unsupported feature: {}", feature) }
            }
            _ => Self::InternalError {
                code: -32603,
                message: "Unknown RPC error".to_string(),
                data: None,
            },
        }
    }
}

pub fn parse_execution_error(error_msg: &str) -> Option<ExecutionError> {
    // Common revert patterns
    if error_msg.contains("execution reverted") {
        let reason = extract_revert_reason(error_msg);
        let data = extract_revert_data(error_msg);
        return Some(ExecutionError::reverted_with_data(reason, data.unwrap_or_default()));
    }

    if error_msg.contains("out of gas") || error_msg.contains("gas required exceeds allowance") {
        return Some(ExecutionError::out_of_gas(Default::default(), Default::default()));
    }

    if error_msg.contains("insufficient funds") {
        return Some(ExecutionError::insufficient_funds(
            Default::default(),
            Default::default(),
            Default::default(),
        ));
    }

    if error_msg.contains("nonce too low") || error_msg.contains("nonce mismatch") {
        return Some(ExecutionError::nonce_mismatch(0, 0));
    }

    if error_msg.contains("transaction underpriced") {
        return Some(ExecutionError::underpriced(Default::default(), Default::default()));
    }

    if error_msg.contains("contract creation code storage out of gas") {
        return Some(ExecutionError::contract_creation_failed("Code storage out of gas"));
    }

    if error_msg.contains("max code size exceeded") {
        return Some(ExecutionError::code_size_exceeded(0, 24576));
    }

    None
}

fn extract_revert_reason(error_msg: &str) -> String {
    // Try to extract custom error message
    if let Some(start) = error_msg.find("reverted: ") {
        let reason_start = start + 10;
        if let Some(end) = error_msg[reason_start..].find('"') {
            return error_msg[reason_start..reason_start + end].to_string();
        }
    }

    // Try to extract from standard revert
    if error_msg.contains("revert") {
        if let Some(reason) = extract_between(error_msg, "reason=\"", "\"") {
            return reason;
        }
    }

    "Transaction reverted without reason".to_string()
}

fn extract_revert_data(error_msg: &str) -> Option<String> {
    extract_between(error_msg, "data=\"", "\"")
        .or_else(|| extract_between(error_msg, "data: ", " "))
}

fn extract_between(text: &str, start: &str, end: &str) -> Option<String> {
    let start_idx = text.find(start)?;
    let content_start = start_idx + start.len();
    let end_idx = text[content_start..].find(end)?;
    Some(text[content_start..content_start + end_idx].to_string())
}

/// Sanitize error messages to remove sensitive information like IP addresses and URLs
fn sanitize_error_message(message: &str) -> String {
    static URL_REGEX: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"https?://[^\s/$.?#].[^\s]*").expect("Invalid regex"));

    static IP_REGEX: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?\b").expect("Invalid regex")
    });

    let mut sanitized = message.to_string();

    // Replace URLs with generic message
    sanitized = URL_REGEX
        .replace_all(&sanitized, "[RPC_ENDPOINT]")
        .to_string();

    // Replace IP addresses with generic message
    sanitized = IP_REGEX.replace_all(&sanitized, "[RPC_HOST]").to_string();

    // Handle common error patterns
    if sanitized.contains("error sending request") {
        return "RPC request timeout, check if RPC is running and accepting connections".to_string();
    }

    if sanitized.contains("connection refused") || sanitized.contains("Connection refused") {
        return "RPC connection refused, check if RPC is running and accepting connections"
            .to_string();
    }

    if sanitized.contains("No route to host") || sanitized.contains("Host unreachable") {
        return "RPC host unreachable, check network connectivity and RPC configuration".to_string();
    }

    if sanitized.contains("timeout") || sanitized.contains("timed out") {
        return "RPC request timeout, check if RPC is running and accepting connections".to_string();
    }

    sanitized
}
