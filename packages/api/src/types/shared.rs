//! Shared types used across multiple modules.
//!
//! This module contains common type definitions that are used by multiple
//! parts of the application to avoid duplication and ensure consistency.

use std::collections::{BTreeMap, HashMap};

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use crate::handlers::validation::{validate_address, validate_bytes32, validate_uint256};

/// State override for simulation and tracing.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StateOverride {
    /// Account balance override (hex-encoded wei).
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "crate::handlers::validation::validate_hex_string"))]
    #[schema(example = "0x1e8480")]
    pub balance: Option<String>,

    /// Account nonce override.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nonce: Option<u64>,

    /// Contract code override (hex-encoded).
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "crate::handlers::validation::validate_hex_string"))]
    #[schema(example = "0x608060405234801561001057600080fd5b50")]
    pub code: Option<String>,

    /// Complete storage override (replaces all storage).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage: Option<HashMap<String, String>>,

    /// Differential storage override (modifies specific slots).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state_diff: Option<HashMap<String, String>>,

    /// Account address
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "crate::handlers::validation::validate_address"))]
    #[schema(example = "0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c")]
    pub address: Option<String>,

    /// Storage slots
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<Vec<StorageSlot>>,

    /// Move precompile contract
    #[serde(skip_serializing_if = "Option::is_none", rename = "movePrecompileToAddress")]
    #[validate(custom(function = "crate::handlers::validation::validate_address"))]
    pub move_precompile_to_address: Option<String>,
}

/// Block environment overrides for simulation.
///
/// These overrides allow modifying the block context in which the simulation runs,
/// including block number, timestamp, gas parameters, and more.
#[derive(Debug, Clone, Default, Deserialize, Serialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BlockOverrides {
    /// Override the block number.
    /// For `eth_simulateV1`, this will be the first simulated block number.
    /// Note: Different clients use different field names (geth: "number", erigon: "blockNumber").
    #[serde(skip_serializing_if = "Option::is_none", alias = "blockNumber")]
    #[validate(custom(function = "validate_uint256"))]
    #[schema(example = "0x1234567", pattern = "^0x[a-fA-F0-9]*$")]
    pub number: Option<String>,

    /// Override the block difficulty (pre-merge chains).
    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(custom(function = "validate_uint256"))]
    #[schema(example = "0x0", pattern = "^0x[a-fA-F0-9]*$")]
    pub difficulty: Option<String>,

    /// Override the block timestamp (Unix timestamp in seconds).
    /// Note: Different clients use different field names (geth: "time", erigon: "timestamp").
    #[serde(skip_serializing_if = "Option::is_none", alias = "timestamp")]
    #[schema(example = 1700000000)]
    pub time: Option<u64>,

    /// Override the block gas limit.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = 30000000)]
    pub gas_limit: Option<u64>,

    /// Override the block coinbase (miner/fee recipient).
    #[serde(skip_serializing_if = "Option::is_none", alias = "feeRecipient")]
    #[validate(custom(function = "validate_address"))]
    #[schema(
        example = "0x0000000000000000000000000000000000000000",
        pattern = "^0x[a-fA-F0-9]{40}$"
    )]
    pub coinbase: Option<String>,

    /// Override the prevRandao value (post-merge).
    /// This replaces the difficulty field in post-merge chains.
    #[serde(skip_serializing_if = "Option::is_none", alias = "prevRandao")]
    #[validate(custom(function = "validate_bytes32"))]
    #[schema(
        example = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        pattern = "^0x[a-fA-F0-9]{64}$"
    )]
    pub random: Option<String>,

    /// Override the base fee per gas (EIP-1559).
    #[serde(skip_serializing_if = "Option::is_none", alias = "baseFeePerGas")]
    #[validate(custom(function = "validate_uint256"))]
    #[schema(example = "0x3b9aca00", pattern = "^0x[a-fA-F0-9]*$")]
    pub base_fee: Option<String>,

    /// Custom block hash mappings for the BLOCKHASH opcode.
    /// Maps block numbers to their corresponding block hashes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_hash: Option<BTreeMap<String, String>>,
}

/// Storage slot definition for state overrides.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StorageSlot {
    /// Storage slot key (32 bytes, hex-encoded).
    #[validate(custom(function = "crate::handlers::validation::validate_bytes32"))]
    #[schema(example = "0x0000000000000000000000000000000000000000000000000000000000000001")]
    pub slot: String,

    /// Storage slot value (32 bytes, hex-encoded).
    #[validate(custom(function = "crate::handlers::validation::validate_bytes32"))]
    #[schema(example = "0x0000000000000000000000000000000000000000000000000000000000000064")]
    pub value: String,
}

/// Generic storage slot access information.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StorageSlotAccess<T> {
    /// Storage slot key (32 bytes, hex-encoded).
    #[schema(example = "0x0000000000000000000000000000000000000000000000000000000000000001")]
    pub slot: String,

    /// Value associated with this access.
    #[serde(flatten)]
    pub value: T,

    /// Gas cost for this access.
    pub gas_cost: u64,

    /// Operation that accessed this slot.
    #[schema(example = "SSTORE")]
    pub operation: String,

    /// Program counter when access occurred.
    pub pc: u64,
}

/// Storage value with before/after states for writes.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StorageValue {
    /// Value before access (for writes).
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "0x0000000000000000000000000000000000000000000000000000000000000000")]
    pub value_before: Option<String>,

    /// Value after access.
    #[schema(example = "0x0000000000000000000000000000000000000000000000000000000000000064")]
    pub value_after: String,
}

