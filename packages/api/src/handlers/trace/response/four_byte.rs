use std::collections::HashMap;

use alloy_rpc_types_trace::geth::{mux::MuxFrame, FourByteFrame, GethDebugBuiltInTracerType};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Default, Serialize, Deserialize, Clone, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FourByteResponse {
    /// List of four byte identifiers
    #[serde(default)]
    pub identifiers: HashMap<FourByteId, FourByteInfo>,

    /// Total number of four byte identifiers
    #[schema(example = 3)]
    pub total_identifiers: u64,
}

#[derive(Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize, Clone, ToSchema)]
pub struct FourByteId(pub String);

#[derive(Debug, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize, Clone, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FourByteInfo {
    /// Function calldata size in bits
    #[schema(example = 128)]
    pub data_size: u64,
    /// Number of times the function was called
    #[schema(example = 3)]
    pub count: u64,
}

impl FourByteInfo {
    /// Create a new [`FourByteInfo`] with the given data size and count
    pub const fn new(data_size: u64, count: u64) -> Self {
        Self { data_size, count }
    }
}

impl From<FourByteFrame> for FourByteResponse {
    fn from(frame: FourByteFrame) -> Self {
        let mut identifiers = HashMap::new();
        let total_identifiers = frame.0.len() as u64;
        for (id, count) in &frame.0 {
            // frame identifier is as "SELECTOR-DATA_SIZE"
            let (selector, data_size) = id.split_once('-').unwrap();
            identifiers.insert(
                FourByteId(selector.to_string()),
                FourByteInfo::new(data_size.parse::<u64>().unwrap(), *count),
            );
        }
        Self { identifiers, total_identifiers }
    }
}

impl TryFrom<MuxFrame> for FourByteResponse {
    type Error = anyhow::Error;

    fn try_from(frame: MuxFrame) -> Result<Self, Self::Error> {
        if let Some(four_byte_frame) = frame.0.get(&GethDebugBuiltInTracerType::FourByteTracer) {
            Ok(Self::from(four_byte_frame.clone().try_into_four_byte_frame()?))
        } else {
            Err(anyhow::anyhow!("FourByteTracer not found in MuxFrame"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_four_byte_frame_to_four_byte_response() {
        const DEFAULT: &str = r#"{
            "0x27dc297e-128": 1,
            "0x38cc4831-0": 2
        }"#;
        let frame: FourByteFrame = serde_json::from_str(DEFAULT).unwrap();
        let response: FourByteResponse = frame.into();
        assert_eq!(response.total_identifiers, 2);
        assert_eq!(response.identifiers.len(), 2);
        assert_eq!(
            response
                .identifiers
                .get(&FourByteId("0x27dc297e".to_string())),
            Some(&FourByteInfo::new(128, 1))
        );
        assert_eq!(
            response
                .identifiers
                .get(&FourByteId("0x38cc4831".to_string())),
            Some(&FourByteInfo::new(0, 2))
        );
    }
}
