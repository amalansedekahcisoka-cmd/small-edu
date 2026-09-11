'use client';

import React from 'react';

interface RetroBadgeProps {
  children: React.ReactNode;
  variant?: 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'purple' | 'teal';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const RetroBadge: React.FC<RetroBadgeProps> = ({
  children,
  variant = 'teal',
  size = 'md',
  icon,
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'teal':
        return 'bg-[#008080] text-white';
      case 'green':
        return 'bg-[#79f2c0] text-[#0d4a2b]';
      case 'red':
        return 'bg-[#ff7675] text-[#2d0000]';
      case 'blue':
        return 'bg-[#74b9ff] text-[#093563]';
      case 'purple':
        return 'bg-[#d6a2e8] text-[#3e1254]';
      case 'gray':
        return 'bg-[#dfdbd2] text-[#2b2b2b]';
      case 'yellow':
      default:
        return 'bg-[#fef3c7] text-[#92400e] border-[#f59e0b]';
    }
  };

  const getSizeStyles = () => {
    return size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs sm:text-sm font-bold';
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono uppercase tracking-wider neo-border-sm neo-shadow-sm select-none ${getVariantStyles()} ${getSizeStyles()} ${className}`}
    >
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
