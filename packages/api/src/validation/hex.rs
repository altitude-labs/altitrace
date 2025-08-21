//! Hex string validation utilities.

use crate::types::primitives::PrimitiveError;

/// Validate hex string format (must start with 0x and contain valid hex characters).
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

/// Validate transaction hash format (must be 66 characters long).
pub fn validate_transaction_hash(hash: &str) -> Result<(), PrimitiveError> {
    validate_hex_format(hash)?;

    if hash.len() != 66 {
        return Err(PrimitiveError::InvalidHex(format!(
            "Transaction hash must be 66 characters long: {} (length: {})",
            hash,
            hash.len()
        )));
    }

    Ok(())
}

/// Validate call data size (must not exceed maximum).
pub fn validate_call_data_size(data: &str) -> Result<(), PrimitiveError> {
    const MAX_CALL_DATA_SIZE: usize = 1_000_000; // 1MB in bytes

    validate_hex_format(data)?;

    let data_bytes = (data.len() - 2) / 2; // Subtract "0x" prefix and divide by 2

    if data_bytes > MAX_CALL_DATA_SIZE {
        return Err(PrimitiveError::InvalidHex(format!(
            "Call data too large: {} bytes (max: {} bytes)",
            data_bytes, MAX_CALL_DATA_SIZE
        )));
    }

    Ok(())
}

/// Validate value amount (must be a valid U256).
pub fn validate_value_amount(value_str: &str) -> Result<(), PrimitiveError> {
    validate_hex_format(value_str)?;

    // Try to parse as U256 to ensure it's a valid number
    let _value = alloy_primitives::U256::from_str_radix(
        value_str.strip_prefix("0x").unwrap_or(value_str),
        16,
    )
    .map_err(|e| PrimitiveError::InvalidNumeric(e.to_string()))?;

    Ok(())
}

/// Parse gas value from hex string.
pub fn parse_gas_from_hex(s: &str) -> Result<u64, PrimitiveError> {
    let without_prefix = s.strip_prefix("0x").unwrap_or(s);
    u64::from_str_radix(without_prefix, 16)
        .map_err(|e| PrimitiveError::InvalidNumeric(e.to_string()))
}

/// Helper function to format values as hex strings.
pub fn to_hex_with_prefix<T: std::fmt::LowerHex>(value: T) -> String {
    format!("0x{:x}", value)
}

// Custom validator functions for use with validator crate
crate::custom_validator!(hex_format, validate_hex_format);
crate::custom_validator!(transaction_hash, validate_transaction_hash);
crate::custom_validator!(call_data_size, validate_call_data_size);
crate::custom_validator!(value_amount, validate_value_amount);
