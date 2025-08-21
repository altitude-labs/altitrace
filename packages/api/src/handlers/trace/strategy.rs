use alloy_primitives::TxHash;
use alloy_rpc_types::{BlockId, TransactionRequest as AlloyTransactionRequest};
use alloy_rpc_types_eth::{state::StateOverride, BlockOverrides};
use alloy_rpc_types_trace::geth::{
    DefaultFrame, GethDebugTracerConfig, GethDebugTracingCallOptions, GethDebugTracingOptions,
    GethTrace,
};
use std::{future::Future, str::FromStr};

use crate::{
    handlers::{
        simulation::conversion::convert_block_overrides,
        trace::{TraceCallRequest, TraceConfig, Tracers},
    },
    types::conversion::ConversionService,
};

/// Represents the different tracing strategies based on tracer configuration
#[derive(Debug, Clone)]
pub enum TracingStrategy {
    /// Only struct logger is active - single call with default tracer
    StructLoggerOnly(GethDebugTracingOptions),
    /// Only non-struct tracers are active - single call with mux or individual tracer
    TracersOnly(GethDebugTracingOptions),
    /// Both struct logger and other tracers are active - requires dual calls
    Hybrid {
        tracers_options: GethDebugTracingOptions,
        struct_logger_options: GethDebugTracingOptions,
    },
}

impl TracingStrategy {
    /// Create a tracing strategy from trace configuration
    pub fn from_config(config: &TraceConfig) -> Self {
        let tracers = &config.tracers;
        let active_count = tracers.count_active_tracers();
        let has_struct_logger = tracers.struct_logger.is_some();

        match (active_count, has_struct_logger) {
            // Only struct logger, no other tracers
            (0, true) => {
                let options = GethDebugTracingOptions {
                    config: tracers.struct_logger.as_ref().unwrap().into(),
                    tracer: None, // Default struct logger
                    tracer_config: GethDebugTracerConfig::default(),
                    timeout: None,
                };
                Self::StructLoggerOnly(options)
            }
            // Only other tracers, no struct logger
            (count, false) if count > 0 => {
                let options = GethDebugTracingOptions::from(config);
                Self::TracersOnly(options)
            }
            // Both struct logger and other tracers - dual call needed
            (count, true) if count > 0 => {
                // Create options for non-struct tracers (will use mux if count >= 2)
                let tracers_config = TraceConfig {
                    tracers: Tracers {
                        four_byte_tracer: tracers.four_byte_tracer,
                        call_tracer: tracers.call_tracer.clone(),
                        prestate_tracer: tracers.prestate_tracer.clone(),
                        struct_logger: None, // Exclude struct logger
                    },
                };
                let tracers_options = GethDebugTracingOptions::from(&tracers_config);

                // Create options for struct logger only
                let struct_logger_options = GethDebugTracingOptions {
                    config: tracers.struct_logger.as_ref().unwrap().into(),
                    tracer: None,
                    tracer_config: GethDebugTracerConfig::default(),
                    timeout: None,
                };

                Self::Hybrid { tracers_options, struct_logger_options }
            }
            // No tracers at all - fallback to default
            _ => {
                let options = GethDebugTracingOptions::default();
                Self::TracersOnly(options)
            }
        }
    }

    /// Create call options from tracing options with optional overrides
    fn create_call_options(
        &self,
        base_options: &GethDebugTracingOptions,
        state_overrides: Option<StateOverride>,
        block_overrides: Option<BlockOverrides>,
    ) -> GethDebugTracingCallOptions {
        let mut call_options = GethDebugTracingCallOptions::new(base_options.clone());
        if let Some(state_overrides) = state_overrides {
            call_options = call_options.with_state_overrides(state_overrides);
        }
        if let Some(block_overrides) = block_overrides {
            call_options = call_options.with_block_overrides(block_overrides);
        }
        call_options
    }

    /// Execute transaction trace
    pub async fn execute<F, Fut, E>(&self, tx_hash: TxHash, trace_fn: F) -> Result<TracingResult, E>
    where
        F: Fn(TxHash, GethDebugTracingOptions) -> Fut + Clone,
        Fut: Future<Output = Result<GethTrace, E>>,
    {
        match self {
            Self::StructLoggerOnly(options) | Self::TracersOnly(options) => {
                let trace = trace_fn(tx_hash, options.clone()).await?;
                Ok(TracingResult::Single(trace))
            }
            Self::Hybrid { tracers_options, struct_logger_options } => {
                // Execute both calls concurrently for better performance
                let tracers_fut = trace_fn(tx_hash, tracers_options.clone());
                let struct_logger_fut = trace_fn(tx_hash, struct_logger_options.clone());

                let (tracers_trace, struct_logger_trace) =
                    tokio::try_join!(tracers_fut, struct_logger_fut)?;

                Ok(TracingResult::Dual {
                    tracers_trace,
                    struct_logger_trace: Box::new(struct_logger_trace),
                })
            }
        }
    }

