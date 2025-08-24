import { StateOverrideHelpers } from '@altitrace/sdk/builders/helpers/state-override'
import type { StoredContract } from './contract-storage'

/**
 * Utilities for handling contracts with modified bytecode using state overrides
 */

/**
 * Extract block tag from simulation parameters
 */
function extractBlockTag(params: {
  blockNumber?: string | null
  blockTag?: string | null
}): string {
  // Prefer blockNumber if available, then blockTag, then default to latest
  return params.blockNumber || params.blockTag || 'latest'
}

export interface BytecodeComparison {
  localBytecode: string
  deployedBytecode: string | null
  isIdentical: boolean
  deployedSize: number
  localSize: number
  fetchError?: string
}

export interface ContractStateOverride {
  address: string
  hasModifiedCode: boolean
  stateOverride?: Record<string, any>
  requiresOverride: boolean
  bytecodeComparison?: BytecodeComparison
}

/**
 * Fetch deployed bytecode from a contract address using RPC at specific block
 */
async function fetchDeployedBytecode(
  address: string,
  blockTag = 'latest',
): Promise<string | null> {
  try {
    // Use a public RPC endpoint - in production this should be configurable
    const rpcUrl = 'https://eth.llamarpc.com' // Free Ethereum mainnet RPC

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getCode',
        params: [address, blockTag],
        id: 1,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message}`)
    }

    // Return null if no code deployed (returns '0x')
    return data.result === '0x' ? null : data.result
  } catch (_error) {
    return null
  }
}

/**
 * Normalize bytecode for comparison (remove metadata hash and constructor args)
 */
function normalizeBytecode(bytecode: string): string {
  if (!bytecode || bytecode === '0x') return ''

  // Remove '0x' prefix if present
  let normalized = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode

  // Remove trailing constructor arguments and metadata
  // Solidity appends metadata hash at the end, look for the pattern
  // The metadata hash is typically preceded by specific bytecode patterns

  // For now, do basic normalization (convert to lowercase, remove spaces)
  normalized = normalized.toLowerCase().replace(/\s/g, '')

  return normalized
}

/**
 * Compare local and deployed bytecode at specific block
 */
async function compareBytecode(
  address: string,
  localBytecode: string,
  blockTag = 'latest',
): Promise<BytecodeComparison> {
  const deployedBytecode = await fetchDeployedBytecode(address, blockTag)

  const normalizedLocal = normalizeBytecode(localBytecode)
  const normalizedDeployed = deployedBytecode
    ? normalizeBytecode(deployedBytecode)
    : ''

  const comparison: BytecodeComparison = {
    localBytecode: normalizedLocal,
    deployedBytecode: normalizedDeployed || null,
    isIdentical:
      normalizedLocal === normalizedDeployed && normalizedLocal !== '',
    deployedSize: normalizedDeployed.length / 2, // Convert hex chars to bytes
    localSize: normalizedLocal.length / 2,
  }

  // If we couldn't fetch deployed bytecode, note the error
  if (deployedBytecode === null && normalizedLocal !== '') {
    comparison.fetchError = `Could not fetch deployed bytecode at block ${blockTag} - contract may not be deployed or network unreachable`
  }

  return comparison
}

/**
 * Check if a contract requires state override for simulation (async with bytecode comparison)
 */
export async function requiresStateOverrideAsync(
  contract: StoredContract,
  blockTag = 'latest',
): Promise<{ requiresOverride: boolean; comparison?: BytecodeComparison }> {
  const hasAddress = !!contract.contractData?.address
  const hasBytecode = !!contract.contractData?.bytecode

  if (!hasAddress || !hasBytecode) {
    const reason = !hasAddress ? 'No contract address' : 'No local bytecode'
    console.log(`   ❌ Cannot override: ${reason}`)
    return { requiresOverride: false }
  }

  // Compare bytecode to see if override is actually needed
  console.log(
    `   🔄 Comparing local bytecode with deployed bytecode at block ${blockTag}...`,
  )
  const comparison = await compareBytecode(
    contract.contractData!.address!, // We already checked these exist above
    contract.contractData!.bytecode!,
    blockTag,
  )

  console.log('   📊 Bytecode Comparison Results:')
  console.log(`      Local size: ${comparison.localSize} bytes`)
  console.log(`      Deployed size: ${comparison.deployedSize} bytes`)
  console.log(`      Identical: ${comparison.isIdentical}`)

  if (comparison.fetchError) {
    console.log(`      ⚠️ Fetch error: ${comparison.fetchError}`)
  }

  let requiresOverride: boolean

  if (comparison.fetchError) {
    // If we can't fetch deployed bytecode, fall back to assuming override is needed
    console.log(
      '   🤔 Cannot compare - assuming override needed due to fetch error',
    )
    requiresOverride = true
  } else if (comparison.isIdentical) {
    console.log('   ✅ Bytecode identical - no override needed')
    requiresOverride = false
  } else {
    console.log('   ⚡ Bytecode differs - override required')
    requiresOverride = true
  }

  console.log(
    `   🎯 Final Decision: ${requiresOverride ? 'OVERRIDE' : 'NO OVERRIDE'}`,
  )

  return { requiresOverride, comparison }
}

/**
 * Check if a contract requires state override for simulation (legacy sync version)
 * @deprecated Use requiresStateOverrideAsync for better bytecode comparison
 */
export function requiresStateOverride(contract: StoredContract): boolean {
  const hasAddress = !!contract.contractData?.address
  const hasBytecode = !!contract.contractData?.bytecode

  // Simple fallback logic when async comparison isn't possible
  return hasAddress && hasBytecode
}

/**
 * Create state override for a contract with smart bytecode comparison (recommended)
 */
export async function createContractStateOverrideAsync(
  contract: StoredContract,
  blockTag = 'latest',
): Promise<ContractStateOverride> {
  // Use smart comparison to determine if override is actually needed
  const { requiresOverride, comparison } = await requiresStateOverrideAsync(
    contract,
    blockTag,
  )

  const result: ContractStateOverride = {
    address: contract.contractData?.address || '',
    hasModifiedCode: !!contract.contractData?.bytecode,
    requiresOverride,
    bytecodeComparison: comparison,
  }

  if (
    result.requiresOverride &&
    contract.contractData?.address &&
    contract.contractData?.bytecode
  ) {
    // Use SDK helper to create state override with new bytecode
    result.stateOverride = StateOverrideHelpers.setCode(
      contract.contractData.address,
      contract.contractData.bytecode,
    )
  }

  return result
}

/**
 * Create state override using simulation params for block context (convenience method)
 */
export async function createContractStateOverrideForSimulation(
  contract: StoredContract,
  simulationParams: { blockNumber?: string | null; blockTag?: string | null },
): Promise<ContractStateOverride> {
  const blockTag = extractBlockTag(simulationParams)
  return createContractStateOverrideAsync(contract, blockTag)
}

/**
 * Create state override for a contract with modified bytecode (legacy sync version)
 * @deprecated Use createContractStateOverrideAsync for smart bytecode comparison
 */
export function createContractStateOverride(
  contract: StoredContract,
): ContractStateOverride {
  const result: ContractStateOverride = {
    address: contract.contractData?.address || '',
    hasModifiedCode: !!contract.contractData?.bytecode,
    requiresOverride: requiresStateOverride(contract),
  }

  if (
    result.requiresOverride &&
    contract.contractData?.address &&
    contract.contractData?.bytecode
  ) {
    // Use SDK helper to create state override with new bytecode
    result.stateOverride = StateOverrideHelpers.setCode(
      contract.contractData.address,
      contract.contractData.bytecode,
    )
  }

  return result
}

/**
 * Merge multiple contract state overrides
 */
export function mergeStateOverrides(
  ...overrides: (Record<string, any> | undefined)[]
): Record<string, any> {
  const merged: Record<string, any> = {}

  for (const override of overrides) {
    if (override) {
      Object.assign(merged, override)
    }
  }

  return merged
}

/**
 * Get state overrides for multiple contracts
 */
export function getContractsStateOverrides(
  contracts: StoredContract[],
): Record<string, any> {
  const overrides = contracts
    .map(createContractStateOverride)
    .filter((override) => override.requiresOverride && override.stateOverride)
    .map((override) => override.stateOverride!)

  return mergeStateOverrides(...overrides)
}

/**
 * Check if any contracts in the list require state overrides
 */
export function anyContractRequiresOverride(
  contracts: StoredContract[],
): boolean {
  return contracts.some(requiresStateOverride)
}

/**
 * Get warning message for contracts requiring state override
 */
export function getStateOverrideWarning(
  contracts: StoredContract[],
): string | null {
  const contractsNeedingOverride = contracts.filter(requiresStateOverride)

  if (contractsNeedingOverride.length === 0) {
    return null
  }

  if (contractsNeedingOverride.length === 1) {
    const contract = contractsNeedingOverride[0]
    return `Contract "${contract.metadata.title || contract.contractData.name}" has modified bytecode. State override will be used for simulation.`
  }

  return `${contractsNeedingOverride.length} contracts have modified bytecode. State overrides will be used for simulation.`
}

/**
 * Format state override info for display
 */
export function formatStateOverrideInfo(override: ContractStateOverride): {
  title: string
  description: string
  type: 'info' | 'warning' | 'success'
} {
  const addr = override.address
    ? `${override.address.slice(0, 6)}...${override.address.slice(-4)}`
    : 'unknown'

  if (!override.requiresOverride) {
    if (override.bytecodeComparison?.isIdentical) {
      return {
        title: 'No Override Needed',
        description: `Compiled bytecode is identical to deployed version (${override.bytecodeComparison.localSize} bytes)`,
        type: 'success',
      }
    }
    return {
      title: 'No Override Required',
      description: 'Contract does not need state override',
      type: 'info',
    }
  }

  if (override.bytecodeComparison) {
    const { localSize, deployedSize, fetchError } = override.bytecodeComparison

    if (fetchError) {
      return {
        title: 'Override Applied (Unable to Compare)',
        description: `Using state override at ${addr}. Could not fetch deployed bytecode for comparison.`,
        type: 'warning',
      }
    }

    return {
      title: 'Override Applied (Bytecode Differs)',
      description: `Modified bytecode will replace deployed version at ${addr} (Local: ${localSize}b, Deployed: ${deployedSize}b)`,
      type: 'warning',
    }
  }

  return {
    title: 'State Override Applied',
    description: `Modified contract bytecode will be used via state override at ${addr}`,
    type: 'warning',
  }
}
