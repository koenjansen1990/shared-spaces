import React from 'react';

const base = 'w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  rows?: number;
}

export function Input({ className = '', ...props }: InputProps) {
  return <input className={`${base} ${className}`} {...props} />;
}

export function Textarea({ className = '', rows = 3, ...props }: TextareaProps) {
  return <textarea rows={rows} className={`${base} resize-none ${className}`} {...props} />;
}
