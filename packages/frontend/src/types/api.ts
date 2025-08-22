// Frontend types matching the API schema

export type Address = `0x${string}`
export type Hex = `0x${string}`
export type BlockNumber = string // hex string like "0x123abc"
export type BlockTag = 'latest' | 'earliest' | 'safe' | 'finalized'

// Note: API contract types are provided by @altitrace/sdk. Only UI-local types remain here.

// Access list types for UI components
export interface AccessListSummary {
  address: string
  storageSlotCount: number
  storageSlots: string[]
}

export interface AccessListDisplayData {
  accountCount: number
  totalStorageSlots: number
  gasUsed: string
  isSuccess: boolean
  error?: string
  summary: AccessListSummary[]
}

// ABI and function types for the UI
export interface AbiFunction {
  name: string
  type: 'function' | 'constructor' | 'receive' | 'fallback'
  inputs: AbiParameter[]
  outputs?: AbiParameter[]
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable'
}

export interface AbiParameter {
  name: string
  type: string
  components?: AbiParameter[] // for tuple types
  indexed?: boolean // for events
}

export interface ParsedAbi {
  functions: AbiFunction[]
  events: unknown[] // TODO: Define this later if needed
  errors: unknown[] // TODO: Define this later if needed
}

// UI state types
export interface FormErrors {
  [key: string]: string
}

// If needed by UI-local state, prefer SDK result types at usage sites
