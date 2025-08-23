//! Trace-specific types and utilities.
//!
//! This module contains types and utilities specific to transaction tracing,
//! moved here from the trace handler module for better organization.

use crate::{
    handlers::{trace::TracingResult, validation::validate_block_number_or_tag},
    types::TransactionReceiptInfo,
    utils::default_latest,
};
use alloy_rpc_types::{
    BlockId, StateContext as AlloyStateContext, TransactionIndex as AlloyTransactionIndex,
};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use utoipa::ToSchema;
use validator::Validate;

/// Response for a trace operation.
#[derive(Debug)]
pub struct TraceResponse {
    /// The trace result.
    pub trace_result: TracingResult,

    /// The transaction receipt.
    pub receipt: Option<TransactionReceiptInfo>,
}

impl TraceResponse {
    /// Create a new [`TraceResponse`].
    pub const fn new(trace_result: TracingResult) -> Self {
        Self { trace_result, receipt: None }
    }

    pub fn with_receipt(self, receipt: TransactionReceiptInfo) -> Self {
        Self { trace_result: self.trace_result, receipt: Some(receipt) }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct StateContext {
    /// The block number or tag.
    #[validate(custom(function = "validate_block_number_or_tag"))]
    #[serde(default = "default_latest")]
    #[schema(example = "10000000")]
    pub block: String,
    /// The transaction index in the block.
    #[serde(default)]
    #[schema(example = "-1")]
    pub tx_index: TxIndex,
}

impl std::default::Default for StateContext {
    fn default() -> Self {
        Self { block: default_latest(), tx_index: TxIndex::default() }
    }
}

impl From<StateContext> for AlloyStateContext {
    fn from(state_context: StateContext) -> Self {
        let block_number = BlockId::from_str(&state_context.block).unwrap_or_default();
        Self {
            block_number: Some(block_number),
            transaction_index: Some(state_context.tx_index.into()),
        }
    }
}

#[derive(Debug, Default, Clone, PartialEq, Eq, ToSchema)]
pub enum TxIndex {
    /// End of the block. -1 is used to indicate the end of the block.
    #[default]
    #[schema(rename = "-1")]
    End,
    /// Transaction given index.
    Index(usize),
}

impl From<TxIndex> for AlloyTransactionIndex {
    fn from(tx_index: TxIndex) -> Self {
        match tx_index {
            TxIndex::End => Self::All,
            TxIndex::Index(index) => Self::Index(index),
        }
    }
}

impl From<usize> for TxIndex {
    fn from(index: usize) -> Self {
        Self::Index(index)
    }
}

impl serde::Serialize for TxIndex {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            Self::End => serializer.serialize_i8(-1),
            Self::Index(idx) => idx.serialize(serializer),
        }
    }
}

impl<'de> serde::Deserialize<'de> for TxIndex {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        match isize::deserialize(deserializer)? {
            -1 => Ok(Self::End),
            idx if idx < -1 => Err(serde::de::Error::custom(format!(
                "Invalid transaction index, expected -1 or positive integer, got {idx}"
            ))),
            idx => Ok(Self::Index(idx as usize)),
        }
    }
}
