//! Conversion utilities between API DTOs and Alloy RPC types.
//!
//! This module provides clean, type-safe conversions between our API request/response
//! types and the corresponding Alloy RPC types used for `HyperEVM` communication.

use super::{dto::*, response::*};
use crate::types::{shared::StateOverride, BlockOverrides, TransactionCall};
use alloy_primitives::{map::B256HashMap, Address, Bytes, TxKind, B256, U256};
use alloy_rpc_types_eth::{
    simulate::{SimBlock, SimCallResult, SimulatePayload},
    state::StateOverride as AlloyStateOverride,
    BlockOverrides as AlloyBlockOverrides, TransactionInput,
    TransactionRequest as AlloyTransactionRequest,
};
use anyhow::{anyhow, Result};
use std::str::FromStr;

/// Converts our API [`SimulationRequest`] to Alloy's [`SimulatePayload`]
impl TryFrom<SimulationRequest> for SimulatePayload<AlloyTransactionRequest> {
    type Error = anyhow::Error;

    fn try_from(request: SimulationRequest) -> Result<Self> {
        let params = request.params;
        let options = request.options;

        // Convert calls to Alloy TransactionRequest
        let alloy_calls: Result<Vec<AlloyTransactionRequest>> =
            params.calls.into_iter().map(TryInto::try_into).collect();

        let calls = alloy_calls?;

        // Build SimBlock with overrides
        let mut sim_block = SimBlock { calls, block_overrides: None, state_overrides: None };

        // Add state overrides if present
        if let Some(options) = options {
            if let Some(state_overrides) = options.state_overrides {
                sim_block.state_overrides = Some(convert_state_overrides(state_overrides)?);
            }

            if let Some(block_overrides) = options.block_overrides {
                sim_block.block_overrides = Some(convert_block_overrides(block_overrides)?);
            }
        }

        // Build SimulatePayload
        let payload = Self {
            block_state_calls: vec![sim_block],
            trace_transfers: params.trace_transfers,
            validation: params.validation,
            return_full_transactions: false, // We handle this in response processing
        };

        Ok(payload)
    }
}

/// Converts our API [`TransactionCall`] to Alloy's
/// [`TransactionRequest`](alloy_primitives::TransactionRequest)
impl TryFrom<TransactionCall> for AlloyTransactionRequest {
    type Error = anyhow::Error;

    fn try_from(call: TransactionCall) -> Result<Self> {
        let mut tx_request = Self::default();

        if let Some(to_str) = call.to {
            let address = Address::from_str(&to_str)
                .map_err(|e| anyhow!("Invalid 'to' address '{}': {}", to_str, e))?;
            tx_request.to = Some(TxKind::Call(address));
        }

        if let Some(from_str) = call.from {
            let address = Address::from_str(&from_str)
                .map_err(|e| anyhow!("Invalid 'from' address '{}': {}", from_str, e))?;
            tx_request.from = Some(address);
        }

        if let Some(data_str) = call.data {
            let bytes = Bytes::from_str(&data_str)
                .map_err(|e| anyhow!("Invalid 'data' hex '{}': {}", data_str, e))?;
            tx_request.input = TransactionInput { input: Some(bytes), data: None };
        }

        if let Some(value_str) = call.value {
            let value = U256::from_str(&value_str)
                .map_err(|e| anyhow!("Invalid 'value' '{}': {}", value_str, e))?;
            tx_request.value = Some(value);
        }

        if let Some(gas_str) = call.gas {
            let gas = u64::from_str_radix(gas_str.trim_start_matches("0x"), 16)
                .map_err(|e| anyhow!("Invalid 'gas' '{}': {}", gas_str, e))?;
            tx_request.gas = Some(gas);
        }

        if let Some(access_list) = call.access_list {
            tx_request.access_list = Some(access_list.into());
        }

        Ok(tx_request)
    }
}

