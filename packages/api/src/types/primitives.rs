//! Primitive types and basic conversions.
//!
//! This module provides fundamental types and conversions that are used
//! throughout the application, particularly for blockchain primitives.

use std::{fmt, str::FromStr};

use alloy_primitives::{Address, Bytes, B256, U256};
use serde::{Deserialize, Serialize};

/// Error type for primitive conversions.
#[derive(Debug, Clone, thiserror::Error)]
pub enum PrimitiveError {
    #[error("Invalid hex format: {0}")]
    InvalidHex(String),
    #[error("Invalid address format: {0}")]
    InvalidAddress(String),
    #[error("Invalid numeric value: {0}")]
    InvalidNumeric(String),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Validation failed: {0}")]
    ValidationFailed(String),
}

/// Trait for types that can convert to hex strings with 0x prefix.
pub trait ToHexString {
    fn to_hex_string(&self) -> String;
}

/// Trait for types that can be parsed from hex strings.
pub trait FromHexString: Sized {
    type Error;
    fn from_hex_string(s: &str) -> Result<Self, Self::Error>;
}

/// Wrapper type for hex-encoded strings that validates format.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HexString(String);

impl HexString {
    /// Create a new hex string, validating the format.
    pub fn new(s: String) -> Result<Self, PrimitiveError> {
        validate_hex_format(&s)?;
        Ok(Self(s))
    }

    /// Create a hex string without validation (use with caution).
    pub const fn new_unchecked(s: String) -> Self {
        Self(s)
    }

    /// Get the inner string.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Convert to owned string.
    pub fn into_string(self) -> String {
        self.0
    }

    /// Get the hex value without the 0x prefix.
    pub fn without_prefix(&self) -> &str {
        self.0.strip_prefix("0x").unwrap_or(&self.0)
    }
}

impl fmt::Display for HexString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<HexString> for String {
    fn from(hex: HexString) -> Self {
        hex.0
    }
}

impl TryFrom<String> for HexString {
    type Error = PrimitiveError;

    fn try_from(s: String) -> Result<Self, Self::Error> {
        Self::new(s)
    }
}

/// Generic difference type for before/after values.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Diff<T> {
    pub before: T,
    pub after: T,
}

impl<T> Diff<T> {
    pub const fn new(before: T, after: T) -> Self {
        Self { before, after }
    }
}

/// Implementations for common primitive types.
impl<T> ToHexString for T
where
    T: fmt::LowerHex,
{
    fn to_hex_string(&self) -> String {
        format!("0x{:x}", self)
    }
}

impl FromHexString for U256 {
    type Error = PrimitiveError;

    fn from_hex_string(s: &str) -> Result<Self, Self::Error> {
        Self::from_str(s).map_err(|e| PrimitiveError::InvalidHex(e.to_string()))
    }
}

impl FromHexString for Address {
    type Error = PrimitiveError;

    fn from_hex_string(s: &str) -> Result<Self, Self::Error> {
        Self::from_str(s).map_err(|e| PrimitiveError::InvalidAddress(e.to_string()))
    }
}

impl FromHexString for Bytes {
    type Error = PrimitiveError;

    fn from_hex_string(s: &str) -> Result<Self, Self::Error> {
        Self::from_str(s).map_err(|e| PrimitiveError::InvalidHex(e.to_string()))
    }
}

impl FromHexString for B256 {
    type Error = PrimitiveError;

    fn from_hex_string(s: &str) -> Result<Self, Self::Error> {
        Self::from_str(s).map_err(|e| PrimitiveError::InvalidHex(e.to_string()))
    }
}

/// Validation functions.
pub fn validate_hex_format(s: &str) -> Result<(), PrimitiveError> {
    if !s.starts_with("0x") {
        return Err(PrimitiveError::InvalidHex(format!("Hex string must start with '0x': {}", s)));
    }

    if s.len() & 1 == 0 {
        return Err(PrimitiveError::InvalidHex(format!("Hex string must have even length: {}", s)));
    }

    for char in s[2..].chars() {
        if !char.is_ascii_hexdigit() {
            return Err(PrimitiveError::InvalidHex(format!(
                "Invalid hex character '{}' in: {}",
                char, s
            )));
        }
    }

    Ok(())
}

pub fn validate_address_format(s: &str) -> Result<(), PrimitiveError> {
    validate_hex_format(s)?;

    if s.len() != 42 {
        return Err(PrimitiveError::InvalidAddress(format!(
            "Address must be 42 characters long: {} (length: {})",
            s,
            s.len()
        )));
    }

    Ok(())
}

/// Helper function to parse gas values from hex strings.
pub fn parse_gas_from_hex(s: &str) -> Result<u64, PrimitiveError> {
    let without_prefix = s.strip_prefix("0x").unwrap_or(s);
    u64::from_str_radix(without_prefix, 16)
        .map_err(|e| PrimitiveError::InvalidNumeric(e.to_string()))
}

/// Helper function to format gas values as hex strings.
pub fn gas_to_hex_string(gas: u64) -> String {
    format!("0x{:x}", gas)
}
