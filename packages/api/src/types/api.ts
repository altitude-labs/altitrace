import { z } from 'zod';

// Base schemas
export const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address format');
export const HexSchema = z.string().regex(/^0x[a-fA-F0-9]*$/, 'Invalid hex format');
// Block number is ALWAYS hex (e.g., "0x123abc")
export const BlockNumberSchema = z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid block number hex');

// Block tags are the string literals
export const BlockTagSchema = z.enum(['latest', 'earliest', 'pending', 'safe', 'finalized']);

// State mapping schema for Viem compatibility 
export const StateMappingSchema = z.array(z.object({
  slot: HexSchema,
  value: HexSchema,
}));

// State override schema - matches Viem's StateOverride format
export const StateOverrideEntrySchema = z.object({
  address: AddressSchema,
  balance: z.bigint().optional(),
  nonce: z.number().optional(),
  code: HexSchema.optional(),
  state: StateMappingSchema.optional(),
  stateDiff: StateMappingSchema.optional(),
}).refine(data => !(data.state && data.stateDiff), {
  message: "Cannot specify both 'state' and 'stateDiff' - they are mutually exclusive",
});

export const StateOverrideSchema = z.array(StateOverrideEntrySchema);

export const BlockOverrideSchema = z.object({
  number: HexSchema.optional(),
  timestamp: HexSchema.optional(),
  gasLimit: HexSchema.optional(),
  baseFee: HexSchema.optional(),
  prevRandao: HexSchema.optional(),
});

// Trace configuration
export const TraceConfigSchema = z.object({
  enableMemory: z.boolean().default(false),
  enableReturnData: z.boolean().default(true),
  enableStorage: z.boolean().default(false),
  tracer: z.enum(['callTracer', 'prestateTracer', 'structLogger']).default('callTracer'),
});

// Call schema for simulateCalls
export const CallSchema = z.object({
  to: AddressSchema,
  from: AddressSchema.optional(),
  data: HexSchema.optional(),
  value: HexSchema.optional().default('0x0'),
  gas: HexSchema.optional(),
});

// Simulation request schemas - updated for full Viem simulateCalls API
export const SimulationParamsSchema = z.object({
  calls: z.array(CallSchema).min(1),
  account: AddressSchema.optional(),
  blockNumber: BlockNumberSchema.optional(),
  blockTag: z.enum(['latest', 'earliest', 'pending', 'safe', 'finalized']).optional(),
  validation: z.boolean().optional().default(true),
  traceAssetChanges: z.boolean().optional(),
  traceTransfers: z.boolean().optional(),
});

export const SimulationOptionsSchema = z.object({
  stateOverrides: StateOverrideSchema.optional(),
  blockOverrides: BlockOverrideSchema.optional(),
  traceConfig: TraceConfigSchema.optional(),
});

export const SimulateRequestSchema = z.object({
  params: SimulationParamsSchema,
  options: SimulationOptionsSchema.optional(),
});

export const BatchSimulateRequestSchema = z.object({
  simulations: z.array(SimulateRequestSchema).min(1).max(100),
});

/**
 * Decoded event parameter schema for human-readable logs
 */
export const DecodedEventParamSchema = z.object({
  /** Parameter name */
  name: z.string(),
  /** Parameter type (address, uint256, bool, etc.) */
  type: z.string(),
  /** Formatted parameter value */
  value: z.string(),
  /** Whether this parameter was indexed in the event */
  indexed: z.boolean(),
});

/**
 * Decoded event schema for human-readable event information
 */
export const DecodedEventSchema = z.object({
  /** Event name (Transfer, Approval, etc.) */
  name: z.string(),
  /** Event signature hash */
  signature: HexSchema,
  /** Token/Contract standard (ERC20, ERC721, Uniswap V2, etc.) */
  standard: z.string().optional(),
  /** Human-readable description of the event */
  description: z.string(),
  /** Decoded parameters with names and formatted values */
  params: z.array(DecodedEventParamSchema),
  /** One-line human-readable summary */
  summary: z.string(),
});

/**
 * Enhanced log entry schema with human-readable event decoding
 * Fields marked as nullable when log is pending
 */
