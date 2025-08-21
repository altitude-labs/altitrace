//! Trace-specific types and utilities.
//!
//! This module contains types and utilities specific to transaction tracing,
//! moved here from the trace handler module for better organization.

use crate::{handlers::trace::TracingResult, types::TransactionReceiptInfo};

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
