pub mod call;
pub mod four_byte;
pub mod pre_state;
pub mod struct_log;

pub use call::*;
pub use four_byte::*;
pub use pre_state::*;
pub use struct_log::*;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use alloy_rpc_types_trace::geth::{
    mux::MuxFrame, CallFrame as AlloyCallFrame, DefaultFrame, FourByteFrame, GethTrace,
    PreStateFrame,
};

use crate::{handlers::trace::TracingResult, types::TransactionReceiptInfo};

/// Container for all tracer results.
#[derive(Debug, Default, Serialize, Deserialize, Clone, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TracerResponse {
    /// The transaction receipt.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub receipt: Option<TransactionReceiptInfo>,

    /// Call tracer results.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub call_tracer: Option<CallTraceResponse>,

    /// Prestate tracer results.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prestate_tracer: Option<PrestateTraceResponse>,

    /// Struct logger results.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub struct_logger: Option<StructLogResponse>,

    /// Four byte tracer results.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "4byteTracer")]
    pub four_byte_tracer: Option<FourByteResponse>,
}

impl TracerResponse {
    pub fn with_receipt(mut self, receipt: TransactionReceiptInfo) -> Self {
        self.receipt = Some(receipt);
        self
    }

    pub fn clean_struct_logger(&mut self) {
        if let Some(struct_logger) = &mut self.struct_logger {
            struct_logger.clean();
        }
    }
}

impl From<TracingResult> for TracerResponse {
    fn from(result: TracingResult) -> Self {
        let mut response = Self::default();

        // Extract struct logger if available (handles both Default and JS traces)
        if let Some(struct_frame) = result.struct_logger_frame() {
            response.struct_logger = Some(StructLogResponse::from(struct_frame.clone()));
        } else if let Some(default_frame) = result.extract_default_frame_from_js() {
            // Fallback: try to extract DefaultFrame from JS traces
            response.struct_logger = Some(StructLogResponse::from(default_frame));
        }

        // Process primary trace (could be single trace or tracers from dual)
        Self::extract_tracers_from_trace(result.primary_trace(), &mut response);

        response
    }
}

impl TracerResponse {
    /// Extract tracer responses from a [`GethTrace`]
    fn extract_tracers_from_trace(trace: &GethTrace, response: &mut Self) {
        match trace {
            GethTrace::CallTracer(call_frame) => {
                response.call_tracer = Some(CallTraceResponse::from(call_frame.clone()));
            }
            GethTrace::PreStateTracer(prestate_frame) => {
                response.prestate_tracer =
                    Some(PrestateTraceResponse::from(prestate_frame.clone()));
            }
            GethTrace::FourByteTracer(four_byte_frame) => {
                response.four_byte_tracer = Some(FourByteResponse::from(four_byte_frame.clone()));
            }
            // Mux tracer - contains multiple traces
            GethTrace::MuxTracer(mux_frame) => {
                Self::extract_from_mux_frame(mux_frame, response);
            }
            // Handle JS traces that should be converted to specific tracer types
            GethTrace::JS(json_value) => {
                Self::extract_from_js_trace(json_value, response);
            }
            _ => {}
        }
    }

    /// Extract individual tracers from [`MuxFrame`]
    fn extract_from_mux_frame(mux_frame: &MuxFrame, response: &mut Self) {
        for (tracer_type, trace) in &mux_frame.0 {
            match tracer_type {
                alloy_rpc_types_trace::geth::GethDebugBuiltInTracerType::CallTracer => {
                    if let GethTrace::CallTracer(call_frame) = trace {
                        response.call_tracer = Some(CallTraceResponse::from(call_frame.clone()));
                    }
                }
                alloy_rpc_types_trace::geth::GethDebugBuiltInTracerType::PreStateTracer => {
                    if let GethTrace::PreStateTracer(prestate_frame) = trace {
                        response.prestate_tracer =
                            Some(PrestateTraceResponse::from(prestate_frame.clone()));
                    }
                }
                alloy_rpc_types_trace::geth::GethDebugBuiltInTracerType::FourByteTracer => {
                    if let GethTrace::FourByteTracer(four_byte_frame) = trace {
                        response.four_byte_tracer =
                            Some(FourByteResponse::from(four_byte_frame.clone()));
                    }
                }
                _ => {}
            }
        }
    }

    /// Extract tracer responses from a JS trace ([`serde_json::Value`])
    /// This handles cases where [`debug_trace_call_many`] returns [`GethTrace::JS`] instead of
    /// specific types.
    ///
    /// TODO: create an issue in reth repo to fix this.
    fn extract_from_js_trace(json_value: &serde_json::Value, response: &mut Self) {
        match json_value {
            serde_json::Value::Array(arr) => {
                for element in arr {
                    Self::try_extract_single_trace(element, response);
                }
            }
            _ => {
                Self::try_extract_single_trace(json_value, response);
            }
        }
    }

    /// Try to extract a single trace element into the appropriate tracer response
    fn try_extract_single_trace(value: &serde_json::Value, response: &mut Self) {
        if let serde_json::Value::Object(obj) = value {
            if let Ok(four_byte_frame) = serde_json::from_value::<FourByteFrame>(value.clone()) {
                response.four_byte_tracer = Some(FourByteResponse::from(four_byte_frame));
                return;
            }

            if let Ok(call_frame) = serde_json::from_value::<AlloyCallFrame>(value.clone()) {
                response.call_tracer = Some(CallTraceResponse::from(call_frame));
                return;
            }

            if let Ok(prestate_frame) = serde_json::from_value::<PreStateFrame>(value.clone()) {
                response.prestate_tracer = Some(PrestateTraceResponse::from(prestate_frame));
                return;
            }

            if let Ok(default_frame) = serde_json::from_value::<DefaultFrame>(value.clone()) {
                response.struct_logger = Some(StructLogResponse::from(default_frame));
                return;
            }

            // Handle objects with tracer names as keys (multiple tracers case)
            for (tracer_name, tracer_data) in obj {
                match tracer_name.as_str() {
                    "4byteTracer" => {
                        if let Ok(four_byte_frame) =
                            serde_json::from_value::<FourByteFrame>(tracer_data.clone())
                        {
                            response.four_byte_tracer =
                                Some(FourByteResponse::from(four_byte_frame));
                        }
                    }
                    "callTracer" => {
                        if let Ok(call_frame) =
                            serde_json::from_value::<AlloyCallFrame>(tracer_data.clone())
                        {
                            response.call_tracer = Some(CallTraceResponse::from(call_frame));
                        }
                    }
                    "prestateTracer" => {
                        if let Ok(prestate_frame) =
                            serde_json::from_value::<PreStateFrame>(tracer_data.clone())
                        {
                            response.prestate_tracer =
                                Some(PrestateTraceResponse::from(prestate_frame));
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}