export const LogEntrySchema = z.object({
  /** The address from which this log originated */
  address: AddressSchema,
  /** Hash of block containing this log or null if pending */
  blockHash: HexSchema.nullable(),
  /** Number of block containing this log or null if pending */
  blockNumber: HexSchema.nullable(),
  /** Contains the non-indexed arguments of the log */
  data: HexSchema,
  /** Index of this log within its block or null if pending */
  logIndex: HexSchema.nullable(),
  /** Hash of the transaction that created this log or null if pending */
  transactionHash: HexSchema.nullable(),
  /** Index of the transaction that created this log or null if pending */
  transactionIndex: HexSchema.nullable(),
  /** List of order-dependent topics */
  topics: z.array(HexSchema),
  /** True if this filter has been destroyed and is invalid */
  removed: z.boolean(),
  /** Human-readable decoded event information (if recognizable) */
  decoded: DecodedEventSchema.optional(),
});

export const AccessListEntrySchema = z.object({
  address: AddressSchema,
  storageKeys: z.array(HexSchema),
});

export const StateChangeSchema = z.object({
  address: AddressSchema,
  before: z.object({
    balance: HexSchema,
    nonce: HexSchema,
    code: HexSchema.optional(),
    storage: z.record(HexSchema, HexSchema).optional(),
  }),
  after: z.object({
    balance: HexSchema,
    nonce: HexSchema,
    code: HexSchema.optional(),
    storage: z.record(HexSchema, HexSchema).optional(),
  }),
});

/**
 * Detailed error information for failed contract calls
 * Based on viem's ContractFunctionRevertedError and related types
 */
export const ContractErrorSchema = z.object({
  /** Human-readable error reason */
  reason: z.string().optional(),
  /** Error type (e.g., 'Error(string)', 'Panic(uint256)', 'Custom error') */
  type: z.string(),
  /** Detailed error message */
  message: z.string().optional(),
  /** Contract address that threw the error */
  contractAddress: AddressSchema.optional(),
  /** Function name that caused the error */
  functionName: z.string().optional(),
  /** Raw error data from the contract */
  data: HexSchema.optional(),
  /** Error signature for custom errors */
  signature: HexSchema.optional(),
});

/**
 * Call result schema for simulateCalls response
 * Matches viem's MulticallResponse structure with HyperEVM extensions
 */
export const CallResultSchema = z.object({
  /** Index of this call in the batch */
  callIndex: z.number(),
  /** Execution status */
  status: z.enum(['success', 'reverted']),
  /** Return data from the call */
  returnData: HexSchema,
  /** Gas consumed by this call */
  gasUsed: HexSchema,
  /** Logs emitted by this call */
  logs: z.array(LogEntrySchema).optional().default([]),
  /** Detailed error information (only present if status is 'reverted') */
  error: ContractErrorSchema.optional(),
});

/**
 * Asset change schema matching Viem's SimulateCallsReturnType.assetChanges
 * Tracks token balance changes for an account during simulation
 */
export const AssetChangeSchema = z.object({
  /** Token information */
  token: z.object({
    /** Token contract address */
    address: AddressSchema,
    /** Token decimals (if available) */
    decimals: z.number().optional(),
    /** Token symbol (if available) */
    symbol: z.string().optional(),
  }),
  /** Balance change information */
  value: z.object({
    /** Balance before simulation (as hex string) */
    pre: HexSchema,
    /** Balance after simulation (as hex string) */
    post: HexSchema,
    /** Net change (post - pre, as hex string) */
    diff: HexSchema,
  }),
});

/**
 * Performance metrics for simulation analysis
 * Addresses hackathon requirement for "granular gas usage breakdown by operation"
 */
export const PerformanceMetricsSchema = z.object({
  /** Total execution time in milliseconds */
  executionTime: z.number(),
  /** Gas usage breakdown by operation type */
  gasBreakdown: z.object({
    /** Gas used for basic operations (SLOAD, SSTORE, etc.) */
    basic: HexSchema,
    /** Gas used for contract calls */
    calls: HexSchema,
    /** Gas used for contract creation */
    creation: HexSchema,
    /** Gas used for memory operations */
    memory: HexSchema,
    /** Gas used for transaction overhead */
    transaction: HexSchema,
  }).optional(),
  /** Number of state reads performed */
  stateReads: z.number().optional(),
  /** Number of state writes performed */
  stateWrites: z.number().optional(),
  /** Peak memory usage during simulation */
  peakMemoryUsage: z.number().optional(),
});

/**
 * Enhanced simulation result with performance metrics and HyperEVM extensions
 */
