//! Address validation utilities.

use alloy_primitives::Address;
use std::str::FromStr;

use super::hex::validate_hex_format;
use crate::types::primitives::PrimitiveError;

/// Validate Ethereum address format.
pub fn validate_address_format(address: &str) -> Result<(), PrimitiveError> {
    validate_hex_format(address)?;

    if address.len() != 42 {
        return Err(PrimitiveError::InvalidAddress(format!(
            "Address must be 42 characters long: {} (length: {})",
            address,
            address.len()
        )));
    }

    Ok(())
}

/// Validate that an address is not the zero address for operations that require it.
pub fn validate_non_zero_address(address: &str) -> Result<(), PrimitiveError> {
    validate_address_format(address)?;

    const ZERO_ADDRESS: &str = "0x0000000000000000000000000000000000000000";
    if address.eq_ignore_ascii_case(ZERO_ADDRESS) {
        return Err(PrimitiveError::InvalidAddress(
            "Address cannot be zero address for this operation".to_string(),
        ));
    }

    Ok(())
}

/// Parse and validate an address.
pub fn parse_address(address_str: &str) -> Result<Address, PrimitiveError> {
    validate_address_format(address_str)?;
    Address::from_str(address_str).map_err(|e| PrimitiveError::InvalidAddress(e.to_string()))
}

/// Validate multiple addresses.
pub fn validate_addresses(addresses: &[String]) -> Result<(), PrimitiveError> {
    for addr in addresses {
        validate_address_format(addr)?;
    }
    Ok(())
}

// Custom validator functions for use with validator crate
crate::custom_validator!(address_format, validate_address_format);
crate::custom_validator!(non_zero_address, validate_non_zero_address);
