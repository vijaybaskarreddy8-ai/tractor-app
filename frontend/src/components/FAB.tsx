'use client';

import { type ReactNode } from 'react';

interface FABProps {
  onClick: () => void;
  label: string;
  icon?: ReactNode;
}

const defaultIcon = (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export default function FAB({ onClick, label, icon }: FABProps) {
  return (
    <button
      type="button"
      className="fab"
      onClick={onClick}
      aria-label={label}
    >
      {icon ?? defaultIcon}
    </button>
  );
}
