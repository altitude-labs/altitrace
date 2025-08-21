//! Validation utilities for request parameters and data.
//!
//! This module provides validation functions that are used across
//! different parts of the application to ensure data integrity.

use std::str::FromStr;

use alloy_primitives::Address;
use anyhow::anyhow;

use crate::types::primitives::{validate_address_format, validate_hex_format, PrimitiveError};

/// Validate a block number parameter (hex string or tag).
pub fn validate_block_parameter(param: &str) -> Result<(), PrimitiveError> {
    match param {
        "latest" | "earliest" | "safe" | "finalized" | "pending" => Ok(()),
        hex_str => {
            validate_hex_format(hex_str)?;
            // Additional validation that it's a valid number
            let without_prefix = hex_str.strip_prefix("0x").unwrap_or(hex_str);
            u64::from_str_radix(without_prefix, 16)
                .map_err(|e| PrimitiveError::InvalidNumeric(e.to_string()))?;
            Ok(())
        }
    }
}

/// Validate a transaction hash format.
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

/// Validate gas limit value.
pub fn validate_gas_limit(gas: u64) -> Result<(), PrimitiveError> {
    const MAX_GAS_LIMIT: u64 = 100_000_000; // 100M gas

    if gas == 0 {
        return Err(PrimitiveError::InvalidNumeric("Gas limit must be greater than 0".to_string()));
    }

    if gas > MAX_GAS_LIMIT {
        return Err(PrimitiveError::InvalidNumeric(format!(
            "Gas limit too high: {} (max: {})",
            gas, MAX_GAS_LIMIT
        )));
    }

    Ok(())
}

/// Validate gas price value.
pub fn validate_gas_price(price: u64) -> Result<(), PrimitiveError> {
    const MAX_GAS_PRICE: u64 = 1_000_000_000_000; // 1000 Gwei in wei

    if price > MAX_GAS_PRICE {
        return Err(PrimitiveError::InvalidNumeric(format!(
            "Gas price too high: {} (max: {})",
            price, MAX_GAS_PRICE
        )));
    }

    Ok(())
}

/// Validate that an address is not the zero address for operations that require it.
pub fn validate_non_zero_address(address: &str) -> Result<(), PrimitiveError> {
    validate_address_format(address)?;

    if let Ok(address) = Address::from_str(address) {
        if address == Address::ZERO {
            return Err(PrimitiveError::InvalidAddress(
                "Address cannot be zero address for this operation".to_string(),
            ));
        }
    }

    Ok(())
}

/// Validate call data size.
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

/// Validate value transfer amount.
pub fn validate_value_amount(value_str: &str) -> Result<(), PrimitiveError> {
    validate_hex_format(value_str)?;

    // Try to parse as U256 to ensure it's a valid number
    let _value = alloy_primitives::U256::from_str(value_str)
        .map_err(|e| PrimitiveError::InvalidNumeric(e.to_string()))?;

    Ok(())
}

/// Comprehensive transaction validation.
pub fn validate_transaction_call(
    from: Option<&str>,
    to: Option<&str>,
    data: Option<&str>,
    value: Option<&str>,
    gas: Option<&str>,
) -> Result<(), PrimitiveError> {
    if let Some(from_addr) = from {
        validate_address_format(from_addr)?;
    }

    if let Some(to_addr) = to {
        validate_address_format(to_addr)?;
    }

    if let Some(call_data) = data {
        validate_call_data_size(call_data)?;
    }

    if let Some(value_str) = value {
        validate_value_amount(value_str)?;
    }

    if let Some(gas_str) = gas {
        validate_hex_format(gas_str)?;
        let gas_limit = crate::types::primitives::parse_gas_from_hex(gas_str)?;
        validate_gas_limit(gas_limit)?;
    }

    Ok(())
}

/// Validation result type.
pub type ValidationResult = Result<(), PrimitiveError>;

/// Trait for types that can validate themselves.
pub trait Validate {
    fn validate(&self) -> ValidationResult;
}

/// Parse a block number from a string, which can be in either hexadecimal or decimal format.
pub fn parse_block_number(block_number: &str) -> Result<u64, anyhow::Error> {
    let block_num = if block_number.starts_with("0x") || block_number.starts_with("0X") {
        // Parse hexadecimal
        u64::from_str_radix(&block_number[2..], 16)
            .map_err(|e| anyhow!("Invalid hexadecimal block number format: {}", e))?
    } else {
        // Parse decimal
        block_number
            .parse::<u64>()
            .map_err(|e| anyhow!("Invalid decimal block number format: {}", e))?
    };

    Ok(block_num)
}

/// Helper function to provide default true value.
pub const fn default_true() -> bool {
    true
}

/// Helper function to provide default latest value.
pub fn default_latest() -> String {
    String::from("latest")
}

/// Helper macro for validation chains.
#[macro_export]
macro_rules! validate_chain {
    ($($validation:expr),* $(,)?) => {
        {
            $(
                $validation?;
            )*
            Ok(())
        }
    };
}
