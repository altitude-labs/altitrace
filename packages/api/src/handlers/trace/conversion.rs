use alloy_rpc_types_trace::geth::{
    mux::MuxConfig, CallConfig, GethDebugBuiltInTracerType, GethDebugTracerConfig,
    GethDebugTracerType, GethDebugTracingOptions, GethDefaultTracingOptions, PreStateConfig,
};
use std::collections::HashMap;

use crate::handlers::trace::{
    CallTracerConfig, PrestateTracerConfig, StructLoggerConfig, TraceConfig, Tracers,
};

impl From<&CallTracerConfig> for CallConfig {
    fn from(config: &CallTracerConfig) -> Self {
        Self { only_top_call: Some(config.only_top_call), with_log: Some(config.with_logs) }
    }
}

impl From<&PrestateTracerConfig> for PreStateConfig {
    fn from(config: &PrestateTracerConfig) -> Self {
        Self {
            diff_mode: Some(config.diff_mode),
            disable_code: Some(config.disable_code),
            disable_storage: Some(config.disable_storage),
        }
    }
}

impl From<&StructLoggerConfig> for GethDefaultTracingOptions {
    fn from(config: &StructLoggerConfig) -> Self {
        Self {
            disable_memory: Some(config.disable_memory),
            disable_stack: Some(config.disable_stack),
            disable_storage: Some(config.disable_storage),
            disable_return_data: Some(config.disable_return_data),
            enable_return_data: Some(!config.disable_return_data),
            enable_memory: Some(!config.disable_memory),
            debug: None,
            limit: None,
        }
    }
}

/// Convert the [`Tracers`] to the alloy [`MuxConfig`]
///
/// Creates a `MuxConfig` containing all active tracers (excluding `struct_logger`).
/// This is used when multiple tracers are enabled.
impl From<&Tracers> for MuxConfig {
    fn from(tracers: &Tracers) -> Self {
        let mut mux_tracers = Vec::new();

        // Add 4byteTracer if enabled
        if tracers.four_byte_tracer {
            mux_tracers.push((GethDebugBuiltInTracerType::FourByteTracer, None));
        }

        // Add callTracer if configured
        if let Some(call_config) = &tracers.call_tracer {
            let config: CallConfig = call_config.into();
            mux_tracers.push((
                GethDebugBuiltInTracerType::CallTracer,
                Some(GethDebugTracerConfig::from(config)),
            ));
        }

        // Add prestateTracer if configured
        if let Some(prestate_config) = &tracers.prestate_tracer {
            let config: PreStateConfig = prestate_config.into();
            mux_tracers.push((
                GethDebugBuiltInTracerType::PreStateTracer,
                Some(GethDebugTracerConfig::from(config)),
            ));
        }

        Self(HashMap::from_iter(mux_tracers))
    }
}

