//! `HyperEVM` service module providing simulation capabilities.
//!
//! This module integrates with `HyperEVM` through Alloy RPC types and provides
//! high-level simulation services for the API layer.

mod simulation;

use super::RpcProvider;

/// Re-export the main service
pub use simulation::HyperEvmService;
