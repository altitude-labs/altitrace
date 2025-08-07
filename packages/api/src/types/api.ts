import { z } from 'zod';

// Base schemas
export const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address format');
export const HexSchema = z.string().regex(/^0x[a-fA-F0-9]*$/, 'Invalid hex format');
export const BlockNumberSchema = z.union([
  z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid block number hex'),
  z.literal('latest'),
  z.literal('earliest'),
  z.literal('pending'),
]);

// State override schemas
export const StateOverrideSchema = z.object({
  balance: HexSchema.optional(),
  nonce: HexSchema.optional(),
  code: HexSchema.optional(),
  storage: z.record(HexSchema, HexSchema).optional(),
});

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

// Simulation request schemas
export const SimulationParamsSchema = z.object({
  to: AddressSchema,
  from: AddressSchema.optional(),
  data: HexSchema.optional(),
  value: HexSchema.optional().default('0x0'),
  gas: HexSchema.optional(),
  gasPrice: HexSchema.optional(),
  maxFeePerGas: HexSchema.optional(),
  maxPriorityFeePerGas: HexSchema.optional(),
  blockNumber: BlockNumberSchema.optional().default('latest'),
});

export const SimulationOptionsSchema = z.object({
  stateOverrides: z.record(AddressSchema, StateOverrideSchema).optional(),
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

// Response schemas
export const LogEntrySchema = z.object({
  address: AddressSchema,
  topics: z.array(HexSchema),
  data: HexSchema,
  blockNumber: HexSchema,
  transactionHash: HexSchema,
  transactionIndex: HexSchema,
  blockHash: HexSchema,
  logIndex: HexSchema,
  removed: z.boolean(),
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

export const SimulationResultSchema = z.object({
  success: z.boolean(),
  gasUsed: HexSchema,
  gasLimit: HexSchema,
  returnData: HexSchema,
  revertReason: z.string().optional(),
  logs: z.array(LogEntrySchema).optional(),
  stateChanges: z.array(StateChangeSchema).optional(),
  accessList: z.array(AccessListEntrySchema).optional(),
  trace: z.any().optional(), // Will be typed more strictly later
});

// Type exports
export type Address = z.infer<typeof AddressSchema>;
export type Hex = z.infer<typeof HexSchema>;
export type BlockNumber = z.infer<typeof BlockNumberSchema>;
export type StateOverride = z.infer<typeof StateOverrideSchema>;
export type BlockOverride = z.infer<typeof BlockOverrideSchema>;
export type TraceConfig = z.infer<typeof TraceConfigSchema>;
export type SimulationParams = z.infer<typeof SimulationParamsSchema>;
export type SimulationOptions = z.infer<typeof SimulationOptionsSchema>;
export type SimulateRequest = z.infer<typeof SimulateRequestSchema>;
export type BatchSimulateRequest = z.infer<typeof BatchSimulateRequestSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
export type AccessListEntry = z.infer<typeof AccessListEntrySchema>;
export type StateChange = z.infer<typeof StateChangeSchema>;
export type SimulationResult = z.infer<typeof SimulationResultSchema>;

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