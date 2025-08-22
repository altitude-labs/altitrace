//! Shared utilities for the `altitrace` API.
//!
//! This module contains utility functions, helpers, and common functionality
//! that is used across multiple parts of the application.

use uuid::Uuid;

pub mod validation;

pub use validation::*;

/// Generate a unique request ID.
pub fn generate_request_id() -> String {
    format!("req_{}", Uuid::new_v4())
}

/// Helper for generating unique trace identifiers.
pub fn generate_trace_id() -> String {
    format!("trace_{}", Uuid::new_v4())
}

/// Helper for generating batch identifiers.
pub fn generate_batch_id() -> String {
    format!("batch_{}", Uuid::new_v4())
}

/// Helper for generating access list identifiers.
pub fn generate_access_list_id() -> String {
    format!("access_list_{}", Uuid::new_v4())
}
