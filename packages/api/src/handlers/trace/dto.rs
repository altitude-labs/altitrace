use std::collections::HashMap;

use crate::{
    handlers::{simulation::TransactionCall, validation::validate_hash},
    types::{BlockOverrides, StateOverride},
    utils::default_latest,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

/// Request to trace a transaction by hash.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Validate)]
#[serde(rename_all = "camelCase")]
#[schema(
    example = json!({
        "transactionHash": "0xbc4a51bbcbe7550446c151d0d53ee14d5318188e2af1726e28a481b075fc7b4c",
        "returnReceipt": false,
        "tracerConfig": {
            "4byteTracer": true,
            "callTracer": {
                "onlyTopCall": false,
                "withLogs": true
            },
            "prestateTracer": {
                "diffMode": true,
                "disableCode": false,
                "disableStorage": false
            },
            "structLogger": {
                "disableMemory": true,
                "disableStack": false,
                "disableStorage": false,
                "disableReturnData": false,
                "cleanStructLogs": true
            }
        }
    })
)]
pub struct TraceTransactionRequest {
    /// Transaction hash to trace.
    #[validate(custom(function = validate_hash, message = "Invalid transaction hash"))]
    #[schema(
        example = "0xbc4a51bbcbe7550446c151d0d53ee14d5318188e2af1726e28a481b075fc7b4c",
        pattern = "0x[0-9a-fA-F]{64}"
    )]
    pub transaction_hash: String,

    /// Trace configuration options.
    #[validate(nested)]
    #[serde(default)]
    pub tracer_config: TraceConfig,
}

/// Request to trace a call simulation.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct TraceCallRequest {
    /// Transaction call to trace.
    #[validate(nested)]
    pub call: TransactionCall,

    /// Block number or tag to trace against (default: "latest").
    #[schema(example = "latest")]
    #[serde(default = "default_latest")]
    pub block: String,

    /// Trace configuration options.
    #[validate(nested)]
    #[serde(default)]
    pub tracer_config: TraceConfig,

    /// State overrides to apply during tracing.
    #[validate(nested)]
    #[serde(default)]
    pub state_overrides: Option<HashMap<String, StateOverride>>,

    /// Block overrides to apply during tracing.
    #[validate(nested)]
    #[serde(default)]
    pub block_overrides: Option<BlockOverrides>,
}

/// Comprehensive trace configuration supporting multiple tracers.
#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema, Validate)]
#[serde(default)]
#[schema(
    title = "Trace Configuration",
    description = "Comprehensive trace configuration supporting multiple tracers"
)]
pub struct TraceConfig {
    /// Tracers to use.
    #[validate(nested)]
    #[serde(flatten)]
    pub tracers: Tracers,
}

impl TraceConfig {
    /// Returns true if the struct logger should be cleaned.
    pub fn should_clean_struct_logger(&self) -> bool {
        self.tracers
            .struct_logger
            .as_ref()
            .is_some_and(|config| config.clean_struct_logs)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq, Validate)]
pub struct Tracers {
    /// The 4byteTracer collects the function selectors of every function executed in the lifetime
    /// of a transaction, along with the size of the supplied call data. The result is a
    /// [`FourByteFrame`](alloy_rpc_types_trace::geth::four_byte::FourByteFrame) where the keys are
    /// `SELECTOR-CALLDATASIZE` and the values are number of occurrences of this key.
    #[serde(rename = "4byteTracer", default)]
    pub four_byte_tracer: bool,
    /// The callTracer tracks all the call frames executed during a transaction, including depth 0.
    /// The result will be a nested list of call frames, resembling how EVM works. They form a tree
    /// with the top-level call at root and sub-calls as children of the higher levels.
    #[serde(rename = "callTracer")]
    #[schema(example = "null")]
    pub call_tracer: Option<CallTracerConfig>,
    /// The prestate tracer operates in two distinct modes: prestate and diff.
    /// - In prestate mode, it retrieves the accounts required for executing a specified
    ///   transaction.
    /// - In diff mode, it identifies the changes between the transaction's initial and final
    ///   states, detailing the modifications caused by the transaction.
    ///
    /// By default, the prestateTracer is set to prestate mode. It reexecutes the given transaction
    /// and tracks every part of state that is accessed.
    #[serde(rename = "prestateTracer", skip_serializing_if = "Option::is_none")]
    #[schema(example = "null")]
    pub prestate_tracer: Option<PrestateTracerConfig>,
    /// This is the default tracer. It logs the execution of the transaction in the
    /// [`StructLog`](alloy_rpc_types_trace::geth::StructLog) format.
    #[serde(rename = "structLogger", skip_serializing_if = "Option::is_none")]
    #[schema(nullable = true)]
    pub struct_logger: Option<StructLoggerConfig>,
}

impl Tracers {
    /// Returns true if it uses only the default geth tracer.
    pub const fn is_default_tracer(&self) -> bool {
        self.struct_logger.is_some() && !self.is_mux()
    }

    /// Returns true if the tracer type can be used to generate a gas profiler.
    pub const fn supports_gas_profiler(&self) -> bool {
        self.struct_logger.is_some()
    }

    /// Returns true if the tracers can be used to generate a mux trace.
    ///
    /// `struct_logger` is not considered for mux traces.
    pub const fn is_mux(&self) -> bool {
        self.count_active_tracers() >= 2
    }

    /// Counts the number of active tracers (excluding `struct_logger`).
    pub const fn count_active_tracers(&self) -> usize {
        let mut count = 0;

        if self.four_byte_tracer {
            count += 1;
        }
        if self.call_tracer.is_some() {
            count += 1;
        }
        if self.prestate_tracer.is_some() {
            count += 1;
        }

        count
    }
}

impl Default for Tracers {
    fn default() -> Self {
        Self {
            four_byte_tracer: false,
            call_tracer: Some(CallTracerConfig::default()),
            prestate_tracer: None,
            struct_logger: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct CallTracerConfig {
    /// Only trace the top-level call.
    pub only_top_call: bool,
    /// Include event logs in call frames.
    pub with_logs: bool,
}

impl Default for CallTracerConfig {
    fn default() -> Self {
        Self { only_top_call: false, with_logs: true }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq, Validate)]
#[serde(rename_all = "camelCase", default)]
pub struct PrestateTracerConfig {
    /// Enable diff mode to show state changes.
    pub diff_mode: bool,
    /// Disable contract code in results.
    pub disable_code: bool,
    /// Disable storage tracking (not recommended).
    pub disable_storage: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Validate, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct StructLoggerConfig {
    /// Enable memory capture (disabled by default for performance).
    pub disable_memory: bool,
    /// Disable stack capture.
    pub disable_stack: bool,
    /// Disable storage capture.
    pub disable_storage: bool,
    /// Disable return data capture.
    pub disable_return_data: bool,
    /// Clean struct logs to reduce response size.
    pub clean_struct_logs: bool,
}

impl Default for StructLoggerConfig {
    fn default() -> Self {
        Self {
            disable_memory: true,
            disable_stack: false,
            disable_storage: false,
            disable_return_data: false,
            clean_struct_logs: true,
        }
    }
}