/// Converts our API [`StateOverride`] list to Alloy's [`StateOverride`] map
fn convert_state_overrides(overrides: Vec<StateOverride>) -> Result<AlloyStateOverride> {
    let mut alloy_overrides = AlloyStateOverride::default();

    for override_entry in overrides {
        let address = Address::from_str(&override_entry.clone().address.unwrap_or_default())
            .map_err(|e| {
                anyhow!("Invalid address '{}': {}", override_entry.address.unwrap_or_default(), e)
            })?;

        let mut alloy_override = alloy_rpc_types_eth::state::AccountOverride::default();

        // Convert balance
        if let Some(balance_str) = override_entry.balance {
            let balance = U256::from_str(&balance_str)
                .map_err(|e| anyhow!("Invalid balance '{}': {}", balance_str, e))?;
            alloy_override.balance = Some(balance);
        }

        // Convert nonce
        if let Some(nonce) = override_entry.nonce {
            alloy_override.nonce = Some(nonce);
        }

        // Convert code
        if let Some(code_str) = override_entry.code {
            let code = Bytes::from_str(&code_str)
                .map_err(|e| anyhow!("Invalid code '{}': {}", code_str, e))?;
            alloy_override.code = Some(code);
        }

        // Convert state or state_diff
        if let Some(state_slots) = override_entry.state {
            let state_map = state_slots
                .into_iter()
                .map(|slot| {
                    let slot_key = B256::from_str(&slot.slot)
                        .map_err(|e| anyhow!("Invalid slot key '{}': {}", slot.slot, e))?;
                    let slot_value = B256::from_str(&slot.value)
                        .map_err(|e| anyhow!("Invalid slot value '{}': {}", slot.value, e))?;
                    Ok((slot_key, slot_value))
                })
                .collect::<Result<B256HashMap<B256>>>()?;
            alloy_override.state = Some(state_map);
        } else if let Some(state_diff_slots) = override_entry.state_diff {
            let state_diff_map = state_diff_slots
                .into_iter()
                .map(|(slot_key, slot_value)| {
                    let slot_key = B256::from_str(&slot_key)
                        .map_err(|e| anyhow!("Invalid slot key '{}': {}", slot_key, e))?;
                    let slot_value = B256::from_str(&slot_value)
                        .map_err(|e| anyhow!("Invalid slot value '{}': {}", slot_value, e))?;
                    Ok((slot_key, slot_value))
                })
                .collect::<Result<B256HashMap<B256>>>()?;
            alloy_override.state_diff = Some(state_diff_map);
        }

        alloy_overrides.insert(address, alloy_override);
    }

    Ok(alloy_overrides)
}

/// Converts our API [`BlockOverrides`] to Alloy's [`BlockOverrides`]
pub fn convert_block_overrides(overrides: BlockOverrides) -> Result<AlloyBlockOverrides> {
    let mut alloy_overrides = AlloyBlockOverrides::default();

    // Convert block number
    if let Some(number_str) = overrides.number {
        let number = U256::from_str(&number_str)
            .map_err(|e| anyhow!("Invalid block number '{}': {}", number_str, e))?;
        alloy_overrides.number = Some(number);
    }

    // Convert timestamp
    if let Some(time) = overrides.time {
        alloy_overrides.time = Some(time);
    }

    // Convert gas limit
    if let Some(gas_limit) = overrides.gas_limit {
        alloy_overrides.gas_limit = Some(gas_limit);
    }

    // Convert coinbase
    if let Some(coinbase_str) = overrides.coinbase {
        let coinbase = Address::from_str(&coinbase_str)
            .map_err(|e| anyhow!("Invalid coinbase '{}': {}", coinbase_str, e))?;
        alloy_overrides.coinbase = Some(coinbase);
    }

    // Convert base fee
    if let Some(base_fee_str) = overrides.base_fee {
        let base_fee = U256::from_str(&base_fee_str)
            .map_err(|e| anyhow!("Invalid base fee '{}': {}", base_fee_str, e))?;
        alloy_overrides.base_fee = Some(base_fee);
    }

    // Convert prevRandao/random
    if let Some(random_str) = overrides.random {
        let random_b256 = B256::from_str(&random_str)
            .map_err(|e| anyhow!("Invalid random '{}': {}", random_str, e))?;
        alloy_overrides.random = Some(random_b256);
    }

    Ok(alloy_overrides)
}

