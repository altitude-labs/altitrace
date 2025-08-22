//! `HyperEVM`
//!  simulation service with Alloy integration.
//!
//! This module provides high-level simulation capabilities by wrapping
//! the raw RPC provider with business logic, validation, and response processing.

use crate::{
    handlers::{
        simulation::{dto::*, response::*},
        trace::*,
    },
    services::hyperevm::RpcProvider,
    types::{TraceResponse, TransactionReceiptInfo},
    utils::{generate_batch_id, generate_trace_id, validation::parse_block_number},
};

use alloy_primitives::B256;
use alloy_provider::{ext::DebugApi, Provider};
use alloy_rpc_types::BlockId;
use alloy_rpc_types_eth::{
    simulate::{SimulatePayload, SimulatedBlock},
    TransactionRequest as AlloyTransactionRequest,
};
use anyhow::{anyhow, Result};
use std::{str::FromStr, time::Instant};
use tracing::{debug, error, trace};
use uuid::Uuid;

/// Trait for types that can provide block context information.
///
/// This trait allows different parameter types to provide the necessary
/// information for determining block context (`block_number`, `block_tag`).
trait BlockContextProvider {
    /// Returns the optional block number (hex-encoded).
    fn block_number(&self) -> Option<u64>;

    /// Returns the optional block tag.
    fn block_tag(&self) -> Option<&BlockTag>;
}

/// Represents different block context options for simulation.
#[derive(Debug, Clone)]
enum BlockContext {
    /// Use a specific block number
    Number(u64),
    /// Use a block tag (latest, earliest, etc.)
    Tag(BlockTag),
}

impl std::default::Default for BlockContext {
    fn default() -> Self {
        Self::Tag(BlockTag::Latest)
    }
}

/// Implementation of `BlockContextProvider` for `SimulationParams`.
impl BlockContextProvider for SimulationParams {
    fn block_number(&self) -> Option<u64> {
        self.block_number
            .as_ref()
            .and_then(|bn| parse_block_number(bn).ok())
    }

    fn block_tag(&self) -> Option<&BlockTag> {
        self.block_tag.as_ref()
    }
}

#[derive(Clone)]
pub struct HyperEvmService {
    provider: RpcProvider,
}

impl HyperEvmService {
    pub const fn new(provider: RpcProvider) -> Self {
        Self { provider }
    }

    /// Determines the appropriate block context for any type that implements
    /// `BlockContextProvider`.
    ///
    /// This method validates and parses block selection parameters:
    /// - Specific block numbers (hex encoded)
    /// - Block tags (latest, earliest, safe, finalized)
    /// - Default fallback to latest block
    fn determine_block_context<T: BlockContextProvider>(
        &self,
        params: &T,
        context_id: &str,
    ) -> Result<BlockContext> {
        match (params.block_number(), params.block_tag()) {
            (Some(block_number), None) => {
                trace!(
                    target: "altitrace::simulation",
                    context_id = %context_id,
                    block_number = %block_number,
                    "Using specific block number for context"
                );
                Ok(BlockContext::Number(block_number))
            }
            (None, Some(block_tag)) => {
                trace!(
                    target: "altitrace::simulation",
                    context_id = %context_id,
                    block_tag = ?block_tag,
                    "Using block tag for context"
                );
                Ok(BlockContext::Tag(*block_tag))
            }
            (None, None) => {
                trace!(
                    target: "altitrace::simulation",
                    context_id = %context_id,
                    "No block context specified, defaulting to latest"
                );
                Ok(BlockContext::default())
            }
            (Some(_), Some(_)) => {
                error!(
                    target: "altitrace::simulation",
                    context_id = %context_id,
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
            asset_changes: None,
        };

        Ok(simulation_result)
    }

    /// Simulate multiple independent transactions
    pub async fn simulate_batch(
        &self,
        requests: Vec<SimulationRequest>,
    ) -> Result<Vec<SimulationResult>> {
        let batch_id = generate_batch_id();

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

    pub async fn trace_transaction(
        &self,
        request: &TraceTransactionRequest,
    ) -> Result<TraceResponse> {
        let trace_id = generate_trace_id();
        let tx_hash = B256::from_str(&request.transaction_hash)
            .map_err(|e| anyhow!("Invalid transaction hash: {}", e))?;

        let start_time = Instant::now();

        debug!(
            target: "altitrace::trace",
            %trace_id,
            "Starting trace"
        );

        // Create tracing strategy based on configuration
        let strategy = TracingStrategy::from_config(&request.tracer_config);

        debug!(
            target: "altitrace::trace",
            %trace_id,
            %strategy,
            "Tracing strategy"
        );

        let (trace_result, receipt_result) = tokio::join!(
            strategy.execute(tx_hash, |hash, options| {
                let provider = &self.provider.inner;
                async move { provider.debug_trace_transaction(hash, options).await }
            }),
            self.provider.inner.get_transaction_receipt(tx_hash)
        );

        let trace_result = trace_result?;
        let receipt = receipt_result?.ok_or_else(|| anyhow!("No receipt found for transaction"))?;
        let receipt = TransactionReceiptInfo::from(receipt);

        let elapsed_time = start_time.elapsed();

        debug!(
            target: "altitrace::trace",
            %trace_id,
            %trace_result,
            ?elapsed_time,
            "Tracing completed"
        );

        let trace_response = TraceResponse::new(trace_result).with_receipt(receipt);

        Ok(trace_response)
    }

    pub async fn trace_call(&self, request: &TraceCallRequest) -> Result<TraceResponse> {
        let block_id = BlockId::from_str(&request.block)?;

        let start_time = Instant::now();
        let trace_id = generate_trace_id();

        debug!(
            target: "altitrace::trace",
            %trace_id,
            %block_id,
            "Starting call trace"
        );

        let tracing_strategy = TracingStrategy::from_config(&request.tracer_config);

        let trace_result = tracing_strategy
            .execute_call(request.clone(), |tx_request, block_id, options| {
                let provider = &self.provider.inner;
                async move {
                    provider
                        .debug_trace_call(tx_request, block_id, options)
                        .await
                }
            })
            .await?;

        let elapsed_time = start_time.elapsed();

        debug!(
            target: "altitrace::trace",
            %trace_id,
            %trace_result,
            ?elapsed_time,
            "Tracing completed"
        );

        let trace_response = TraceResponse::new(trace_result);

        Ok(trace_response)
    }
}
