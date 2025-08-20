//! Shared type definitions and conversions between alloy and altitrace-api types
//!
//! This module contains common types, conversions, and utilities that are used
//! across multiple handlers and services. It provides a clean separation between
//! domain-specific logic and shared infrastructure.

pub mod conversion;
pub mod primitives;
pub mod shared;
pub mod trace;
pub mod transaction;

pub use conversion::*;
pub use primitives::*;
pub use shared::*;
pub use trace::*;
pub use transaction::*;
