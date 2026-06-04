import React from 'react';

interface Props extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export default function Label({ className = '', children, ...props }: Props) {
  return (
    <label className={`block text-sm font-medium text-gray-600 ${className}`} {...props}>
      {children}
    </label>
  );
}
