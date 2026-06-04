import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?:    Size;
  full?:    boolean;
}

const base = 'inline-flex items-center justify-center font-semibold transition-colors disabled:opacity-40 focus:outline-none';

const variants: Record<Variant, string> = {
  primary:   'bg-gray-900 text-white hover:bg-gray-800 rounded-2xl',
  secondary: 'border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-2xl',
  ghost:     'text-gray-400 hover:text-gray-700',
  danger:    'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-2xl',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-5 py-4 text-sm w-full',
};

export default function Button({
  variant = 'primary',
  size    = 'lg',
  full,
  className = '',
  children,
  ...props
}: Props) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${full ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
