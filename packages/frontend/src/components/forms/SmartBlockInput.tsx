'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui'

interface SmartBlockInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * Smart block number input that accepts both decimal and hex formats
 * Converts automatically to SDK-compatible format
 */
export function SmartBlockInput({
  value,
  onChange,
  placeholder = 'Block number (e.g., 18500000 or 0x11a9e80)',
  className,
  disabled,
}: SmartBlockInputProps) {
  const [inputValue, setInputValue] = useState(value)
  const [isValid, setIsValid] = useState(true)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const validateAndConvert = (input: string) => {
    if (!input.trim()) {
      setIsValid(true)
      onChange('')
      return
    }

    // Handle special block tags
    const blockTags = ['latest', 'earliest', 'safe', 'finalized', 'pending']
    if (blockTags.includes(input.toLowerCase())) {
      setIsValid(true)
      onChange(input.toLowerCase())
      return
    }

    try {
      let blockNumber: number

      if (input.startsWith('0x') || input.startsWith('0X')) {
        // Hex format
        blockNumber = Number.parseInt(input, 16)
      } else {
        // Decimal format
        blockNumber = Number.parseInt(input, 10)
      }

      if (Number.isNaN(blockNumber) || blockNumber < 0) {
        setIsValid(false)
        return
      }

      // Convert to hex format for SDK compatibility
      const hexValue = `0x${blockNumber.toString(16)}`
      setIsValid(true)
      onChange(hexValue)
    } catch {
      setIsValid(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    setInputValue(input)
    validateAndConvert(input)
  }

  const getDisplayHint = () => {
    if (!inputValue || !isValid) return null

    // Show conversion hint
    if (inputValue.startsWith('0x')) {
      try {
        const decimal = Number.parseInt(inputValue, 16)
        return `Decimal: ${decimal.toLocaleString()}`
      } catch {
        return null
      }
    } else if (!Number.isNaN(Number.parseInt(inputValue, 10))) {
      const decimal = Number.parseInt(inputValue, 10)
      return `Hex: 0x${decimal.toString(16)}`
    }

    return null
  }

  return (
    <div className={className}>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`${!isValid ? 'border-red-500 focus:border-red-500' : ''}`}
      />

      {/* Format hint */}
      {getDisplayHint() && (
        <div className="text-xs text-muted-foreground mt-1">
          {getDisplayHint()}
        </div>
      )}

      {/* Error message */}
      {!isValid && (
        <div className="text-xs text-red-500 mt-1">
          Invalid block number. Use decimal (18500000) or hex (0x11a9e80)
          format.
        </div>
      )}
    </div>
  )
}

/**
 * Smart value input for wei amounts that accepts multiple formats
 */
export function SmartValueInput({
  value,
  onChange,
  placeholder = 'Value in wei (e.g., 1000000000000000000 or 0xde0b6b3a7640000)',
  className,
  disabled,
}: SmartBlockInputProps) {
  const [inputValue, setInputValue] = useState(value)
  const [isValid, setIsValid] = useState(true)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const validateAndConvert = (input: string) => {
    if (!input.trim()) {
      setIsValid(true)
      onChange('0x0')
      return
    }

    try {
      let bigIntValue: bigint

      if (input.startsWith('0x') || input.startsWith('0X')) {
        // Hex format
        bigIntValue = BigInt(input)
      } else {
        // Decimal format
        bigIntValue = BigInt(input)
      }

      if (bigIntValue < 0n) {
        setIsValid(false)
        return
      }

      // Convert to hex format for SDK compatibility
      const hexValue = `0x${bigIntValue.toString(16)}`
      setIsValid(true)
      onChange(hexValue)
    } catch {
      setIsValid(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    setInputValue(input)
    validateAndConvert(input)
  }

  const getDisplayHint = () => {
    if (!inputValue || !isValid) return null

    try {
      if (inputValue.startsWith('0x')) {
        const bigIntValue = BigInt(inputValue)
        return `Decimal: ${bigIntValue.toString()}`
      }
      const bigIntValue = BigInt(inputValue)
      return `Hex: 0x${bigIntValue.toString(16)}`
    } catch {
      return null
    }
  }

  return (
    <div className={className}>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`${!isValid ? 'border-red-500 focus:border-red-500' : ''}`}
      />

      {/* Format hint */}
      {getDisplayHint() && (
        <div className="text-xs text-muted-foreground mt-1">
          {getDisplayHint()}
        </div>
      )}

      {/* Error message */}
      {!isValid && (
        <div className="text-xs text-red-500 mt-1">
          Invalid value. Use decimal or hex format for wei amounts.
        </div>
      )}
    </div>
  )
}
