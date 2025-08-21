use std::collections::HashMap;

use alloy_rpc_types_trace::geth::{
    mux::MuxFrame, AccountState as AlloyAccountState, DiffMode, GethDebugBuiltInTracerType,
    PreStateFrame, PreStateMode,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Prestate tracer response containing account states.
///
/// The prestate tracer has two modes:
/// - Default mode: Returns accounts necessary to execute the transaction
/// - Diff mode: Returns the differences between pre and post transaction states
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(untagged)]
pub enum PrestateTraceResponse {
    /// Default mode containing accounts touched during execution
    Default(PrestateDefaultMode),
    /// Diff mode containing state changes before and after execution
    Diff(PrestateDiffMode),
}

/// Default prestate mode response.
/// Contains all account states necessary to execute the transaction.
#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
pub struct PrestateDefaultMode {
    /// Map of account addresses to their states
    #[serde(flatten)]
    pub accounts: HashMap<String, AccountState>,
}

/// Diff prestate mode response.
/// Contains the state changes caused by the transaction.
#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PrestateDiffMode {
    /// Account states before the transaction
    pub pre: HashMap<String, AccountState>,
    /// Account states after the transaction
    pub post: HashMap<String, AccountState>,
}

/// Represents the state of an account.
#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AccountState {
    /// Account balance in wei (hex-encoded)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "0x1bc16d674ec80000")]
    pub balance: Option<String>,

    /// Account bytecode (hex-encoded)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "0x608060405234801561001057600080fd5b50")]
    pub code: Option<String>,

    /// Account nonce
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = 42)]
    pub nonce: Option<u64>,

    /// Account storage slots (key-value pairs, both hex-encoded)
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub storage: HashMap<String, String>,
}

impl From<PreStateFrame> for PrestateTraceResponse {
    fn from(frame: PreStateFrame) -> Self {
        match frame {
            PreStateFrame::Default(mode) => Self::Default(mode.into()),
            PreStateFrame::Diff(diff) => Self::Diff(diff.into()),
        }
    }
}

impl From<PreStateMode> for PrestateDefaultMode {
    fn from(mode: PreStateMode) -> Self {
        let accounts = mode
            .0
            .into_iter()
            .map(|(address, state)| (format!("{:?}", address), state.into()))
            .collect();

        Self { accounts }
    }
}

impl From<DiffMode> for PrestateDiffMode {
    fn from(diff: DiffMode) -> Self {
        let pre = diff
            .pre
            .into_iter()
            .map(|(address, state)| (format!("{:?}", address), state.into()))
            .collect();

        let post = diff
            .post
            .into_iter()
            .map(|(address, state)| (format!("{:?}", address), state.into()))
            .collect();

        Self { pre, post }
    }
}

impl From<AlloyAccountState> for AccountState {
    fn from(state: AlloyAccountState) -> Self {
        // Convert balance to hex string if present
        let balance = state.balance.map(|b| format!("{:#x}", b));

        // Convert code to hex string if present
        let code = state
            .code
            .map(|c| format!("0x{}", alloy_primitives::hex::encode(c)));

        // Convert storage entries to hex strings
        let storage = state
            .storage
            .into_iter()
            .map(|(key, value)| (format!("{:?}", key), format!("{:?}", value)))
            .collect();

        Self { balance, code, nonce: state.nonce, storage }
    }
}

impl TryFrom<MuxFrame> for PrestateTraceResponse {
    type Error = anyhow::Error;

