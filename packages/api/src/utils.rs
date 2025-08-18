use anyhow::anyhow;

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
