import React from 'react';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export default function Card({ padding = true, className = '', children, ...props }: Props) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-2xl ${padding ? 'p-5' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
