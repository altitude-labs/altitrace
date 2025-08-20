use crate::types::LogEntry;

use alloy_rpc_types_trace::geth::{
    mux::MuxFrame, CallFrame as AlloyCallFrame, GethDebugBuiltInTracerType,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Call tracer result with hierarchical call structure.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CallTraceResponse {
    /// Root call frame.
    pub root_call: CallFrame,

    /// Total number of calls.
    pub total_calls: u64,

    /// Maximum call depth.
    pub max_depth: u32,
}

/// Individual call frame in the call trace.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CallFrame {
    /// Call type (CALL, DELEGATECALL, STATICCALL, CREATE, etc.).
    #[schema(example = "CALL")]
    pub call_type: String,

    /// Sender address.
    #[schema(example = "0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c")]
    pub from: String,

    /// Recipient address.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")]
    pub to: Option<String>,

    /// Value transferred (hex-encoded wei).
    #[schema(example = "0x0")]
    pub value: String,

    /// Gas provided to the call.
    #[schema(example = "0x7a120")]
    pub gas: String,

    /// Gas used by the call.
    #[schema(example = "0x5208")]
    pub gas_used: String,

    /// Input data (hex-encoded).
    #[schema(example = "0xa9059cbb")]
    pub input: String,

    /// Output data (hex-encoded).
    #[schema(example = "0x01")]
    pub output: String,

    /// Call depth.
    pub depth: u32,

    /// Whether the call reverted.
    pub reverted: bool,

    /// Error message if call failed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,

    /// Revert reason if available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revert_reason: Option<String>,

    /// Sub-calls made by this call.
    #[schema(no_recursion)]
    #[serde(default)]
    pub calls: Vec<CallFrame>,

    /// Logs emitted by this call.
    #[serde(default)]
    pub logs: Vec<LogEntry>,
}

impl From<AlloyCallFrame> for CallTraceResponse {
    fn from(frame: AlloyCallFrame) -> Self {
        let mut total_calls = 0;
        let mut max_depth = 0;

        // Calculate statistics by traversing the call tree
        let root_call =
            CallFrame::from_alloy_with_stats(&frame, 0, &mut total_calls, &mut max_depth);

        Self { root_call, total_calls, max_depth }
    }
}

impl CallFrame {
    /// Convert `AlloyCallFrame` to `CallFrame` with depth tracking and statistics calculation
    pub fn from_alloy_with_stats(
        frame: &AlloyCallFrame,
        depth: u32,
        total_calls: &mut u64,
        max_depth: &mut u32,
    ) -> Self {
        // Increment total calls counter
        *total_calls += 1;

        // Update max depth if current depth is greater
        if depth > *max_depth {
            *max_depth = depth;
        }

        // Convert sub-calls recursively
        let calls: Vec<Self> = frame
            .calls
            .iter()
            .map(|sub_call| {
                Self::from_alloy_with_stats(sub_call, depth + 1, total_calls, max_depth)
            })
            .collect();

        // Convert logs if present
        let logs = frame
            .logs
            .iter()
            .map(|log| crate::types::LogEntry {
                address: log
                    .address
                    .map(|addr| format!("{:?}", addr))
                    .unwrap_or_default(),
                topics: log
                    .topics
                    .as_ref()
                    .map(|topics| topics.iter().map(|topic| format!("{:?}", topic)).collect())
                    .unwrap_or_default(),
                data: log
                    .data
                    .as_ref()
                    .map(|data| format!("0x{}", alloy_primitives::hex::encode(data)))
                    .unwrap_or_else(|| "0x".to_string()),
            })
            .collect();

        Self {
            call_type: frame.typ.clone(),
            from: format!("{:?}", frame.from),
            to: frame.to.map(|addr| format!("{:?}", addr)),
            value: format!("0x{:x}", frame.value.unwrap_or_default()),
            gas: format!("0x{:x}", frame.gas),
            gas_used: format!("0x{:x}", frame.gas_used),
            input: format!("0x{}", alloy_primitives::hex::encode(&frame.input)),
            output: frame
                .output
                .as_ref()
                .map(|output| format!("0x{}", alloy_primitives::hex::encode(output)))
                .unwrap_or_else(|| "0x".to_string()),
            depth,
            reverted: frame.error.is_some(),
            error: frame.error.clone(),
            revert_reason: frame.revert_reason.clone(),
            calls,
            logs,
        }
    }

    /// Simple conversion from `AlloyCallFrame` with default depth (for backward compatibility)
    pub fn from_alloy_call_frame(frame: &AlloyCallFrame, depth: u32) -> Self {
        let mut total_calls = 0;
        let mut max_depth = 0;
        Self::from_alloy_with_stats(frame, depth, &mut total_calls, &mut max_depth)
    }
}

impl From<&AlloyCallFrame> for CallFrame {
    fn from(frame: &AlloyCallFrame) -> Self {
        Self::from_alloy_call_frame(frame, 0)
    }
}

