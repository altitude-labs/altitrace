import { decodeAbiParameters, parseAbiItem, slice, type Hex, type Address } from 'viem';
import { logger } from './logger';
import type { LogEntry } from '@/types/api';

/**
 * Decoded event information for human-readable display
 */
export interface DecodedEvent {
  /** Event name (e.g., 'Transfer', 'Approval') */
  name: string;
  /** Event signature hash */
  signature: string;
  /** Contract standard (ERC20, ERC721, etc.) */
  standard?: string;
  /** Human-readable description */
  description: string;
  /** Decoded parameters with names and values */
  params: Array<{
    name: string;
    type: string;
    value: string;
    indexed: boolean;
  }>;
  /** Formatted summary for quick understanding */
  summary: string;
}

/**
 * Known event signatures for popular token standards
 */
const EVENT_SIGNATURES = {
  // ERC20 Events
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': {
    name: 'Transfer',
    standard: 'ERC20',
    abi: 'event Transfer(address indexed from, address indexed to, uint256 value)',
    description: 'Token transfer between addresses'
  },
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': {
    name: 'Approval',
    standard: 'ERC20',
    abi: 'event Approval(address indexed owner, address indexed spender, uint256 value)',
    description: 'Approval granted for token spending'
  },

  // Note: ERC721 Transfer and Approval have same signatures as ERC20, handled by context
  '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31': {
    name: 'ApprovalForAll',
    standard: 'ERC721',
    abi: 'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
    description: 'Approval for all NFTs granted or revoked'
  },

  // Common DeFi Events
  '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67': {
    name: 'Swap',
    standard: 'Uniswap V2',
    abi: 'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
    description: 'Token swap executed'
  },
  '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1': {
    name: 'Sync',
    standard: 'Uniswap V2',
    abi: 'event Sync(uint112 reserve0, uint112 reserve1)',
    description: 'Pool reserves synchronized'
  },
  '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f': {
    name: 'Mint',
    standard: 'Uniswap V2',
    abi: 'event Mint(address indexed sender, uint256 amount0, uint256 amount1)',
    description: 'Liquidity tokens minted'
  },
  '0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496': {
    name: 'Burn',
    standard: 'Uniswap V2',
    abi: 'event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)',
    description: 'Liquidity tokens burned'
  },

  // Wrapped ETH Events
  '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c': {
    name: 'Deposit',
    standard: 'WETH',
    abi: 'event Deposit(address indexed dst, uint256 wad)',
    description: 'ETH deposited and wrapped'
  },
  '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65': {
    name: 'Withdrawal',
    standard: 'WETH',
    abi: 'event Withdrawal(address indexed src, uint256 wad)',
    description: 'WETH unwrapped to ETH'
  }
} as const;

/**
 * Special addresses for better context
 */
const SPECIAL_ADDRESSES = {
  '0x0000000000000000000000000000000000000000': 'Zero Address (Mint/Burn)',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': 'Native ETH',
  '0x5555555555555555555555555555555555555555': 'WHYPE'
};

/**
 * Decode event logs into human-readable format
 */
export function decodeEventLogs(logs: LogEntry[]): Array<LogEntry & { decoded?: DecodedEvent }> {
  return logs.map(log => {
    try {
      const decoded = decodeEvent(log);
      return decoded ? { ...log, decoded } : log;
    } catch (error) {
      logger.debug({ error, log }, 'Failed to decode event log');
      return log;
    }
  });
}

/**
 * Decode a single event log
 */
export function decodeEvent(log: LogEntry): DecodedEvent | null {
  if (!log.topics || log.topics.length === 0) {
    return null;
  }

  const eventSignature = log.topics[0];
  const eventInfo = EVENT_SIGNATURES[eventSignature as keyof typeof EVENT_SIGNATURES];
  
  if (!eventInfo) {
    return null;
  }

  try {
    // Parse the ABI to get parameter information
    const parsedAbi = parseAbiItem(eventInfo.abi);
    const eventAbi = parsedAbi.type === 'event' ? parsedAbi : null;
    
    if (!eventAbi) {
      return null;
    }

    // Decode indexed parameters (from topics) and non-indexed parameters (from data)
    const indexedParams = eventAbi.inputs.filter((input: any) => input.indexed);
    const nonIndexedParams = eventAbi.inputs.filter((input: any) => !input.indexed);
    
    const decodedParams: DecodedEvent['params'] = [];
    
    // Decode indexed parameters from topics (skip first topic which is event signature)
    indexedParams.forEach((param: any, index) => {
      const topicIndex = index + 1;
      if (topicIndex < log.topics.length) {
        const rawValue = log.topics[topicIndex];
        const formattedValue = formatParameterValue(param.type, rawValue);
        
        decodedParams.push({
          name: param.name || `param${index}`,
          type: param.type,
          value: formattedValue,
          indexed: true
        });
      }
    });

    // Decode non-indexed parameters from data
    if (nonIndexedParams.length > 0 && log.data && log.data !== '0x') {
      const decodedData = decodeAbiParameters(
        nonIndexedParams.map((p: any) => ({ name: p.name, type: p.type })),
        log.data as `0x${string}`
      );
      
      nonIndexedParams.forEach((param: any, index) => {
        const rawValue = decodedData[index];
        const formattedValue = formatParameterValue(param.type, rawValue);
        
        decodedParams.push({
          name: param.name || `param${index + indexedParams.length}`,
          type: param.type,
          value: formattedValue,
          indexed: false
        });
      });
    }

    // Generate human-readable summary
    const summary = generateEventSummary(eventInfo, decodedParams, log.address as `0x${string}`);

    return {
      name: eventInfo.name,
      signature: eventSignature,
      standard: eventInfo.standard,
      description: eventInfo.description,
      params: decodedParams,
      summary
    };
  } catch (error) {
    logger.debug({ error, eventSignature, eventInfo }, 'Failed to decode specific event');
    return null;
  }
}