/// Converts Alloy's [`SimCallResult`] to our API [`CallResult`]
impl From<(usize, SimCallResult)> for CallResult {
    fn from((index, alloy_result): (usize, SimCallResult)) -> Self {
        let status = if alloy_result.status { CallStatus::Success } else { CallStatus::Reverted };

        let return_data = format!("0x{}", hex::encode(&alloy_result.return_data));
        let gas_used = format!("0x{:x}", alloy_result.gas_used);

        // Convert logs
        let logs = alloy_result
            .logs
            .into_iter()
            .map(|log| EnhancedLog {
                address: format!("0x{:x}", log.address()),
                block_hash: None,   // Simulation logs don't have block hash
                block_number: None, // Will be filled in by response processor
                data: format!("0x{}", hex::encode(&log.data().data)),
                log_index: Some(format!("0x{:x}", log.log_index.unwrap_or_default())),
                transaction_hash: None, // Simulation logs don't have tx hash
                transaction_index: None,
                topics: log
                    .topics()
                    .iter()
                    .map(|topic| format!("0x{:x}", topic))
                    .collect(),
                removed: false,
                decoded: None, // Will be filled in by event decoder
            })
            .collect();

        // Convert error if present
        let error = alloy_result.error.map(|sim_error| CallError {
            reason: extract_revert_reason(&sim_error.message),
            error_type: match sim_error.code {
                -3200 => "execution-reverted".to_string(),
                -32015 => "vm-execution-error".to_string(),
                _ => "unknown-error".to_string(),
            },
            message: Some(sim_error.message),
            contract_address: None, // Could be extracted from context if needed
        });

        Self { call_index: index as u32, status, return_data, gas_used, logs, error }
    }
}

/// Helper function to extract clean revert reason from error message
fn extract_revert_reason(message: &str) -> String {
    // Common patterns in revert messages
    if let Some(start) = message.find("execution reverted: ") {
        message[start + 20..].to_string()
    } else if let Some(start) = message.find("revert ") {
        message[start + 7..].to_string()
    } else if message.contains("out of gas") {
        "Out of gas".to_string()
    } else if message.contains("insufficient funds") {
        "Insufficient funds".to_string()
    } else {
        message.to_string()
    }
}

/// Batch conversion utilities
impl TryFrom<BatchSimulationRequest> for Vec<SimulatePayload<AlloyTransactionRequest>> {
    type Error = anyhow::Error;

    fn try_from(batch_request: BatchSimulationRequest) -> Result<Self> {
        let payloads: Result<Self> = batch_request
            .simulations
            .into_iter()
            .map(TryInto::try_into)
            .collect();
        payloads
    }
}

/// Bundle simulation conversion
impl TryFrom<BundleSimulationRequest> for Vec<SimulatePayload<AlloyTransactionRequest>> {
    type Error = anyhow::Error;

