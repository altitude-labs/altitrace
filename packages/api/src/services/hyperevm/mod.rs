//! `HyperEVM` service module providing simulation capabilities.
//!
//! This module integrates with `HyperEVM` through Alloy RPC types and provides
//! high-level simulation services for the API layer.

pub mod service;

use super::RpcProvider;

pub use service::HyperEvmService;