/// Simple storage value for transient storage.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SimpleStorageValue {
    /// Storage value.
    #[schema(example = "0x0000000000000000000000000000000000000000000000000000000000000064")]
    pub value: String,
}

/// Type aliases for specific storage access types.
pub type RegularStorageSlotAccess = StorageSlotAccess<StorageValue>;
pub type TransientSlotAccess = StorageSlotAccess<SimpleStorageValue>;

/// Generic gas breakdown structure that can work with different field types.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GasBreakdown<T = u64> {
    /// Intrinsic transaction cost (21,000 gas base cost).
    pub intrinsic: T,

    /// Gas used for computation (opcodes execution).
    pub computation: T,

    /// Gas used for storage operations.
    pub storage: StorageGasBreakdown<T>,

    /// Gas used for memory expansion.
    pub memory: T,

    /// Gas used for emitting event logs.
    pub logs: T,

    /// Gas used for external contract calls.
    pub calls: T,

    /// Gas used for contract creation.
    pub creates: T,

    /// Gas refunded due to storage cleanup or other refunds.
    pub refund: T,

    /// Gas cost for access list (EIP-2930).
    pub access_list: T,
}

/// Storage operation gas usage breakdown with generic field types.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageGasBreakdown<T = u64> {
    /// Gas used for storage read operations (SLOAD).
    pub reads: T,

    /// Gas used for storage write operations (SSTORE).
    pub writes: T,

    /// Gas used for storage initialization.
    pub initialization: T,

    /// Gas used for storage modifications.
    pub modifications: T,

    /// Gas refunded from storage cleanup.
    pub cleanup_refund: T,
}

/// Base log entry structure used across different contexts.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    /// Contract address that emitted the log.
    #[schema(example = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")]
    pub address: String,

    /// Log topics.
    pub topics: Vec<String>,

    /// Log data (hex-encoded).
    #[schema(example = "0x00000000000000000000000000000000000000000000000000000000000f4240")]
    pub data: String,
}

/// Extended log entry with additional trace context.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceLogEntry {
    /// Base log information.
    #[serde(flatten)]
    pub log: LogEntry,

    /// Block number where log was emitted.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_number: Option<u64>,

    /// Transaction index in block.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_index: Option<u64>,

    /// Log index in transaction.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_index: Option<u64>,
}

/// Default implementations for gas breakdowns.
impl Default for GasBreakdown<u64> {
    fn default() -> Self {
        Self {
            intrinsic: 0,
            computation: 0,
            storage: StorageGasBreakdown::default(),
            memory: 0,
            logs: 0,
            calls: 0,
            creates: 0,
            refund: 0,
            access_list: 0,
        }
    }
}

impl Default for StorageGasBreakdown<u64> {
    fn default() -> Self {
        Self { reads: 0, writes: 0, initialization: 0, modifications: 0, cleanup_refund: 0 }
    }
}

/// Conversion utilities for gas breakdown types.
impl GasBreakdown<u64> {
    /// Convert to string-based gas breakdown for API responses.
    pub fn to_string_breakdown(&self) -> GasBreakdown<String> {
        GasBreakdown {
            intrinsic: self.intrinsic.to_string(),
            computation: self.computation.to_string(),
            storage: self.storage.to_string_breakdown(),
            memory: self.memory.to_string(),
            logs: self.logs.to_string(),
            calls: self.calls.to_string(),
            creates: self.creates.to_string(),
            refund: self.refund.to_string(),
            access_list: self.access_list.to_string(),
        }
    }

    /// Convert to hex-based gas breakdown.
    pub fn to_hex_breakdown(&self) -> GasBreakdown<String> {
        GasBreakdown {
            intrinsic: format!("0x{:x}", self.intrinsic),
            computation: format!("0x{:x}", self.computation),
            storage: self.storage.to_hex_breakdown(),
            memory: format!("0x{:x}", self.memory),
            logs: format!("0x{:x}", self.logs),
            calls: format!("0x{:x}", self.calls),
            creates: format!("0x{:x}", self.creates),
            refund: format!("0x{:x}", self.refund),
            access_list: format!("0x{:x}", self.access_list),
        }
    }
}

impl StorageGasBreakdown<u64> {
    /// Convert to string-based storage gas breakdown.
    pub fn to_string_breakdown(&self) -> StorageGasBreakdown<String> {
        StorageGasBreakdown {
            reads: self.reads.to_string(),
            writes: self.writes.to_string(),
            initialization: self.initialization.to_string(),
            modifications: self.modifications.to_string(),
            cleanup_refund: self.cleanup_refund.to_string(),
        }
    }

    /// Convert to hex-based storage gas breakdown.
    pub fn to_hex_breakdown(&self) -> StorageGasBreakdown<String> {
        StorageGasBreakdown {
            reads: format!("0x{:x}", self.reads),
            writes: format!("0x{:x}", self.writes),
            initialization: format!("0x{:x}", self.initialization),
            modifications: format!("0x{:x}", self.modifications),
            cleanup_refund: format!("0x{:x}", self.cleanup_refund),
        }
    }
}

/// State override validation implementations.
impl StateOverride {
    /// Validates that `state` and `state_diff` are mutually exclusive.
    pub const fn validate_state_exclusivity(&self) -> Result<(), &'static str> {
        if self.state.is_some() && self.state_diff.is_some() {
            return Err("Cannot specify both 'state' and 'state_diff' - they are mutually exclusive");
        }
        Ok(())
    }
}
