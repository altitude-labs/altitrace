use alloy_primitives::{Address, U256};
use serde::Serialize;

#[derive(Debug, Clone, thiserror::Error, Serialize)]
#[serde(tag = "type")]
pub enum ExecutionError {
    #[error("Transaction reverted: {reason}")]
    Reverted {
        reason: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        revert_data: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        gas_used: Option<U256>,
    },

    #[error("Transaction ran out of gas")]
    OutOfGas { gas_limit: U256, gas_used: U256 },

    #[error("Insufficient funds for transfer")]
    InsufficientFunds { balance: U256, required: U256, address: Address },

    #[error("Contract creation failed")]
    ContractCreationFailed {
        reason: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        init_code: Option<String>,
    },

    #[error("Invalid opcode: {opcode}")]
    InvalidOpcode { opcode: String },

    #[error("Stack underflow at position {position}")]
    StackUnderflow { position: usize },

    #[error("Stack overflow: maximum depth exceeded")]
    StackOverflow,

    #[error("Invalid jump destination")]
    InvalidJump,

    #[error("State change during static call")]
    StateChangeInStaticCall,

    #[error("Precompile error: {reason}")]
    PrecompileError { address: Address, reason: String },

    #[error("Call depth exceeded")]
    CallDepthExceeded,

    #[error("Account does not exist: {address}")]
    AccountNotFound { address: Address },

    #[error("Code size exceeds limit")]
    CodeSizeExceeded { size: usize, limit: usize },

    #[error("Nonce mismatch: expected {expected}, got {actual}")]
    NonceMismatch { expected: u64, actual: u64 },

    #[error("Transaction underpriced")]
    Underpriced { gas_price: U256, base_fee: U256 },

    #[error("Gas limit exceeded block limit")]
    GasLimitExceeded { tx_gas_limit: U256, block_gas_limit: U256 },
}

impl ExecutionError {
    pub fn reverted(reason: impl Into<String>) -> Self {
        Self::Reverted { reason: reason.into(), revert_data: None, gas_used: None }
    }

    pub fn reverted_with_data(reason: impl Into<String>, data: String) -> Self {
        Self::Reverted { reason: reason.into(), revert_data: Some(data), gas_used: None }
    }

    pub const fn out_of_gas(gas_limit: U256, gas_used: U256) -> Self {
        Self::OutOfGas { gas_limit, gas_used }
    }

    pub const fn insufficient_funds(balance: U256, required: U256, address: Address) -> Self {
        Self::InsufficientFunds { balance, required, address }
    }

    pub fn contract_creation_failed(reason: impl Into<String>) -> Self {
        Self::ContractCreationFailed { reason: reason.into(), init_code: None }
    }

    pub fn precompile_error(address: Address, reason: impl Into<String>) -> Self {
        Self::PrecompileError { address, reason: reason.into() }
    }

    pub const fn code_size_exceeded(size: usize, limit: usize) -> Self {
        Self::CodeSizeExceeded { size, limit }
    }

    pub const fn nonce_mismatch(expected: u64, actual: u64) -> Self {
        Self::NonceMismatch { expected, actual }
    }

    pub const fn underpriced(gas_price: U256, base_fee: U256) -> Self {
        Self::Underpriced { gas_price, base_fee }
    }

    pub const fn gas_limit_exceeded(tx_gas_limit: U256, block_gas_limit: U256) -> Self {
        Self::GasLimitExceeded { tx_gas_limit, block_gas_limit }
    }

    pub const fn is_revert(&self) -> bool {
        matches!(self, Self::Reverted { .. })
    }

    pub const fn is_out_of_gas(&self) -> bool {
        matches!(self, Self::OutOfGas { .. })
    }

    pub const fn error_type(&self) -> &'static str {
        match self {
            Self::Reverted { .. } => "execution-reverted",
            Self::OutOfGas { .. } => "out-of-gas",
            Self::InsufficientFunds { .. } => "insufficient-funds",
            Self::ContractCreationFailed { .. } => "contract-creation-failed",
            Self::InvalidOpcode { .. } => "invalid-opcode",
            Self::StackUnderflow { .. } => "stack-underflow",
            Self::StackOverflow => "stack-overflow",
            Self::InvalidJump => "invalid-jump",
            Self::StateChangeInStaticCall => "state-change-static-call",
            Self::PrecompileError { .. } => "precompile-error",
            Self::CallDepthExceeded => "call-depth-exceeded",
            Self::AccountNotFound { .. } => "account-not-found",
            Self::CodeSizeExceeded { .. } => "code-size-exceeded",
            Self::NonceMismatch { .. } => "nonce-mismatch",
            Self::Underpriced { .. } => "transaction-underpriced",
            Self::GasLimitExceeded { .. } => "gas-limit-exceeded",
        }
    }
}
