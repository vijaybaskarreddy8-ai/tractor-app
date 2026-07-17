'use client';

import { type ReactNode } from 'react';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  children?: ReactNode;
}

export default function Header({
  title,
  showBack = false,
  onBack,
  children,
}: HeaderProps) {
  return (
    <header className="header">
      {showBack && (
        <button
          type="button"
          className="btn-icon"
          onClick={onBack}
          aria-label="Go back"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      <h1 className="header-title" suppressHydrationWarning>{title}</h1>

      {children && <div className="header-actions">{children}</div>}
    </header>
  );
}
