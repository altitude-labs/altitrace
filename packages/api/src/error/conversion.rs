#[derive(Debug, thiserror::Error)]
pub enum ConversionError {
    #[error("Failed to parse address: {input}")]
    AddressParse { input: String },

    #[error("Failed to parse hash: {input}")]
    HashParse { input: String },

    #[error("Failed to parse numeric value: {input}, reason: {reason}")]
    NumericParse { input: String, reason: String },

    #[error("Failed to parse hex data: {reason}")]
    HexParse { reason: String },

    #[error("Invalid block tag: {tag}")]
    InvalidBlockTag { tag: String },

    #[error("Failed to serialize: {reason}")]
    SerializationFailed { reason: String },

    #[error("Failed to deserialize: {reason}")]
    DeserializationFailed { reason: String },

    #[error("Type conversion failed: cannot convert {from} to {to}")]
    TypeConversion { from: String, to: String },

    #[error("Invalid enum variant: {value} for {enum_name}")]
    InvalidEnumVariant { enum_name: String, value: String },

    #[error("Data overflow: value {value} exceeds maximum for type {type_name}")]
    Overflow { type_name: String, value: String },

    #[error("Missing required data: {field}")]
    MissingData { field: String },
}

impl ConversionError {
    pub fn address_parse(input: impl Into<String>) -> Self {
        Self::AddressParse { input: input.into() }
    }

    pub fn hash_parse(input: impl Into<String>) -> Self {
        Self::HashParse { input: input.into() }
    }

    pub fn numeric_parse(input: impl Into<String>, reason: impl Into<String>) -> Self {
        Self::NumericParse { input: input.into(), reason: reason.into() }
    }

    pub fn hex_parse(reason: impl Into<String>) -> Self {
        Self::HexParse { reason: reason.into() }
    }

    pub fn invalid_block_tag(tag: impl Into<String>) -> Self {
        Self::InvalidBlockTag { tag: tag.into() }
    }

    pub fn serialization_failed(reason: impl Into<String>) -> Self {
        Self::SerializationFailed { reason: reason.into() }
    }

    pub fn deserialization_failed(reason: impl Into<String>) -> Self {
        Self::DeserializationFailed { reason: reason.into() }
    }

    pub fn type_conversion(from: impl Into<String>, to: impl Into<String>) -> Self {
        Self::TypeConversion { from: from.into(), to: to.into() }
    }

    pub fn invalid_enum_variant(enum_name: impl Into<String>, value: impl Into<String>) -> Self {
        Self::InvalidEnumVariant { enum_name: enum_name.into(), value: value.into() }
    }

    pub fn overflow(type_name: impl Into<String>, value: impl Into<String>) -> Self {
        Self::Overflow { type_name: type_name.into(), value: value.into() }
    }

    pub fn missing_data(field: impl Into<String>) -> Self {
        Self::MissingData { field: field.into() }
    }
}

impl From<hex::FromHexError> for ConversionError {
    fn from(err: hex::FromHexError) -> Self {
        Self::HexParse { reason: err.to_string() }
    }
}

impl From<serde_json::Error> for ConversionError {
    fn from(err: serde_json::Error) -> Self {
        if err.is_data() {
            Self::DeserializationFailed { reason: err.to_string() }
        } else {
            Self::SerializationFailed { reason: err.to_string() }
        }
    }
}
