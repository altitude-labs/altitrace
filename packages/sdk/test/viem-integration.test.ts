/**
 * @fileoverview Test suite for Viem integration utilities
 *
 * Tests for converting between Viem types and Altitrace SDK types,
 * ensuring proper interoperability with the Viem library.
 */

import { describe, expect, it } from 'bun:test'
import { ValidationError } from '@sdk/core/errors'
import {
  addressToViemAddress,
  BlockUtils,
  bigintToHexNumber,
  GasUtils,
  hexNumberToBigint,
  hexNumberToNumber,
  numberToHexNumber,
  transactionCallToViem,
  viemAddressToAddress,
  viemBatchToTransactionCalls,
  viemToTransactionCall,
  WeiUtils,
} from '@sdk/utils/viem'

describe('Viem Integration', () => {
  describe('viemToTransactionCall', () => {
    it('should convert complete Viem transaction to call', () => {
      const viemTx = {
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c' as const,
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
        data: '0xa9059cbb' as const,
        value: 1000000000000000000n, // 1 ETH
        gas: 21000n,
      }

      const call = viemToTransactionCall(viemTx)

      expect(call.from).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c')
      expect(call.to).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
      expect(call.data).toBe('0xa9059cbb')
      expect(call.value).toBe('0xde0b6b3a7640000') // 1 ETH in hex
      expect(call.gas).toBe('0x5208') // 21000 in hex
    })

    it('should convert partial Viem transaction to call', () => {
      const viemTx = {
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
        data: '0xa9059cbb' as const,
      }

      const call = viemToTransactionCall(viemTx)

      expect(call.from).toBeUndefined()
      expect(call.to).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
      expect(call.data).toBe('0xa9059cbb')
      expect(call.value).toBeUndefined()
      expect(call.gas).toBeUndefined()
    })

    it('should handle hex string values in Viem transaction', () => {
      const viemTx = {
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
        value: BigInt('0x1000000000000'),
        gas: BigInt('0x7a120'),
      }

      const call = viemToTransactionCall(viemTx)

      expect(call.value).toBe('0x1000000000000')
      expect(call.gas).toBe('0x7a120')
    })
  })

  describe('transactionCallToViem', () => {
    it('should convert complete call to Viem transaction', () => {
      const call = {
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        data: '0xa9059cbb',
        value: '0xde0b6b3a7640000', // 1 ETH in hex
        gas: '0x5208', // 21000 in hex
      }

      const viemTx = transactionCallToViem(call)

      expect(viemTx.from).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c')
      expect(viemTx.to).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
      expect(viemTx.data).toBe('0xa9059cbb')
      expect(viemTx.value).toBe(1000000000000000000n) // 1 ETH
      expect(viemTx.gas).toBe(21000n)
    })

    it('should convert partial call to Viem transaction', () => {
      const call = {
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        data: '0xa9059cbb',
      }

      const viemTx = transactionCallToViem(call)

      expect(viemTx.from).toBeUndefined()
      expect(viemTx.to).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
      expect(viemTx.data).toBe('0xa9059cbb')
      expect(viemTx.value).toBeUndefined()
      expect(viemTx.gas).toBeUndefined()
    })
  })

  describe('viemBatchToTransactionCalls', () => {
    it('should convert array of Viem transactions to calls', () => {
      const viemTxs = [
        {
          to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
          data: '0xa9059cbb' as const,
          value: 1000n,
        },
        {
          to: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as const,
          data: '0xa9059cbb' as const,
          gas: 50000n,
        },
      ]

      const calls = viemBatchToTransactionCalls(viemTxs)

      expect(calls).toHaveLength(2)
      expect(calls[0]?.to).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
      expect(calls[0]?.value).toBe('0x3e8') // 1000 in hex
      expect(calls[1]?.to).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7')
      expect(calls[1]?.gas).toBe('0xc350') // 50000 in hex
    })
  })

  describe('address conversion', () => {
    const testAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c'

    it('should convert Viem address to Altitrace address', () => {
      const result = viemAddressToAddress(testAddress as any)
      expect(result).toBe(testAddress)
    })

    it('should convert Altitrace address to Viem address', () => {
      const result = addressToViemAddress(testAddress as any)
      expect(result).toBe(testAddress)
    })
  })

  describe('number conversions', () => {
    describe('bigintToHexNumber', () => {
      it('should convert bigint to hex number', () => {
        expect(bigintToHexNumber(0n)).toBe('0x0')
        expect(bigintToHexNumber(255n)).toBe('0xff')
        expect(bigintToHexNumber(21000n)).toBe('0x5208')
        expect(bigintToHexNumber(1000000000000000000n)).toBe(
          '0xde0b6b3a7640000',
        )
      })
    })

    describe('hexNumberToBigint', () => {
      it('should convert hex number to bigint', () => {
        expect(hexNumberToBigint('0x0' as any)).toBe(0n)
        expect(hexNumberToBigint('0xff' as any)).toBe(255n)
        expect(hexNumberToBigint('0x5208' as any)).toBe(21000n)
        expect(hexNumberToBigint('0xde0b6b3a7640000' as any)).toBe(
          1000000000000000000n,
        )
      })
    })

    describe('numberToHexNumber', () => {
      it('should convert number to hex number', () => {
        expect(numberToHexNumber(0)).toBe('0x0')
        expect(numberToHexNumber(255)).toBe('0xff')
        expect(numberToHexNumber(21000)).toBe('0x5208')
      })

      it('should reject negative numbers', () => {
        expect(() => numberToHexNumber(-1)).toThrow(ValidationError)
      })

      it('should reject non-integers', () => {
        expect(() => numberToHexNumber(1.5)).toThrow(ValidationError)
      })
    })

    describe('hexNumberToNumber', () => {
      it('should convert hex number to number', () => {
        expect(hexNumberToNumber('0x0' as any)).toBe(0)
        expect(hexNumberToNumber('0xff' as any)).toBe(255)
        expect(hexNumberToNumber('0x5208' as any)).toBe(21000)
      })

      it('should throw for numbers too large for safe integer', () => {
        expect(() => hexNumberToNumber('0x20000000000000' as any)).toThrow(
          ValidationError,
        )
      })
    })
  })

  describe('GasUtils', () => {
    describe('toHexNumber', () => {
      it('should convert number to hex', () => {
        expect(GasUtils.toHexNumber(21000)).toBe('0x5208')
      })

      it('should convert bigint to hex', () => {
        expect(GasUtils.toHexNumber(21000n)).toBe('0x5208')
      })

      it('should pass through valid hex string', () => {
        expect(GasUtils.toHexNumber('0x5208')).toBe('0x5208')
      })

      it('should reject invalid hex string', () => {
        expect(() => GasUtils.toHexNumber('not-hex')).toThrow(ValidationError)
      })

      it('should reject invalid types', () => {
        expect(() => GasUtils.toHexNumber(null as any)).toThrow(ValidationError)
      })
    })

    describe('add', () => {
      it('should add two gas values', () => {
        const result = GasUtils.add('0x5208' as any, '0x5208' as any)
        expect(result).toBe('0xa410') // 21000 + 21000 = 42000
      })
    })

    describe('subtract', () => {
      it('should subtract two gas values', () => {
        const result = GasUtils.subtract('0xa410' as any, '0x5208' as any)
        expect(result).toBe('0x5208') // 42000 - 21000 = 21000
      })

      it('should throw for negative results', () => {
        expect(() =>
          GasUtils.subtract('0x5208' as any, '0xa410' as any),
        ).toThrow(ValidationError)
      })
    })

    describe('calculatePercentage', () => {
      it('should calculate gas percentage', () => {
        const percentage = GasUtils.calculatePercentage(
          '0x5208' as any,
          '0xa410' as any,
        )
        expect(percentage).toBe(50) // 21000 / 42000 = 50%
      })

      it('should handle zero gas limit', () => {
        const percentage = GasUtils.calculatePercentage(
          '0x5208' as any,
          '0x0' as any,
        )
        expect(percentage).toBe(0)
      })
    })
  })

  describe('WeiUtils', () => {
    describe('toHexNumber', () => {
      it('should convert various types to hex', () => {
        expect(WeiUtils.toHexNumber(1000)).toBe('0x3e8')
        expect(WeiUtils.toHexNumber(1000n)).toBe('0x3e8')
        expect(WeiUtils.toHexNumber('0x3e8')).toBe('0x3e8')
      })
    })

    describe('fromEth', () => {
      it('should convert ETH to Wei', () => {
        const wei = WeiUtils.fromEth('1')
        expect(wei).toBe('0xde0b6b3a7640000') // 1 ETH in wei
      })

      it('should convert number ETH to Wei', () => {
        const wei = WeiUtils.fromEth(1)
        expect(wei).toBe('0xde0b6b3a7640000') // 1 ETH in wei
      })
    })

    describe('toEth', () => {
      it('should convert Wei to ETH', () => {
        const eth = WeiUtils.toEth('0xde0b6b3a7640000' as any)
        expect(eth).toBe('1') // 1 ETH
      })
    })

    describe('format', () => {
      it('should format Wei with appropriate unit', () => {
        // 1 ETH
        expect(WeiUtils.format('0xde0b6b3a7640000' as any)).toBe('1 ETH')

        // 1 gwei
        expect(WeiUtils.format('0x3b9aca00' as any)).toBe('1 gwei')

        // Small amount in wei
        expect(WeiUtils.format('0x3e8' as any)).toBe('1000 wei')
      })

      it('should handle fractional ETH', () => {
        const result = WeiUtils.format('0x6f05b59d3b20000' as any) // 0.5 ETH
        expect(result).toContain('ETH')
      })
    })
  })

  describe('BlockUtils', () => {
    describe('toHexNumber', () => {
      it('should convert various types to hex', () => {
        expect(BlockUtils.toHexNumber(1000000)).toBe('0xf4240')
        expect(BlockUtils.toHexNumber(1000000n)).toBe('0xf4240')
        expect(BlockUtils.toHexNumber('0xf4240')).toBe('0xf4240')
      })
    })

    describe('toNumber', () => {
      it('should convert hex block number to number', () => {
        expect(BlockUtils.toNumber('0xf4240' as any)).toBe(1000000)
      })
    })

    describe('isValid', () => {
      it('should return true for valid block numbers', () => {
        expect(BlockUtils.isValid('0x0' as any)).toBe(true)
        expect(BlockUtils.isValid('0xf4240' as any)).toBe(true)
      })

      it('should return false for invalid block numbers', () => {
        expect(BlockUtils.isValid('invalid' as any)).toBe(false)
      })
    })
  })

  describe('round-trip conversions', () => {
    it('should maintain data integrity in Viem -> Altitrace -> Viem conversion', () => {
      const originalViemTx = {
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c' as const,
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
        data: '0xa9059cbb000000000000000000000000' as const,
        value: 1000000000000000000n, // 1 ETH
        gas: 50000n,
      }

      const call = viemToTransactionCall(originalViemTx)
      const convertedViemTx = transactionCallToViem(call)

      expect(convertedViemTx.from).toBe(originalViemTx.from)
      expect(convertedViemTx.to).toBe(originalViemTx.to)
      expect(convertedViemTx.data).toBe(originalViemTx.data)
      expect(convertedViemTx.value).toBe(originalViemTx.value)
      expect(convertedViemTx.gas).toBe(originalViemTx.gas)
    })

    it('should maintain data integrity in number conversions', () => {
      const testNumbers = [0, 1, 255, 1000, 21000, 1000000]

      testNumbers.forEach((num) => {
        const hex = numberToHexNumber(num)
        const converted = hexNumberToNumber(hex)
        expect(converted).toBe(num)
      })
    })

    it('should maintain data integrity in bigint conversions', () => {
      const testBigints = [0n, 1n, 255n, 1000n, 21000n, 1000000000000000000n]

      testBigints.forEach((bigint) => {
        const hex = bigintToHexNumber(bigint)
        const converted = hexNumberToBigint(hex)
        expect(converted).toBe(bigint)
      })
    })
  })
})