/**
 * Format parameter values for human readability
 */
function formatParameterValue(type: string, value: any): string {
  try {
    if (type === 'address') {
      const addr = slice(value, -20) as `0x${string}`;
      return SPECIAL_ADDRESSES[addr as keyof typeof SPECIAL_ADDRESSES] || addr;
    }
    
    if (type.startsWith('uint') || type.startsWith('int')) {
      const numValue = BigInt(value.toString());
      
      return ` ${numValue} tokens`;
    }
    
    if (type === 'bool') {
      return value ? 'true' : 'false';
    }
    
    if (type.startsWith('bytes')) {
      return value.toString();
    }
    
    return value.toString();
  } catch (error) {
    return value.toString();
  }
}

/**
 * Generate human-readable summary for events
 */
function generateEventSummary(
  eventInfo: typeof EVENT_SIGNATURES[keyof typeof EVENT_SIGNATURES],
  params: DecodedEvent['params'],
  contractAddress: `0x${string}`
): string {
  const { name, standard } = eventInfo;
  
  switch (name) {
    case 'Transfer': {
      const from = params.find(p => p.name === 'from')?.value || 'unknown';
      const to = params.find(p => p.name === 'to')?.value || 'unknown';
      const valueParam = params.find(p => p.name === 'value' || p.name === 'tokenId');
      const value = valueParam?.value || 'unknown';
      
      // Determine if this is likely an NFT by value pattern
      const isNFT = !value.includes('tokens') && !value.includes('.');
      if (isNFT) {
        return `NFT #${value} transferred from ${from} to ${to}`;
      } else {
        return `${value} transferred from ${from} to ${to}`;
      }
    }
    
    case 'Approval': {
      const owner = params.find(p => p.name === 'owner')?.value || 'unknown';
      const spender = params.find(p => p.name === 'spender' || p.name === 'approved')?.value || 'unknown';
      const valueParam = params.find(p => p.name === 'value' || p.name === 'tokenId');
      const value = valueParam?.value || 'unknown';
      
      // Determine if this is likely an NFT by value pattern
      const isNFT = !value.includes('tokens') && !value.includes('.');
      if (isNFT) {
        return `NFT #${value} approval granted from ${owner} to ${spender}`;
      } else {
        return `${value} spending approval granted from ${owner} to ${spender}`;
      }
    }
    
    case 'Swap': {
      const sender = params.find(p => p.name === 'sender')?.value || 'unknown';
      const to = params.find(p => p.name === 'to')?.value || 'unknown';
      return `Token swap executed by ${sender} → ${to}`;
    }
    
    case 'Mint': {
      const sender = params.find(p => p.name === 'sender')?.value || 'unknown';
      return `Liquidity minted by ${sender}`;
    }
    
    case 'Burn': {
      const sender = params.find(p => p.name === 'sender')?.value || 'unknown';
      return `Liquidity burned by ${sender}`;
    }
    
    case 'Deposit': {
      const dst = params.find(p => p.name === 'dst')?.value || 'unknown';
      const wad = params.find(p => p.name === 'wad')?.value || 'unknown';
      return `${wad} ETH deposited by ${dst}`;
    }
    
    case 'Withdrawal': {
      const src = params.find(p => p.name === 'src')?.value || 'unknown';
      const wad = params.find(p => p.name === 'wad')?.value || 'unknown';
      return `${wad} WETH withdrawn by ${src}`;
    }
    
    default:
      return `${name} event emitted by ${contractAddress}`;
  }
}

/**
 * Get event decoder statistics for debugging
 */
export function getDecoderStats(logs: LogEntry[]): {
  total: number;
  decoded: number;
  unknown: number;
  byStandard: Record<string, number>;
} {
  const stats = {
    total: logs.length,
    decoded: 0,
    unknown: 0,
    byStandard: {} as Record<string, number>
  };
  
  logs.forEach(log => {
    if (!log.topics || log.topics.length === 0) {
      stats.unknown++;
      return;
    }
    
    const eventSignature = log.topics[0];
    const eventInfo = EVENT_SIGNATURES[eventSignature as keyof typeof EVENT_SIGNATURES];
    
    if (eventInfo) {
      stats.decoded++;
      const standard = eventInfo.standard || 'Unknown';
      stats.byStandard[standard] = (stats.byStandard[standard] || 0) + 1;
    } else {
      stats.unknown++;
    }
  });
  
  return stats;
}