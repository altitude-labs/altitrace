use std::collections::BTreeMap;

use alloy_rpc_types_trace::geth::{DefaultFrame, StructLog as AlloyStructLog};
use serde::{ser::SerializeMap, Deserialize, Serialize, Serializer};
use utoipa::ToSchema;

/// API response for the struct log tracer.
///
/// This is the default tracer and the most verbose one.
/// It's the most useful one for debugging.
///
/// Use the [`StructLogResponse::clean`] method to clean the trace.
#[derive(Clone, Debug, Default, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StructLogResponse {
    /// Struct logs
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[serde(rename = "structLogs")]
    pub inner: Option<Vec<StructLog>>,
    /// Total opcodes executed
    pub total_opcodes: u64,
    /// Error message if any
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(example = "Transaction execution failed")]
    pub error: Option<String>,
    /// Output of the transaction
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(example = "0x01")]
    pub output: Option<String>,
    /// Total gas used
    pub total_gas: u64,
    /// Total gas refunded
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(example = "0x1000")]
    pub total_gas_refunded: Option<u64>,
    /// Number of times the gas was refunded
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refund_counter: Option<u64>,
}

impl StructLogResponse {
    /// [`StructLog`] can be very noisy and too big to send to the client.
    /// Use this method if the client don't want the full trace.
    pub fn clean(&mut self) {
        self.inner = None;
    }
}

impl From<DefaultFrame> for StructLogResponse {
    fn from(frame: DefaultFrame) -> Self {
        let mut total_gas_refunded = 0;
        let mut total_refund_counter = 0;
        let mut last_gas_refunded_state = 0;

        // Calculate total gas refunded and number of refund events
        //
        // The `refund_counter` field tracks gas refunds across call contexts:
        // - `None`: No active refund in current call context
        // - `Some(value)`: Active refund counter, value persists until context changes (next call
        //   context or new refund)
        //
        // We track state transitions to count distinct refund events and accumulate totals
        for log in &frame.struct_logs {
            if log.refund_counter.is_some() && last_gas_refunded_state == 0 {
                total_gas_refunded += log.refund_counter.unwrap();
                total_refund_counter += 1;
                last_gas_refunded_state = 1;
                continue;
            }

            if log.refund_counter.is_none() && last_gas_refunded_state != 0 {
                last_gas_refunded_state = 0;
            }
        }

        let gas = frame.gas;
        let output = (!frame.return_value.is_empty()).then(|| format!("0x{}", frame.return_value));

        // the error is the first non-empty error, starting from the last struct log
        let error = frame
            .struct_logs
            .iter()
            .rev()
            .find_map(|log| log.error.is_some().then(|| log.error.clone().unwrap()));

        let struct_logs: Vec<StructLog> = frame
            .struct_logs
            .into_iter()
            .map(|log| log.into())
            .collect();

        let total_opcode = struct_logs.len() as u64;

        Self {
            inner: Some(struct_logs),
            total_opcodes: total_opcode,
            error,
            output,
            total_gas: gas,
            total_gas_refunded: Some(total_gas_refunded),
            refund_counter: Some(total_refund_counter as u64),
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct StructLog {
    /// program counter
    pub pc: u64,
    /// opcode to be executed
    pub op: String,
    /// remaining gas
    pub gas: u64,
    /// cost for executing op
    #[serde(rename = "gasCost")]
    pub gas_cost: u64,
    /// Current call depth
    pub depth: u64,
    /// Error message if any
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// EVM stack
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stack: Option<Vec<String>>,
    /// Last call's return data. Enabled via enableReturnData
    #[serde(default, rename = "returnData", skip_serializing_if = "Option::is_none")]
    pub return_data: Option<String>,
    /// ref <https://github.com/ethereum/go-ethereum/blob/366d2169fbc0e0f803b68c042b77b6b480836dbc/eth/tracers/logger/logger.go#L450-L452>
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memory: Option<Vec<String>>,
    /// Size of memory.
    #[serde(default, rename = "memSize", skip_serializing_if = "Option::is_none")]
    pub memory_size: Option<u64>,
    /// Storage slots of current contract read from and written to. Only emitted for SLOAD and
    /// SSTORE. Disabled via disableStorage
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        serialize_with = "serialize_string_storage_map_opt"
    )]
    pub storage: Option<BTreeMap<String, String>>,
    /// Refund counter
    #[serde(default, rename = "refund", skip_serializing_if = "Option::is_none")]
    pub refund_counter: Option<u64>,
}

impl From<AlloyStructLog> for StructLog {
    fn from(log: AlloyStructLog) -> Self {
        Self {
            pc: log.pc,
            op: log.op,
            gas: log.gas,
            gas_cost: log.gas_cost,
            depth: log.depth,
            error: log.error,
            stack: log.stack.map(|stack| {
                stack
                    .into_iter()
                    .map(|s| format!("0x{s:x}"))
                    .collect::<Vec<_>>()
            }),
            return_data: log.return_data.map(|s| format!("0x{s:x}")),
            memory: log.memory,
            memory_size: log.memory_size,
            storage: log.storage.map(|storage| {
                storage
                    .into_iter()
                    .map(|(k, v)| {
                        let key = format!("{:?}", k);
                        let value = format!("{:?}", v);
                        (key, value)
                    })
                    .collect::<BTreeMap<String, String>>()
            }),
            refund_counter: log.refund_counter,
        }
    }
}

/// Serializes a storage map as a list of key-value pairs _without_ 0x-prefix
fn serialize_string_storage_map_opt<S: Serializer>(
    storage: &Option<BTreeMap<String, String>>,
    s: S,
) -> Result<S::Ok, S::Error> {
    match storage {
        None => s.serialize_none(),
        Some(storage) => {
            let mut m = s.serialize_map(Some(storage.len()))?;
            for (key, val) in storage {
                let key = format!("{key:?}");
                let val = format!("{val:?}");
                // skip the 0x prefix
                m.serialize_entry(&key.as_str()[2..], &val.as_str()[2..])?;
            }
            m.end()
        }
    }
}