    fn try_from(frame: MuxFrame) -> Result<Self, Self::Error> {
        if let Some(prestate_frame) = frame.0.get(&GethDebugBuiltInTracerType::PreStateTracer) {
            Ok(Self::from(prestate_frame.clone().try_into_pre_state_frame()?))
        } else {
            Err(anyhow::anyhow!("PreStateTracer not found in MuxFrame"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use alloy_primitives::{Address, Bytes, B256, U256};
    use std::collections::BTreeMap;

    #[test]
    fn test_prestate_default_mode_conversion() {
        // Create test data
        let mut accounts = BTreeMap::new();
        let mut storage = BTreeMap::new();
        storage.insert(B256::from([1u8; 32]), B256::from([2u8; 32]));

        let account_state = AlloyAccountState {
            balance: Some(U256::from(1_000_000u64)),
            code: Some(Bytes::from(vec![0x60, 0x80, 0x60, 0x40])),
            nonce: Some(42),
            storage,
        };

        accounts.insert(Address::from([0x11u8; 20]), account_state);

        let prestate_mode = PreStateMode(accounts);
        let prestate_frame = PreStateFrame::Default(prestate_mode);

        // Convert to API response
        let response: PrestateTraceResponse = prestate_frame.into();

        // Verify the conversion
        match response {
            PrestateTraceResponse::Default(mode) => {
                assert_eq!(mode.accounts.len(), 1);

                let addr_key = format!("{:?}", Address::from([0x11u8; 20]));
                let account = mode.accounts.get(&addr_key).unwrap();

                assert_eq!(account.balance, Some("0xf4240".to_string()));
                assert_eq!(account.nonce, Some(42));
                assert!(account.code.is_some());
                assert_eq!(account.storage.len(), 1);
            }
            _ => panic!("Expected Default mode"),
        }
    }

    #[test]
    fn test_prestate_diff_mode_conversion() {
        // Create pre state
        let mut pre_accounts = BTreeMap::new();
        let pre_state = AlloyAccountState {
            balance: Some(U256::from(1_000_000u64)),
            code: None,
            nonce: Some(10),
            storage: BTreeMap::new(),
        };
        pre_accounts.insert(Address::from([0x22u8; 20]), pre_state);

        // Create post state
        let mut post_accounts = BTreeMap::new();
        let post_state = AlloyAccountState {
            balance: Some(U256::from(900_000u64)),
            code: None,
            nonce: Some(11),
            storage: BTreeMap::new(),
        };
        post_accounts.insert(Address::from([0x22u8; 20]), post_state);

        let diff_mode = DiffMode { pre: pre_accounts, post: post_accounts };
        let prestate_frame = PreStateFrame::Diff(diff_mode);

        // Convert to API response
        let response: PrestateTraceResponse = prestate_frame.into();

        // Verify the conversion
        match response {
            PrestateTraceResponse::Diff(diff) => {
                assert_eq!(diff.pre.len(), 1);
                assert_eq!(diff.post.len(), 1);

                let addr_key = format!("{:?}", Address::from([0x22u8; 20]));

                let pre_account = diff.pre.get(&addr_key).unwrap();
                assert_eq!(pre_account.balance, Some("0xf4240".to_string()));
                assert_eq!(pre_account.nonce, Some(10));

                let post_account = diff.post.get(&addr_key).unwrap();
                assert_eq!(post_account.balance, Some("0xdbba0".to_string()));
                assert_eq!(post_account.nonce, Some(11));
            }
            _ => panic!("Expected Diff mode"),
        }
    }

    #[test]
    fn test_account_state_conversion_with_storage() {
        let mut storage = BTreeMap::new();
        storage.insert(
            B256::from([0x00u8; 32]), // slot 0
            B256::from([0xffu8; 32]), // value
        );
        storage.insert(
            B256::from([0x01u8; 32]), // slot 1
            B256::from([0xaau8; 32]), // value
        );

        let alloy_state = AlloyAccountState {
            balance: Some(U256::from(12345678u64)),
            code: Some(Bytes::from(vec![0x60, 0x00, 0x60, 0x00])),
            nonce: Some(100),
            storage,
        };

        let api_state: AccountState = alloy_state.into();

        assert_eq!(api_state.balance, Some("0xbc614e".to_string()));
        assert_eq!(api_state.nonce, Some(100));
        assert!(api_state.code.is_some());
        assert_eq!(api_state.storage.len(), 2);

        // Verify storage keys are properly formatted
        for key in api_state.storage.keys() {
            assert!(key.starts_with("0x"));
            assert_eq!(key.len(), 66); // 0x + 64 hex chars
        }
    }
}
