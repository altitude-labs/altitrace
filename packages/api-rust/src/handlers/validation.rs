use alloy_primitives::Address;
use regex::Regex;
use std::{str::FromStr, sync::LazyLock};
use validator::ValidationError;

/// Regular expression for validating hex strings (0x prefix followed by even number of hex chars)
static HEX_STRING_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^0x([a-fA-F0-9]{2})*$").expect("Invalid hex string regex"));

/// Regular expression for validating 32-byte hex strings (64 hex characters with 0x prefix)
static BYTES32_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^0x[a-fA-F0-9]{64}$").expect("Invalid bytes32 regex"));

/// Regular expression for validating uint256 hex values
static UINT256_HEX_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^0x[a-fA-F0-9]{1,64}$").expect("Invalid uint256 hex regex"));

/// Regular expression for validating decimal numbers
static DECIMAL_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\d+$").expect("Invalid decimal regex"));

/// Regular expression for validating block numbers (hex with 0x prefix)
static BLOCK_NUMBER_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^0x[a-fA-F0-9]+$").expect("Invalid block number regex"));

/// Valid block tags on `HyperEVM`
const VALID_BLOCK_TAGS: &[&str] = &["latest", "earliest", "safe", "finalized"];

/// Validates that a string is a valid EVM address.
///
/// # Examples
///
/// ```rust
/// use altitrace_api::handlers::validation::validate_address;
///
/// // Valid address
/// assert!(validate_address("0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c").is_ok());
///
/// // Invalid address (too short)
/// assert!(validate_address("0x742d35").is_err());
/// ```
pub fn validate_address(address: &str) -> Result<(), ValidationError> {
    match Address::from_str(address) {
        Ok(_) => Ok(()),
        Err(_) => Err(ValidationError::new("invalid_address")),
    }
}

/// Validates that a string is a valid hex string.
///
/// A valid hex string must start with "0x" followed by an even number
/// of hexadecimal characters (or be just "0x" for empty data).
pub fn validate_hex_string(hex_str: &str) -> Result<(), ValidationError> {
    if hex_str.is_empty() {
        return Err(ValidationError::new("Hex string cannot be empty"));
    }

    if hex_str == "0x" {
        return Ok(()); // Empty hex string is valid
    }

    if !HEX_STRING_REGEX.is_match(hex_str) {
        return Err(ValidationError::new(
            "Invalid hex string format. Must start with 0x followed by even number of hex \
             characters",
        ));
    }

    Ok(())
}

/// Validates that a string is a valid 32-byte hex string.
///
/// A valid bytes32 string must be exactly 64 hexadecimal characters
/// preceded by "0x" (total length: 66 characters).
pub fn validate_bytes32(bytes32_str: &str) -> Result<(), ValidationError> {
    if bytes32_str.is_empty() {
        return Err(ValidationError::new("Bytes32 string cannot be empty"));
    }

    if !BYTES32_REGEX.is_match(bytes32_str) {
        return Err(ValidationError::new(
            "Invalid bytes32 format. Must be exactly 64 hexadecimal characters with 0x prefix",
        ));
    }

    Ok(())
}

/// Validates that a string is a valid uint256 value.
///
/// Accepts either hexadecimal strings (with 0x prefix) or decimal strings.
/// Hexadecimal values can be up to 64 hex characters (256 bits).
pub fn validate_uint256(value_str: &str) -> Result<(), ValidationError> {
    if value_str.is_empty() {
        return Err(ValidationError::new("Uint256 value cannot be empty"));
    }

    if value_str.starts_with("0x") {
        if !UINT256_HEX_REGEX.is_match(value_str) {
            return Err(ValidationError::new(
                "Invalid hex uint256 format. Must be 0x followed by 1-64 hex characters",
            ));
        }
    } else if !DECIMAL_REGEX.is_match(value_str) {
        return Err(ValidationError::new(
            "Invalid decimal uint256 format. Must be a decimal number or hex string with 0x prefix",
        ));
    }

    // Additional validation for decimal strings to ensure they don't exceed uint256 max
    if !value_str.starts_with("0x") {
        // For very large numbers, we should validate against 2^256 - 1
        // This is a simplified check - in production, you might want to use a proper BigInt library
        if value_str.len() > 78 {
            // 2^256 - 1 has 78 decimal digits
            return Err(ValidationError::new(
                "Decimal uint256 value exceeds maximum value (2^256 - 1)",
            ));
        }
    }

    Ok(())
}

/// Validates that a string is either a valid block number or block tag.
///
/// Block numbers must be hexadecimal with 0x prefix.
/// Block tags must be one of: latest, earliest, safe, finalized.
pub fn validate_block_number_or_tag(block_ref: &str) -> Result<(), ValidationError> {
    if block_ref.is_empty() {
        return Err(ValidationError::new("Block reference cannot be empty"));
    }

    // Check if it's a valid block tag
    if VALID_BLOCK_TAGS.contains(&block_ref) {
        return Ok(());
    }

    // Check if it's a valid hex block number
    if BLOCK_NUMBER_REGEX.is_match(block_ref) {
        return Ok(());
    }

    Err(ValidationError::new(
        "Invalid block reference. Must be a hex block number (0x...) or valid block tag (latest, \
         earliest, pending, safe, finalized)",
    ))
}

