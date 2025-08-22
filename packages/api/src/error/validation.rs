use serde::Serialize;

#[derive(Debug, Clone, thiserror::Error)]
pub enum ValidationError {
    #[error("Invalid field '{field}': {reason}")]
    InvalidField { field: String, reason: String },

    #[error("Missing required field: {field}")]
    MissingField { field: String },

    #[error("Invalid address format: {value}")]
    InvalidAddress { value: String },

    #[error("Invalid transaction hash: {value}")]
    InvalidTransactionHash { value: String },

    #[error("Invalid block identifier: {value}")]
    InvalidBlockId { value: String },

    #[error("Invalid hex data: {reason}")]
    InvalidHexData { reason: String },

    #[error("Invalid numeric value: {field} = {value}, reason: {reason}")]
    InvalidNumeric { field: String, value: String, reason: String },

    #[error("Value out of range: {field} = {value}, expected {min} to {max}")]
    OutOfRange { field: String, value: String, min: String, max: String },

    #[error("Invalid gas parameters: {reason}")]
    InvalidGasParams { reason: String },

    #[error("Invalid chain ID: {value}")]
    InvalidChainId { value: u64 },

    #[error("Conflicting parameters: {details}")]
    ConflictingParams { details: String },

    #[error("Invalid signature: {reason}")]
    InvalidSignature { reason: String },

    #[error("Invalid access list: {reason}")]
    InvalidAccessList { reason: String },

    #[error("Invalid state override: {reason}")]
    InvalidStateOverride { reason: String },

    #[error("Request size exceeded: {size} bytes, maximum {max_size} bytes")]
    RequestTooLarge { size: usize, max_size: usize },

    #[error("Too many items: {count} {item_type}, maximum {max_count}")]
    TooManyItems { item_type: String, count: usize, max_count: usize },
}

impl ValidationError {
    pub fn invalid_field(field: impl Into<String>, reason: impl Into<String>) -> Self {
        Self::InvalidField { field: field.into(), reason: reason.into() }
    }

    pub fn missing_field(field: impl Into<String>) -> Self {
        Self::MissingField { field: field.into() }
    }

    pub fn invalid_address(value: impl Into<String>) -> Self {
        Self::InvalidAddress { value: value.into() }
    }

    pub fn invalid_tx_hash(value: impl Into<String>) -> Self {
        Self::InvalidTransactionHash { value: value.into() }
    }

    pub fn invalid_block_id(value: impl Into<String>) -> Self {
        Self::InvalidBlockId { value: value.into() }
    }

    pub fn invalid_hex(reason: impl Into<String>) -> Self {
        Self::InvalidHexData { reason: reason.into() }
    }

    pub fn invalid_numeric(
        field: impl Into<String>,
        value: impl Into<String>,
        reason: impl Into<String>,
    ) -> Self {
        Self::InvalidNumeric { field: field.into(), value: value.into(), reason: reason.into() }
    }

    pub fn out_of_range(
        field: impl Into<String>,
        value: impl Into<String>,
        min: impl Into<String>,
        max: impl Into<String>,
    ) -> Self {
        Self::OutOfRange {
            field: field.into(),
            value: value.into(),
            min: min.into(),
            max: max.into(),
        }
    }

    pub fn invalid_gas_params(reason: impl Into<String>) -> Self {
        Self::InvalidGasParams { reason: reason.into() }
    }

    pub fn conflicting_params(details: impl Into<String>) -> Self {
        Self::ConflictingParams { details: details.into() }
    }

    pub const fn request_too_large(size: usize, max_size: usize) -> Self {
        Self::RequestTooLarge { size, max_size }
    }

    pub fn too_many_items(item_type: impl Into<String>, count: usize, max_count: usize) -> Self {
        Self::TooManyItems { item_type: item_type.into(), count, max_count }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ValidationErrorDetail {
    pub field: Option<String>,
    pub value: Option<String>,
    pub reason: String,
    pub suggestion: Option<String>,
}

impl From<ValidationError> for ValidationErrorDetail {
    fn from(err: ValidationError) -> Self {
        match err {
            ValidationError::InvalidField { field, reason } => Self {
                field: Some(field),
                value: None,
                reason,
                suggestion: Some("Check the field format and constraints".to_string()),
            },
            ValidationError::MissingField { field } => Self {
                field: Some(field.clone()),
                value: None,
                reason: "Required field is missing".to_string(),
                suggestion: Some(format!("Please provide the '{}' field", field)),
            },
            ValidationError::InvalidAddress { value } => Self {
                field: Some("address".to_string()),
                value: Some(value),
                reason: "Invalid Ethereum address format".to_string(),
                suggestion: Some(
                    "Address must be a 40-character hex string with 0x prefix".to_string(),
                ),
            },
            ValidationError::InvalidTransactionHash { value } => Self {
                field: Some("transaction_hash".to_string()),
                value: Some(value),
                reason: "Invalid transaction hash format".to_string(),
                suggestion: Some(
                    "Transaction hash must be a 64-character hex string with 0x prefix".to_string(),
                ),
            },
            ValidationError::InvalidNumeric { field, value, reason } => Self {
                field: Some(field),
                value: Some(value),
                reason,
                suggestion: Some(
                    "Use valid hex number with 0x prefix or decimal string".to_string(),
                ),
            },
            _ => Self { field: None, value: None, reason: err.to_string(), suggestion: None },
        }
    }
}