impl From<AlloyCallFrame> for CallFrame {
    fn from(frame: AlloyCallFrame) -> Self {
        Self::from(&frame)
    }
}

impl TryFrom<MuxFrame> for CallTraceResponse {
    type Error = anyhow::Error;

    fn try_from(frame: MuxFrame) -> Result<Self, Self::Error> {
        if let Some(call_frame) = frame.0.get(&GethDebugBuiltInTracerType::CallTracer) {
            Ok(Self::from(call_frame.clone().try_into_call_frame()?))
        } else {
            Err(anyhow::anyhow!("CallTracer not found in MuxFrame"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy_primitives::{Address, Bytes, U256};

    #[test]
    fn test_alloy_call_frame_to_call_trace_response() {
        // Create a mock AlloyCallFrame with nested calls
        let root_frame = AlloyCallFrame {
            from: Address::ZERO,
            to: Some(Address::repeat_byte(1)),
            gas: U256::from(21000),
            gas_used: U256::from(20000),
            input: Bytes::from_static(&[0xa9, 0x05, 0x9c, 0xbb]), // transfer function selector
            output: Some(Bytes::from_static(&[0x01])),
            value: Some(U256::from(1000)),
            typ: "CALL".to_string(),
            error: None,
            revert_reason: None,
            calls: vec![
                AlloyCallFrame {
                    from: Address::repeat_byte(1),
                    to: Some(Address::repeat_byte(2)),
                    gas: U256::from(10000),
                    gas_used: U256::from(8000),
                    input: Bytes::default(),
                    output: None,
                    value: None,
                    typ: "STATICCALL".to_string(),
                    error: None,
                    revert_reason: None,
                    calls: vec![],
                    logs: vec![],
                },
                AlloyCallFrame {
                    from: Address::repeat_byte(1),
                    to: Some(Address::repeat_byte(3)),
                    gas: U256::from(5000),
                    gas_used: U256::from(4500),
                    input: Bytes::default(),
                    output: None,
                    value: None,
                    typ: "DELEGATECALL".to_string(),
                    error: Some("revert".to_string()),
                    revert_reason: Some("insufficient balance".to_string()),
                    calls: vec![],
                    logs: vec![],
                },
            ],
            logs: vec![],
        };

        let response: CallTraceResponse = root_frame.into();

        // Verify statistics
        assert_eq!(response.total_calls, 3); // root + 2 sub-calls
        assert_eq!(response.max_depth, 1); // depth 0 (root) + 1 (sub-calls)

        // Verify root call conversion
        assert_eq!(response.root_call.call_type, "CALL");
        assert_eq!(response.root_call.depth, 0);
        assert_eq!(response.root_call.calls.len(), 2);
        assert!(!response.root_call.reverted);

        // Verify sub-calls
        let first_sub_call = &response.root_call.calls[0];
        assert_eq!(first_sub_call.call_type, "STATICCALL");
        assert_eq!(first_sub_call.depth, 1);
        assert!(!first_sub_call.reverted);

        let second_sub_call = &response.root_call.calls[1];
        assert_eq!(second_sub_call.call_type, "DELEGATECALL");
        assert_eq!(second_sub_call.depth, 1);
        assert!(second_sub_call.reverted);
        assert_eq!(second_sub_call.error, Some("revert".to_string()));
        assert_eq!(second_sub_call.revert_reason, Some("insufficient balance".to_string()));
    }

    #[test]
    fn test_call_frame_depth_calculation() {
        // Create a deeply nested call frame (3 levels)
        let deep_frame = AlloyCallFrame {
            from: Address::ZERO,
            to: Some(Address::repeat_byte(1)),
            gas: U256::from(100000),
            gas_used: U256::from(80000),
            input: Default::default(),
            output: None,
            value: None,
            typ: "CALL".to_string(),
            error: None,
            revert_reason: None,
            calls: vec![AlloyCallFrame {
                from: Address::repeat_byte(1),
                to: Some(Address::repeat_byte(2)),
                gas: U256::from(50000),
                gas_used: U256::from(40000),
                input: Default::default(),
                output: None,
                value: None,
                typ: "CALL".to_string(),
                error: None,
                revert_reason: None,
                calls: vec![AlloyCallFrame {
                    from: Address::repeat_byte(2),
                    to: Some(Address::repeat_byte(3)),
                    gas: U256::from(25000),
                    gas_used: U256::from(20000),
                    input: Default::default(),
                    output: None,
                    value: None,
                    typ: "CALL".to_string(),
                    error: None,
                    revert_reason: None,
                    calls: vec![],
                    logs: vec![],
                }],
                logs: vec![],
            }],
            logs: vec![],
        };

        let response: CallTraceResponse = deep_frame.into();

        assert_eq!(response.total_calls, 3);
        assert_eq!(response.max_depth, 2); // 0, 1, 2
        assert_eq!(response.root_call.depth, 0);
        assert_eq!(response.root_call.calls[0].depth, 1);
        assert_eq!(response.root_call.calls[0].calls[0].depth, 2);
    }
}
