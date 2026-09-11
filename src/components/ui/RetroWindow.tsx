'use client';

import React from 'react';

interface RetroWindowProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerColor?: 'navy' | 'mustard' | 'coral' | 'teal' | 'gray';
  onClose?: () => void;
  actions?: React.ReactNode;
}

export const RetroWindow: React.FC<RetroWindowProps> = ({
  title,
  icon,
  children,
  className = '',
  headerColor = 'navy',
  onClose,
  actions,
}) => {
  const getHeaderBg = () => {
    switch (headerColor) {
      case 'mustard':
        return 'bg-[#ffde59] text-black border-b-[2.5px] border-black';
      case 'coral':
        return 'bg-[#ff5e57] text-white border-b-[2.5px] border-black';
      case 'teal':
        return 'bg-[#008080] text-white border-b-[2.5px] border-black';
      case 'gray':
        return 'bg-[#dfdbd2] text-black border-b-[2.5px] border-black';
      case 'navy':
      default:
        return 'retro-titlebar';
    }
  };

  return (
    <div
      className={`bg-white neo-border neo-shadow flex flex-col overflow-hidden ${className}`}
    >
      {/* Title Bar */}
      <div className={`${getHeaderBg()} flex items-center justify-between px-3 py-1.5 select-none`}>
        <div className="flex items-center gap-2 font-mono font-bold text-sm tracking-wide truncate">
          {icon && <span className="flex items-center">{icon}</span>}
          <span className="truncate">{title}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {actions}
          {onClose && (
            <button
              onClick={onClose}
              className="ml-1 px-2 py-0.5 font-mono font-bold text-xs neo-border-sm hover:bg-red-500 hover:text-white transition-colors"
              title="Tutup"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Window Body */}
      <div className="p-4 sm:p-6 flex-1 overflow-auto">{children}</div>
    </div>
  );
};