/// Convert the [`TraceConfig`] to alloy [`GethDebugTracingOptions`]
///
/// This conversion handles both single tracer and mux tracer scenarios:
/// - If only one tracer is active (excluding `struct_logger`), use it directly
/// - If multiple tracers are active, use `MuxTracer`
/// - If only `struct_logger` is active, use default struct logger
impl From<&TraceConfig> for GethDebugTracingOptions {
    fn from(config: &TraceConfig) -> Self {
        let tracers = &config.tracers;
        let active_count = tracers.count_active_tracers();

        match active_count {
            // No tracers active except possibly struct_logger - use struct logger
            0 => {
                if let Some(struct_config) = &tracers.struct_logger {
                    Self {
                        config: struct_config.into(),
                        tracer: None, // Default struct logger
                        tracer_config: GethDebugTracerConfig::default(),
                        timeout: None,
                    }
                } else {
                    // No tracers at all - use default
                    Self::default()
                }
            }
            // Single tracer active - use it directly
            1 => {
                if tracers.four_byte_tracer {
                    Self {
                        config: GethDefaultTracingOptions::default(),
                        tracer: Some(GethDebugTracerType::BuiltInTracer(
                            GethDebugBuiltInTracerType::FourByteTracer,
                        )),
                        tracer_config: GethDebugTracerConfig::default(),
                        timeout: None,
                    }
                } else if let Some(call_config) = &tracers.call_tracer {
                    let config: CallConfig = call_config.into();
                    Self {
                        config: GethDefaultTracingOptions::default(),
                        tracer: Some(GethDebugTracerType::BuiltInTracer(
                            GethDebugBuiltInTracerType::CallTracer,
                        )),
                        tracer_config: GethDebugTracerConfig::from(config),
                        timeout: None,
                    }
                } else if let Some(prestate_config) = &tracers.prestate_tracer {
                    let config: PreStateConfig = prestate_config.into();
                    Self {
                        config: GethDefaultTracingOptions::default(),
                        tracer: Some(GethDebugTracerType::BuiltInTracer(
                            GethDebugBuiltInTracerType::PreStateTracer,
                        )),
                        tracer_config: GethDebugTracerConfig::from(config),
                        timeout: None,
                    }
                } else {
                    // Fallback (shouldn't happen)
                    Self::default()
                }
            }
            // Multiple tracers active - use MuxTracer
            _ => {
                let mux_config = MuxConfig::from(tracers);
                Self {
                    config: GethDefaultTracingOptions::default(),
                    tracer: Some(GethDebugTracerType::BuiltInTracer(
                        GethDebugBuiltInTracerType::MuxTracer,
                    )),
                    tracer_config: GethDebugTracerConfig::from(mux_config),
                    timeout: None,
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::handlers::trace::{CallTracerConfig, PrestateTracerConfig, TraceConfig, Tracers};

    #[test]
    fn test_tracers_to_mux_config_with_multiple_tracers() {
        let tracers = Tracers {
            four_byte_tracer: true,
            call_tracer: Some(CallTracerConfig { only_top_call: true, with_logs: false }),
            prestate_tracer: Some(PrestateTracerConfig {
                diff_mode: true,
                disable_code: false,
                disable_storage: false,
            }),
            struct_logger: None,
        };

        let mux_config = MuxConfig::from(&tracers);
        assert_eq!(mux_config.0.len(), 3);
        assert!(mux_config
            .0
            .contains_key(&GethDebugBuiltInTracerType::FourByteTracer));
        assert!(mux_config
            .0
            .contains_key(&GethDebugBuiltInTracerType::CallTracer));
        assert!(mux_config
            .0
            .contains_key(&GethDebugBuiltInTracerType::PreStateTracer));
    }

    #[test]
    fn test_trace_config_to_geth_options_single_tracer() {
        let config = TraceConfig {
            tracers: Tracers {
                four_byte_tracer: true,
                call_tracer: None,
                prestate_tracer: None,
                struct_logger: None,
            },
        };

        let geth_options = GethDebugTracingOptions::from(&config);
        assert_eq!(
            geth_options.tracer,
            Some(GethDebugTracerType::BuiltInTracer(GethDebugBuiltInTracerType::FourByteTracer))
        );
    }

    #[test]
    fn test_trace_config_to_geth_options_mux_tracer() {
        let config = TraceConfig {
            tracers: Tracers {
                four_byte_tracer: true,
                call_tracer: Some(CallTracerConfig::default()),
                prestate_tracer: None,
                struct_logger: None,
            },
        };

        let geth_options = GethDebugTracingOptions::from(&config);
        assert_eq!(
            geth_options.tracer,
            Some(GethDebugTracerType::BuiltInTracer(GethDebugBuiltInTracerType::MuxTracer))
        );
    }

    #[test]
    fn test_count_active_tracers() {
        let tracers = Tracers {
            four_byte_tracer: true,
            call_tracer: Some(CallTracerConfig::default()),
            prestate_tracer: None,
            struct_logger: Some(StructLoggerConfig::default()),
        };

        // Should count 2 (excluding struct_logger)
        assert_eq!(tracers.count_active_tracers(), 2);
        assert!(tracers.is_mux());
    }
}
