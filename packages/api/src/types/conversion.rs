//! High-level conversion utilities and error handling.
//!
//! This module provides the main conversion service and error types that
//! coordinate between different parts of the system.

use std::collections::HashMap;

use alloy_primitives::{Address, Bytes, TxKind};
use alloy_rpc_types::{
    state::{AccountOverride, StateOverride as AlloyStateOverride},
    TransactionRequest,
};

use super::{
    primitives::{FromHexString, PrimitiveError},
    shared::StateOverride,
    transaction::TransactionCall,
};

/// Main error type for all conversions in the application.
#[derive(Debug, Clone, thiserror::Error)]
pub enum ConversionError {
    #[error("Primitive conversion error: {0}")]
    Primitive(#[from] PrimitiveError),
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    #[error("Invalid hex value: {0}")]
    InvalidHexValue(String),
    #[error("Invalid numeric value: {0}")]
    InvalidNumeric(String),
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
    #[error("Conversion not supported: {0}")]
    NotSupported(String),
    #[error("Validation failed: {0}")]
    ValidationFailed(String),
    #[error("Configuration error: {0}")]
    ConfigError(String),
}

/// Main conversion service for the application.
pub struct ConversionService;

impl ConversionService {
    /// Convert API transaction call to Alloy transaction request.
    pub fn transaction_call_to_alloy(
        call: &TransactionCall,
    ) -> Result<TransactionRequest, ConversionError> {
        let mut tx = TransactionRequest::default();

        if let Some(from) = &call.from {
            tx.from = Some(Address::from_hex_string(from)?);
        }

        if let Some(to) = &call.to {
            let addr = Address::from_hex_string(to)?;
            tx.to = Some(TxKind::Call(addr));
        }

        if let Some(data) = &call.data {
            tx.input = Bytes::from_hex_string(data)?.into();
        }

        if let Some(value) = &call.value {
            tx.value = Some(alloy_primitives::U256::from_hex_string(value)?);
        }

        if let Some(gas) = &call.gas {
            let gas_u64 = super::primitives::parse_gas_from_hex(gas)?;
            tx.gas = Some(gas_u64);
        }

        Ok(tx)
    }

    /// Convert state overrides from API format to Alloy format.
    pub fn state_overrides_to_alloy(
        overrides: &HashMap<String, StateOverride>,
    ) -> Result<AlloyStateOverride, ConversionError> {
        let mut alloy_overrides = AlloyStateOverride::default();

        if overrides.is_empty() {
            return Ok(alloy_overrides);
        }

        for (address_str, override_data) in overrides {
            let address = Address::from_hex_string(address_str)?;
            let mut account_override = AccountOverride::default();

            if let Some(balance) = &override_data.balance {
                account_override.balance = Some(alloy_primitives::U256::from_hex_string(balance)?);
            }

            if let Some(nonce) = override_data.nonce {
                account_override.nonce = Some(nonce);
            }

            if let Some(code) = &override_data.code {
                account_override.code = Some(Bytes::from_hex_string(code)?);
            }

            if let Some(storage) = &override_data.storage {
                let mut storage_map = alloy_primitives::map::B256HashMap::default();
                for (slot_str, value_str) in storage {
                    let slot = alloy_primitives::B256::from_hex_string(slot_str)?;
                    let value = alloy_primitives::B256::from_hex_string(value_str)?;
                    storage_map.insert(slot, value);
                }
                account_override.state = Some(storage_map);
            }

            if let Some(state_diff) = &override_data.state_diff {
                let mut diff_map = alloy_primitives::map::B256HashMap::default();
                for (slot_str, value_str) in state_diff {
                    let slot = alloy_primitives::B256::from_hex_string(slot_str)?;
                    let value = alloy_primitives::B256::from_hex_string(value_str)?;
                    diff_map.insert(slot, value);
                }
                account_override.state_diff = Some(diff_map);
            }

            alloy_overrides.insert(address, account_override);
        }

        Ok(alloy_overrides)
    }
}

/// Extension trait for easier conversion access.
pub trait ConvertExt<T> {
    type Error;
    fn convert(self) -> Result<T, Self::Error>;
}

impl ConvertExt<TransactionRequest> for &TransactionCall {
    type Error = ConversionError;

    fn convert(self) -> Result<TransactionRequest, Self::Error> {
        ConversionService::transaction_call_to_alloy(self)
    }
}

impl ConvertExt<AlloyStateOverride> for &HashMap<String, StateOverride> {
    type Error = ConversionError;

    fn convert(self) -> Result<AlloyStateOverride, Self::Error> {
        ConversionService::state_overrides_to_alloy(self)
    }
}