    fn try_from(bundle_request: BundleSimulationRequest) -> Result<Self> {
        let mut payloads = Self::default();
        let base_block_overrides = bundle_request.block_overrides;
        let cumulative_state_overrides = bundle_request.state_overrides.unwrap_or_default();

        for bundle_tx in bundle_request.bundle {
            // Convert bundle transaction to simulation request
            let simulation_request = SimulationRequest {
                params: SimulationParams {
                    calls: bundle_tx.calls,
                    account: bundle_tx.account,
                    block_number: bundle_request.block_number.clone(),
                    block_tag: bundle_request.block_tag,
                    validation: !bundle_tx.allow_failure,
                    trace_asset_changes: bundle_request.trace_asset_changes,
                    trace_transfers: bundle_request.trace_transfers,
                },
                options: Some(SimulationOptions {
                    state_overrides: Some(cumulative_state_overrides.clone()),
                    block_overrides: base_block_overrides.clone(),
                }),
            };

            let payload: SimulatePayload<AlloyTransactionRequest> =
                simulation_request.try_into()?;
            payloads.push(payload);

            // Note: In a real implementation, we'd extract state changes from each
            // simulation result and apply them to cumulative_state_overrides
            // This requires running simulations sequentially and parsing results
        }

        Ok(payloads)
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::types::StorageSlot;

    use super::*;

    #[test]
    fn test_transaction_call_conversion() {
        let api_call = TransactionCall {
            to: Some("0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c".to_string()),
            from: Some("0x123d35Cc6634C0532925a3b844Bc9e7595f06e8c".to_string()),
            data: Some("0xa9059cbb".to_string()),
            value: Some("0x1000".to_string()),
            gas: Some("0x5208".to_string()),
            access_list: None,
        };

        let alloy_request: AlloyTransactionRequest = api_call.try_into().unwrap();

        assert!(alloy_request.to.is_some());
        assert!(alloy_request.from.is_some());
        assert!(alloy_request.input.input.is_some());
        assert!(alloy_request.value.is_some());
        assert!(alloy_request.gas.is_some());
    }

    #[test]
    fn test_simulation_request_conversion() {
        let api_request = SimulationRequest {
            params: SimulationParams {
                calls: vec![TransactionCall {
                    to: Some("0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c".to_string()),
                    from: None,
                    data: Some("0xa9059cbb".to_string()),
                    value: None,
                    gas: None,
                    access_list: None,
                }],
                account: Some("0x123d35Cc6634C0532925a3b844Bc9e7595f06e8c".to_string()),
                block_number: Some("0x123abc".to_string()),
                block_tag: None,
                validation: true,
                trace_asset_changes: true,
                trace_transfers: false,
            },
            options: None,
        };

        let alloy_payload: SimulatePayload<AlloyTransactionRequest> =
            api_request.try_into().unwrap();

        assert_eq!(alloy_payload.block_state_calls.len(), 1);
        assert_eq!(alloy_payload.block_state_calls[0].calls.len(), 1);
        assert!(alloy_payload.validation);
        assert!(!alloy_payload.trace_transfers);
    }

    #[test]
    fn test_state_override_conversion() {
        let api_overrides = vec![StateOverride {
            address: Some("0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c".to_string()),
            balance: Some("0x1000000000000000000".to_string()),
            nonce: Some(5),
            code: Some("0x6080604052".to_string()),
            state: Some(vec![StorageSlot {
                slot: "0x0000000000000000000000000000000000000000000000000000000000000001"
                    .to_string(),
                value: "0x0000000000000000000000000000000000000000000000000000000000000064"
                    .to_string(),
            }]),
            storage: Some(HashMap::new()),
            state_diff: None,
            move_precompile_to_address: None,
        }];

        let alloy_overrides = convert_state_overrides(api_overrides).unwrap();
        assert_eq!(alloy_overrides.len(), 1);

        let address: Address = "0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c"
            .parse()
            .unwrap();
        let override_entry = alloy_overrides.get(&address).unwrap();

        assert!(override_entry.balance.is_some());
        assert_eq!(override_entry.nonce, Some(5));
        assert!(override_entry.code.is_some());
        assert!(override_entry.state.is_some());
    }

    #[test]
    fn test_user_json_structure() {
        let json = r#"{
            "params": {
                "calls": [
                    {
                        "data": "0xa9059cbb000000000000000000000000",
                        "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c",
                        "gas": "0x7a120",
                        "to": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                        "value": "0x1"
                    }
                ],
                "account": "0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c",
                "blockNumber": "0x123abc",
                "blockTag": null,
                "traceAssetChanges": false,
                "traceTransfers": false,
                "validation": true
            },
            "options": {
                "stateOverrides": [
                    {
                        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c",
                        "balance": "0x10000000000000"
                    }
                ]
            }
        }"#;

        let request: SimulationRequest = serde_json::from_str(json).expect("Failed to parse JSON");
        assert!(request.options.is_some());

        let options = request.options.as_ref().unwrap();
        assert!(options.state_overrides.is_some());

        let state_overrides = options.state_overrides.as_ref().unwrap();
        assert_eq!(state_overrides.len(), 1);
        assert_eq!(
            state_overrides[0].address,
            Some("0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c".to_string())
        );
        assert_eq!(state_overrides[0].balance, Some("0x10000000000000".to_string()));

        // Now test the full conversion to Alloy format
        let alloy_payload: SimulatePayload<AlloyTransactionRequest> = request
            .try_into()
            .expect("Failed to convert to Alloy format");

        assert_eq!(alloy_payload.block_state_calls.len(), 1);
        let sim_block = &alloy_payload.block_state_calls[0];

        assert!(sim_block.state_overrides.is_some(), "State overrides should be present");

        let state_overrides = sim_block.state_overrides.as_ref().unwrap();
        assert_eq!(state_overrides.len(), 1);

        let address: Address = "0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c"
            .parse()
            .unwrap();
        let override_entry = state_overrides.get(&address).unwrap();
        assert!(override_entry.balance.is_some());
    }
}
