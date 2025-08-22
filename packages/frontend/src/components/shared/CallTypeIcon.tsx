'use client';

import { 
  PhoneIcon,        // CALL
  SearchIcon,       // STATICCALL  
  ArrowRightLeftIcon, // DELEGATECALL
  HammerIcon,       // CREATE
  PlusIcon,         // CREATE2
  AlertTriangleIcon // UNKNOWN/ERROR
} from 'lucide-react';

interface CallTypeIconProps {
  callType: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Icon component for different EVM call types
 */
export function CallTypeIcon({ callType, className = '', size = 'md' }: CallTypeIconProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4', 
    lg: 'h-5 w-5'
  };

  const getIconAndColor = () => {
    const normalizedType = callType.toUpperCase();
    
    switch (normalizedType) {
      case 'CALL':
        return {
          icon: PhoneIcon,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          label: 'CALL'
        };
      case 'STATICCALL':
        return {
          icon: SearchIcon,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          label: 'STATICCALL'
        };
      case 'DELEGATECALL':
        return {
          icon: ArrowRightLeftIcon,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          label: 'DELEGATECALL'
        };
      case 'CREATE':
        return {
          icon: HammerIcon,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          label: 'CREATE'
        };
      case 'CREATE2':
        return {
          icon: PlusIcon,
          color: 'text-purple-700',
          bgColor: 'bg-purple-100',
          label: 'CREATE2'
        };
      default:
        return {
          icon: AlertTriangleIcon,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          label: normalizedType
        };
    }
  };

  const { icon: Icon, color, bgColor, label } = getIconAndColor();

  return (
    <div 
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${bgColor} ${className}`}
      title={`${label} operation`}
    >
      <Icon className={`${sizeClasses[size]} ${color}`} />
      <span className={`text-xs font-medium ${color}`}>
        {label}
      </span>
    </div>
  );
}

/**
 * Simplified icon-only version for compact display
 */
export function CallTypeIconOnly({ callType, className = '', size = 'md' }: CallTypeIconProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const getIconAndColor = () => {
    const normalizedType = callType.toUpperCase();
    
    switch (normalizedType) {
      case 'CALL':
        return { icon: PhoneIcon, color: 'text-blue-600' };
      case 'STATICCALL':
        return { icon: SearchIcon, color: 'text-green-600' };
      case 'DELEGATECALL':
        return { icon: ArrowRightLeftIcon, color: 'text-orange-600' };
      case 'CREATE':
        return { icon: HammerIcon, color: 'text-purple-600' };
      case 'CREATE2':
        return { icon: PlusIcon, color: 'text-purple-700' };
      default:
        return { icon: AlertTriangleIcon, color: 'text-gray-600' };
    }
  };

  const { icon: Icon, color } = getIconAndColor();

  return (
    <span title={`${callType.toUpperCase()} operation`}>
      <Icon className={`${sizeClasses[size]} ${color} ${className}`} />
    </span>
  );
}