export const SimulationResultSchema = z.object({
  blockNumber: HexSchema,
  calls: z.array(CallResultSchema),
  gasUsed: HexSchema,
  blockGasUsed: HexSchema,
  assetChanges: z.array(AssetChangeSchema).optional(),
  /** Performance metrics for gas profiling and optimization */
  performance: PerformanceMetricsSchema.optional(),
  /** Access list generated during simulation (for optimization) */
  accessList: z.array(z.object({
    address: AddressSchema,
    storageKeys: z.array(HexSchema),
  })).optional(),
});

// Type exports
export type Address = z.infer<typeof AddressSchema>;
export type Hex = z.infer<typeof HexSchema>;
export type BlockNumber = z.infer<typeof BlockNumberSchema>;
export type BlockTag = z.infer<typeof BlockTagSchema>;
export type Call = z.infer<typeof CallSchema>;
export type CallResult = z.infer<typeof CallResultSchema>;
export type StateMapping = z.infer<typeof StateMappingSchema>;
export type StateOverrideEntry = z.infer<typeof StateOverrideEntrySchema>;
export type StateOverride = z.infer<typeof StateOverrideSchema>;
export type BlockOverride = z.infer<typeof BlockOverrideSchema>;
export type TraceConfig = z.infer<typeof TraceConfigSchema>;
export type SimulationParams = z.infer<typeof SimulationParamsSchema>;
export type SimulationOptions = z.infer<typeof SimulationOptionsSchema>;
export type SimulateRequest = z.infer<typeof SimulateRequestSchema>;
export type BatchSimulateRequest = z.infer<typeof BatchSimulateRequestSchema>;
export type DecodedEventParam = z.infer<typeof DecodedEventParamSchema>;
export type DecodedEvent = z.infer<typeof DecodedEventSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
export type AccessListEntry = z.infer<typeof AccessListEntrySchema>;
export type StateChange = z.infer<typeof StateChangeSchema>;
export type AssetChange = z.infer<typeof AssetChangeSchema>;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;
export type SimulationResult = z.infer<typeof SimulationResultSchema>;

/**
 * Bundle simulation request for testing interdependent transactions
 * Addresses hackathon requirement for "bundle simulations"
 */
export const BundleSimulationSchema = z.object({
  /** Array of transaction calls to execute in sequence */
  bundle: z.array(z.object({
    /** Transaction calls */
    calls: z.array(CallSchema).min(1),
    /** Account to execute from */
    account: AddressSchema.optional(),
    /** Gas limit for this transaction */
    gasLimit: HexSchema.optional(),
    /** Whether this transaction can fail without stopping the bundle */
    allowFailure: z.boolean().default(false),
  })).min(1).max(10),
  /** Block parameters for simulation */
  blockNumber: BlockNumberSchema.optional(),
  blockTag: BlockTagSchema.optional(),
  /** State overrides applied to the entire bundle */
  stateOverrides: StateOverrideSchema.optional(),
  /** Block parameter overrides */
  blockOverrides: BlockOverrideSchema.optional(),
  /** Enable asset change tracking */
  traceAssetChanges: z.boolean().optional(),
  /** Enable transfer tracing */
  traceTransfers: z.boolean().optional(),
  /** Enable performance profiling */
  enableProfiling: z.boolean().default(false),
});

export const BundleSimulationResultSchema = z.object({
  /** Block information */
  blockNumber: HexSchema,
  /** Results for each transaction in the bundle */
  transactions: z.array(z.object({
    /** Transaction index in bundle */
    transactionIndex: z.number(),
    /** Status of this transaction */
    status: z.enum(['success', 'reverted', 'skipped']),
    /** Call results within this transaction */
    calls: z.array(CallResultSchema),
    /** Gas used by this transaction */
    gasUsed: HexSchema,
    /** Why this transaction was skipped (if applicable) */
    skipReason: z.string().optional(),
  })),
  /** Total gas used by entire bundle */
  totalGasUsed: HexSchema,
  /** Block gas used after bundle execution */
  blockGasUsed: HexSchema,
  /** Asset changes across the entire bundle */
  assetChanges: z.array(AssetChangeSchema).optional(),
  /** Performance metrics for the bundle */
  performance: PerformanceMetricsSchema.optional(),
  /** Generated access list for gas optimization */
  accessList: z.array(AccessListEntrySchema).optional(),
});

export type BundleSimulation = z.infer<typeof BundleSimulationSchema>;
export type BundleSimulationResult = z.infer<typeof BundleSimulationResultSchema>;

// API Response wrapper
export const ApiResponseSchema = <T>(dataSchema: z.ZodType<T>) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  timestamp: z.string(),
  requestId: z.string(),
});

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
};