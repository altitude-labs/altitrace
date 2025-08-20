//! Block parameter validation utilities.

use anyhow::anyhow;

use super::hex::validate_hex_format;
use crate::types::primitives::PrimitiveError;

/// Valid block tag values.
const VALID_BLOCK_TAGS: &[&str] = &["latest", "earliest", "safe", "finalized", "pending"];

/// Validate a block number parameter (hex string or tag).
pub fn validate_block_parameter(param: &str) -> Result<(), PrimitiveError> {
    // Check if it's a valid block tag
    if VALID_BLOCK_TAGS.contains(&param) {
        return Ok(());
    }

    // Otherwise, validate as hex number
    validate_hex_format(param)?;

    // Additional validation that it's a valid number
    let without_prefix = param.strip_prefix("0x").unwrap_or(param);
    u64::from_str_radix(without_prefix, 16)
        .map_err(|e| PrimitiveError::InvalidNumeric(e.to_string()))?;

    Ok(())
}

/// Parse a block number from a string (hex or decimal).
pub fn parse_block_number(block_number: &str) -> Result<u64, anyhow::Error> {
    // Check if it's a block tag first
    if VALID_BLOCK_TAGS.contains(&block_number) {
        return Err(anyhow!("Block tags must be resolved to numbers before parsing"));
    }

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

/// Check if a block parameter is a tag (not a number).
pub fn is_block_tag(param: &str) -> bool {
    VALID_BLOCK_TAGS.contains(&param)
}

/// Validate block range parameters.
pub fn validate_block_range(from: &str, to: &str) -> Result<(), PrimitiveError> {
    validate_block_parameter(from)?;
    validate_block_parameter(to)?;

    // If both are numeric, ensure from <= to
    if !is_block_tag(from) && !is_block_tag(to) {
        let from_num =
            parse_block_number(from).map_err(|e| PrimitiveError::InvalidNumeric(e.to_string()))?;
        let to_num =
            parse_block_number(to).map_err(|e| PrimitiveError::InvalidNumeric(e.to_string()))?;

        if from_num > to_num {
            return Err(PrimitiveError::ValidationFailed(format!(
                "From block {} cannot be greater than to block {}",
                from_num, to_num
            )));
        }
    }

    Ok(())
}

// Custom validator functions for use with validator crate
crate::custom_validator!(block_parameter, validate_block_parameter);
