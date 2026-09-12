'use client';

import React from 'react';
import Link from 'next/link';

interface RetroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'teal' | 'yellow' | 'coral' | 'blue' | 'gray' | 'white' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  href?: string;
}

export const RetroButton: React.FC<RetroButtonProps> = ({
  children,
  variant = 'teal',
  size = 'md',
  icon,
  className = '',
  disabled,
  href,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'teal':
        return 'bg-[#008080] text-white hover:bg-[#006666]';
      case 'yellow':
        return 'bg-[#f59e0b] text-black hover:bg-[#d97706]';
      case 'coral':
        return 'bg-[#ff5e57] text-white hover:bg-[#ff473d]';
      case 'blue':
        return 'bg-[#2f86eb] text-white hover:bg-[#1a73e8]';
      case 'gray':
        return 'bg-[#dfdbd2] text-black hover:bg-[#ccc7bc]';
      case 'dark':
        return 'bg-[#141414] text-white hover:bg-[#2b2b2b]';
      case 'white':
      default:
        return 'bg-white text-black hover:bg-zinc-100';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-xs';
      case 'lg':
        return 'px-6 py-3 text-base sm:text-lg';
      case 'md':
      default:
        return 'px-4 py-2 text-sm sm:text-base';
    }
  };

  const baseClasses = `neo-btn inline-flex items-center justify-center gap-2 rounded-none select-none cursor-pointer ${getVariantStyles()} ${getSizeStyles()} ${className}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={baseClasses}>
        {icon && <span className="shrink-0 pointer-events-none">{icon}</span>}
        <span className="pointer-events-none">{children}</span>
      </Link>
    );
  }

  return (
    <button
      disabled={disabled}
      className={baseClasses}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
