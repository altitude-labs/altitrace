//! `HyperEVM`
//!  simulation service with Alloy integration.
//!
//! This module provides high-level simulation capabilities by wrapping
//! the raw RPC provider with business logic, validation, and response processing.

use crate::{
    handlers::simulation::{dto::*, response::*},
    parse_block_number,
    services::hyperevm::RpcProvider,
};

/// Represents different block context options for simulation.
#[derive(Debug, Clone)]
enum BlockContext {
    /// Use a specific block number
    Number(u64),
    /// Use a block tag (latest, earliest, etc.)
    Tag(BlockTag),
    /// Use default (latest) block
    Default,
}
use alloy_provider::Provider;
use alloy_rpc_types_eth::{
    simulate::{SimulatePayload, SimulatedBlock},
    TransactionRequest as AlloyTransactionRequest,
};
use anyhow::{anyhow, Result};
use std::time::Instant;
use tracing::{debug, error, trace};
use uuid::Uuid;

#[derive(Clone)]
pub struct HyperEvmService {
    provider: RpcProvider,
}

impl HyperEvmService {
    pub const fn new(provider: RpcProvider) -> Self {
        Self { provider }
    }

    /// Determines the appropriate block context for simulation.
    ///
    /// This method validates and parses block selection parameters:
    /// - Specific block numbers (hex encoded)
    /// - Block tags (latest, earliest, safe, finalized)
    /// - Default fallback to latest block
    fn determine_block_context(
        &self,
        params: &SimulationParams,
        simulation_id: &str,
    ) -> Result<BlockContext> {
        match (&params.block_number, &params.block_tag) {
            (Some(block_number), None) => {
                trace!(
                    target: "altitrace::simulation",
                    simulation_id = %simulation_id,
                    block_number = %block_number,
                    "Using specific block number for simulation"
                );
                let block_num = parse_block_number(block_number).map_err(|e| {
                    error!(
                        target: "altitrace::simulation",
                        simulation_id = %simulation_id,
                        error = ?e,
                        "Failed to parse block number"
                    );
                    anyhow!("Invalid block number format: {}", e)
                })?;
                Ok(BlockContext::Number(block_num))
            }
            (None, Some(block_tag)) => {
                trace!(
                    target: "altitrace::simulation",
                    simulation_id = %simulation_id,
                    block_tag = ?block_tag,
                    "Using block tag for simulation"
                );
                Ok(BlockContext::Tag(*block_tag))
            }
            (None, None) => Ok(BlockContext::Default),
            (Some(_), Some(_)) => {
                error!(
                    target: "altitrace::simulation",
                    simulation_id = %simulation_id,
                    "Both block_number and block_tag specified - this should be caught by validation"
                );
                Err(anyhow!("Cannot specify both block_number and block_tag"))
            }
        }
    }

