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

use alloy_rpc_types_trace::geth::{mux::MuxFrame, GethTrace};

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

        // Extract struct logger if available
        if let Some(struct_frame) = result.struct_logger_frame() {
            response.struct_logger = Some(StructLogResponse::from(struct_frame.clone()));
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
}