/// Validates that a string is a valid block tag.
///
/// Valid block tags are: latest, earliest, safe, finalized.
pub fn validate_block_tag(block_tag: &str) -> Result<(), ValidationError> {
    if block_tag.is_empty() {
        return Err(ValidationError::new("Block tag cannot be empty"));
    }

    if !VALID_BLOCK_TAGS.contains(&block_tag) {
        return Err(ValidationError::new(
            "Invalid block tag. Must be one of: latest, earliest, pending, safe, finalized",
        ));
    }

    Ok(())
}

/// Validates that a string is valid calldata (transaction input data).
///
/// Calldata must be a valid hex string (can be empty "0x").
pub fn validate_calldata(calldata: &str) -> Result<(), ValidationError> {
    validate_hex_string(calldata)
}

/// Validates that a string represents a valid hex or decimal number.
///
/// This is a convenience function that combines uint256 validation
/// for use cases where both hex and decimal formats are acceptable.
pub fn validate_hex_or_decimal(value: &str) -> Result<(), ValidationError> {
    validate_uint256(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_address() {
        // Valid addresses
        assert!(validate_address("0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c").is_ok());
        assert!(validate_address("0x0000000000000000000000000000000000000000").is_ok());
        assert!(validate_address("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF").is_ok());
        assert!(validate_address("742d35Cc6634C0532925a3b844Bc9e7595f06e8c").is_ok()); // without 0x prefix

        // Invalid addresses
        assert!(validate_address("").is_err());
        assert!(validate_address("0x742d35").is_err()); // Too short
        assert!(validate_address("0x742d35Cc6634C0532925a3b844Bc9e7595f06e8cx").is_err()); // Invalid character
        assert!(validate_address("0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c1").is_err()); // Too long
    }

    #[test]
    fn test_validate_hex_string() {
        // Valid hex strings
        assert!(validate_hex_string("0x").is_ok()); // Empty is valid
        assert!(validate_hex_string("0x00").is_ok());
        assert!(validate_hex_string("0xa9059cbb").is_ok());
        assert!(validate_hex_string("0xDEADBEEF").is_ok());

        // Invalid hex strings
        assert!(validate_hex_string("").is_err()); // Empty string
        assert!(validate_hex_string("a9059cbb").is_err()); // No 0x prefix
        assert!(validate_hex_string("0xa9059cb").is_err()); // Odd number of characters
        assert!(validate_hex_string("0xZZZ").is_err()); // Invalid hex characters
    }

    #[test]
    fn test_validate_bytes32() {
        // Valid bytes32
        assert!(validate_bytes32(
            "0x0000000000000000000000000000000000000000000000000000000000000000"
        )
        .is_ok());
        assert!(validate_bytes32(
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        )
        .is_ok());

        // Invalid bytes32
        assert!(validate_bytes32("").is_err()); // Empty
        assert!(validate_bytes32("0x1234").is_err()); // Too short
        assert!(validate_bytes32(
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00"
        )
        .is_err()); // Too long
        assert!(validate_bytes32(
            "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        )
        .is_err()); // No 0x prefix
    }

    #[test]
    fn test_validate_uint256() {
        // Valid uint256 values
        assert!(validate_uint256("0x0").is_ok());
        assert!(validate_uint256("0x1234567890abcdef").is_ok());
        assert!(validate_uint256("1000000000000000000").is_ok()); // 1 ETH in wei
        assert!(validate_uint256("0").is_ok());

        // Invalid uint256 values
        assert!(validate_uint256("").is_err()); // Empty
        assert!(validate_uint256("0x").is_err()); // Just 0x
        assert!(validate_uint256("-123").is_err()); // Negative
        assert!(validate_uint256("abc").is_err()); // Invalid format
        assert!(validate_uint256("0xZZZ").is_err()); // Invalid hex
    }

    #[test]
    fn test_validate_block_number_or_tag() {
        // Valid block references
        assert!(validate_block_number_or_tag("latest").is_ok());
        assert!(validate_block_number_or_tag("0x123abc").is_ok());
        assert!(validate_block_number_or_tag("0x0").is_ok());

        // Invalid block references
        assert!(validate_block_number_or_tag("").is_err());
        assert!(validate_block_number_or_tag("invalid").is_err());
        assert!(validate_block_number_or_tag("123").is_err()); // Decimal number
        assert!(validate_block_number_or_tag("0x").is_err()); // Empty hex
    }

    #[test]
    fn test_validate_block_tag() {
        // Valid block tags
        assert!(validate_block_tag("latest").is_ok());
        assert!(validate_block_tag("earliest").is_ok());
        assert!(validate_block_tag("safe").is_ok());
        assert!(validate_block_tag("finalized").is_ok());

        // Invalid block tags
        assert!(validate_block_tag("").is_err());
        assert!(validate_block_tag("invalid").is_err());
        assert!(validate_block_tag("LATEST").is_err()); // Wrong case
        assert!(validate_block_tag("0x123").is_err()); // Block number, not tag
    }
}