    /// Simulate a single transaction or batch of calls using `eth_simulateV1`
    pub async fn simulate_transaction(
        &self,
        request: SimulationRequest,
    ) -> Result<SimulationResult> {
        let simulation_id = Uuid::new_v4().to_string();
        let start_time = Instant::now();

        let call_count = request.call_count();

        debug!(
            target: "altitrace::simulation",
            simulation_id = %simulation_id,
            calls_count = call_count,
            validation = request.params.validation,
            trace_transfers = request.params.trace_transfers,
            trace_asset_changes = request.params.trace_asset_changes,
            "Starting transaction simulation"
        );

        // Convert API request to Alloy's SimulatePayload
        let simulate_payload: SimulatePayload<AlloyTransactionRequest> =
            request.clone().try_into().map_err(|e| {
                error!(
                    target: "altitrace::simulation",
                    simulation_id = %simulation_id,
                    error = ?e,
                    "Failed to convert request to Alloy format"
                );
                anyhow!("Request conversion failed: {}", e)
            })?;

        trace!(
            target: "altitrace::simulation",
            simulation_id = %simulation_id,
            block_state_calls = simulate_payload.block_state_calls.len(),
            "Converted request to Alloy format"
        );

        // Determine the block context for simulation
        let simulation_rpc_req = match self
            .determine_block_context(&request.params, &simulation_id)?
        {
            BlockContext::Number(block_num) => self
                .provider
                .inner
                .simulate(&simulate_payload)
                .number(block_num),
            BlockContext::Tag(block_tag) => match block_tag {
                BlockTag::Latest => self.provider.inner.simulate(&simulate_payload).latest(),
                BlockTag::Earliest => self.provider.inner.simulate(&simulate_payload).earliest(),
                BlockTag::Finalized => self.provider.inner.simulate(&simulate_payload).finalized(),
                BlockTag::Safe => self.provider.inner.simulate(&simulate_payload).safe(),
            },
            BlockContext::Default => {
                trace!(
                    target: "altitrace::simulation",
                    simulation_id = %simulation_id,
                    "No block context specified, defaulting to latest"
                );
                self.provider.inner.simulate(&simulate_payload).latest()
            }
        };

        // Execute simulation via eth_simulateV1
        let simulated_blocks: Vec<SimulatedBlock> = match simulation_rpc_req.await {
            Ok(blocks) => blocks,
            Err(e) => {
                // Convert RPC errors into failed simulation results
                debug!(
                    target: "altitrace::simulation",
                    simulation_id = %simulation_id,
                    error = ?e,
                    "Simulation RPC call failed"
                );

                // Extract error message
                let error_msg = e.to_string();
                let call_error = CallError {
                    reason: error_msg.clone(),
                    error_type: "simulation-failed".to_string(),
                    message: Some(error_msg),
                    contract_address: None,
                };

                // Create a failed CallResult for each call in the request
                let call_results: Vec<CallResult> = (0..call_count)
                    .map(|index| CallResult {
                        call_index: index as u32,
                        status: CallStatus::Reverted,
                        return_data: "0x".to_string(),
                        gas_used: "0x0".to_string(),
                        logs: vec![],
                        error: Some(call_error.clone()),
                    })
                    .collect();

                // Return a failed simulation result instead of propagating the error
                return Ok(SimulationResult {
                    simulation_id,
                    status: SimulationStatus::Failed,
                    block_number: "0x0".to_string(),
                    calls: call_results,
                    gas_used: "0x0".to_string(),
                    block_gas_used: "0x0".to_string(),
                    asset_changes: None,
                    performance: None,
                    access_list: None,
                });
            }
        };

        if simulated_blocks.is_empty() {
            error!(
                target: "altitrace::simulation",
                simulation_id = %simulation_id,
                "No simulation results returned from RPC"
            );
            return Err(anyhow!("No simulation results returned"));
        }

        // Process the first (and expected only) block result
        let simulated_block = &simulated_blocks[0];
        let execution_time = start_time.elapsed();

        debug!(
            target: "altitrace::simulation",
            simulation_id = %simulation_id,
            block_number = ?simulated_block.inner.header.number,
            calls_processed = %simulated_block.calls.len(),
            execution_time_ms = ?execution_time,
            "Simulation completed successfully"
        );

        // Convert results back to our API format
        let call_results: Vec<CallResult> = simulated_block
            .calls
            .iter()
            .enumerate()
            .map(|(index, sim_call_result)| CallResult::from((index, sim_call_result.clone())))
            .collect();

        // Determine overall simulation status
        let status = if call_results
            .iter()
            .all(|r| matches!(r.status, CallStatus::Success))
        {
            SimulationStatus::Success
        } else {
            SimulationStatus::Failed
        };

        // Calculate total gas used across all calls
        let total_gas_used: u64 = call_results
            .iter()
            .map(|result| {
                u64::from_str_radix(result.gas_used.trim_start_matches("0x"), 16).unwrap_or(0)
            })
            .sum();

        let simulation_result = SimulationResult {
            simulation_id,
            status,
            block_number: format!("0x{:x}", simulated_block.inner.header.number),
            gas_used: format!("0x{:x}", total_gas_used),
            calls: call_results,
            block_gas_used: format!("0x{:x}", simulated_block.inner.header.gas_used),
            performance: None,
            asset_changes: None,
            access_list: None,
        };

        Ok(simulation_result)
    }

    /// Simulate multiple independent transactions
    pub async fn simulate_batch(
        &self,
        requests: Vec<SimulationRequest>,
    ) -> Result<Vec<SimulationResult>> {
        let batch_id = Uuid::new_v4().to_string();

        debug!(
            target: "altitrace::simulation",
            batch_id = %batch_id,
            batch_size = requests.len(),
            "Starting batch simulation"
        );

        if requests.is_empty() {
            return Err(anyhow!("Batch simulation requires at least one request"));
        }

        // Process simulations concurrently, collecting both successes and failures
        let mut futures = Vec::new();

        for req in requests {
            let simulation_id = Uuid::new_v4().to_string();
            let service = self.clone();

            let future = async move {
                match service.simulate_transaction(req).await {
                    Ok(mut result) => {
                        // Update the simulation_id to be unique for this batch item
                        result.simulation_id = simulation_id;
                        result
                    }
                    Err(e) => {
                        // This should rarely happen since simulate_transaction now handles most
                        // errors but we still need to handle conversion
                        // errors or other unexpected issues
                        error!(
                            target: "altitrace::simulation",
                            error = ?e,
                            "Unexpected error in batch simulation"
                        );

                        SimulationResult {
                            simulation_id,
                            status: SimulationStatus::Failed,
                            block_number: "0x0".to_string(),
                            calls: vec![CallResult {
                                call_index: 0,
                                status: CallStatus::Reverted,
                                return_data: "0x".to_string(),
                                gas_used: "0x0".to_string(),
                                logs: vec![],
                                error: Some(CallError {
                                    reason: e.to_string(),
                                    error_type: "simulation-error".to_string(),
                                    message: Some(e.to_string()),
                                    contract_address: None,
                                }),
                            }],
                            gas_used: "0x0".to_string(),
                            block_gas_used: "0x0".to_string(),
                            asset_changes: None,
                            performance: None,
                            access_list: None,
                        }
                    }
                }
            };

            futures.push(future);
        }

        let results: Vec<SimulationResult> = futures::future::join_all(futures).await;

        let successful_count = results
            .iter()
            .filter(|r| matches!(r.status, SimulationStatus::Success))
            .count();

        debug!(
            target: "altitrace::simulation",
            batch_id = %batch_id,
            successful_simulations = successful_count,
            failed_simulations = results.len() - successful_count,
            "Batch simulation completed"
        );

        Ok(results)
    }
}