    /// Execute call trace with overrides
    pub async fn execute_call<F, Fut, E>(
        &self,
        call_request: TraceCallRequest,
        trace_fn: F,
    ) -> Result<TracingResult, E>
    where
        F: Fn(AlloyTransactionRequest, BlockId, GethDebugTracingCallOptions) -> Fut + Clone,
        Fut: Future<Output = Result<GethTrace, E>>,
    {
        let TraceCallRequest {
            call,
            block,
            tracer_config: _,
            state_overrides,
            block_overrides,
            ..
        } = call_request;

        let block_overrides = convert_block_overrides(block_overrides.unwrap_or_default())
            .map_err(|e| eyre::anyhow!("Failed to convert block overrides: {}", e))
            .ok();
        let state_overrides =
            ConversionService::state_overrides_to_alloy(&state_overrides.unwrap_or_default())
                .map_err(|e| eyre::anyhow!("Failed to convert state overrides: {}", e))
                .ok();
        let tx_request = AlloyTransactionRequest::try_from(call)
            .map_err(|e| eyre::anyhow!("Failed to convert call: {}", e))
            .unwrap();
        let block_id = BlockId::from_str(&block).unwrap_or_default();

        match self {
            Self::StructLoggerOnly(options) | Self::TracersOnly(options) => {
                let call_options =
                    self.create_call_options(options, state_overrides, block_overrides);
                let trace = trace_fn(tx_request, block_id, call_options).await?;
                Ok(TracingResult::Single(trace))
            }
            Self::Hybrid { tracers_options, struct_logger_options } => {
                // Create call options for both traces
                let tracers_call_options = self.create_call_options(
                    tracers_options,
                    state_overrides.clone(),
                    block_overrides.clone(),
                );
                let struct_logger_call_options = self.create_call_options(
                    struct_logger_options,
                    state_overrides,
                    block_overrides,
                );

                // Execute both calls concurrently
                let tracers_fut = trace_fn(tx_request.clone(), block_id, tracers_call_options);
                let struct_logger_fut = trace_fn(tx_request, block_id, struct_logger_call_options);

                let (tracers_trace, struct_logger_trace) =
                    tokio::try_join!(tracers_fut, struct_logger_fut)?;

                Ok(TracingResult::Dual {
                    tracers_trace,
                    struct_logger_trace: Box::new(struct_logger_trace),
                })
            }
        }
    }
}

impl std::fmt::Display for TracingStrategy {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::StructLoggerOnly(opts) => write!(f, "Struct logger only: {:?}", opts.config),
            Self::TracersOnly(opts) => write!(f, "Tracers only: {:?}", opts.tracer_config),
            Self::Hybrid { tracers_options, struct_logger_options } => {
                write!(
                    f,
                    "Hybrid: {:?}, {:?}",
                    tracers_options.tracer_config, struct_logger_options.config
                )
            }
        }
    }
}

/// Result of trace execution
#[derive(Debug, Clone)]
pub enum TracingResult {
    /// Single trace result
    Single(GethTrace),
    /// Dual trace result (tracers + struct logger)
    Dual { tracers_trace: GethTrace, struct_logger_trace: Box<GethTrace> },
}

impl std::fmt::Display for TracingResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Single(_) => write!(f, "Single trace"),
            Self::Dual { .. } => write!(f, "Dual trace"),
        }
    }
}

impl TracingResult {
    /// Get the primary trace (for single) or tracers trace (for dual)
    pub const fn primary_trace(&self) -> &GethTrace {
        match self {
            Self::Single(trace) => trace,
            Self::Dual { tracers_trace, .. } => tracers_trace,
        }
    }

    /// Get the struct logger frame if available
    pub fn struct_logger_frame(&self) -> Option<&DefaultFrame> {
        match self {
            Self::Single(trace) => {
                // Check if this is a struct logger trace
                if let GethTrace::Default(frame) = trace {
                    Some(frame)
                } else {
                    None
                }
            }
            Self::Dual { struct_logger_trace, .. } => {
                if let GethTrace::Default(frame) = struct_logger_trace.as_ref() {
                    Some(frame)
                } else {
                    None
                }
            }
        }
    }

    /// Check if this result contains multiple traces
    pub const fn is_dual(&self) -> bool {
        matches!(self, Self::Dual { .. })
    }
}

#[cfg(test)]
mod tests {
    use crate::handlers::trace::{CallTracerConfig, StructLoggerConfig};

    use super::*;

    #[test]
    fn test_tracing_strategy_struct_logger_only() {
        let config = TraceConfig {
            tracers: Tracers {
                four_byte_tracer: false,
                call_tracer: None,
                prestate_tracer: None,
                struct_logger: Some(StructLoggerConfig::default()),
            },
        };

        let strategy = TracingStrategy::from_config(&config);
        assert!(matches!(strategy, TracingStrategy::StructLoggerOnly(_)));
    }

    #[test]
    fn test_tracing_strategy_tracers_only() {
        let config = TraceConfig {
            tracers: Tracers {
                four_byte_tracer: true,
                call_tracer: Some(CallTracerConfig::default()),
                prestate_tracer: None,
                struct_logger: None,
            },
        };

        let strategy = TracingStrategy::from_config(&config);
        assert!(matches!(strategy, TracingStrategy::TracersOnly(_)));
    }

    #[test]
    fn test_tracing_strategy_hybrid() {
        let config = TraceConfig {
            tracers: Tracers {
                four_byte_tracer: true,
                call_tracer: Some(CallTracerConfig::default()),
                prestate_tracer: None,
                struct_logger: Some(StructLoggerConfig::default()),
            },
        };

        let strategy = TracingStrategy::from_config(&config);
        assert!(matches!(strategy, TracingStrategy::Hybrid { .. }));
    }
}
