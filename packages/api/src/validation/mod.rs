//! Unified validation module.
//!
//! This module consolidates all validation logic that was previously
//! scattered across multiple modules, providing a single source of truth
//! for validation rules and error handling.

pub mod address;
pub mod block;
pub mod hex;

// Re-export all validation functions for easy access
pub use address::*;
pub use block::*;
pub use hex::*;

use crate::types::primitives::PrimitiveError;

/// Common validation result type.
pub type ValidationResult = Result<(), PrimitiveError>;

/// Trait for types that can validate themselves.
pub trait Validate {
    fn validate(&self) -> ValidationResult;
}

// validate_chain macro already defined in utils/validation.rs

/// Helper macro for custom validation functions used with validator crate.
#[macro_export]
macro_rules! custom_validator {
    ($fn_name:ident, $validation_fn:path) => {
        pub fn $fn_name(value: &str) -> Result<(), validator::ValidationError> {
            $validation_fn(value).map_err(|e| {
                let mut error = validator::ValidationError::new(stringify!($fn_name));
                error.message = Some(std::borrow::Cow::Owned(e.to_string()));
                error
            })
        }
    };
}
