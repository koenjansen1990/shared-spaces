'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  name:            string;
  welcomeMessage:  string | null;
  contactEmail:    string | null;
  contactPhone:    string | null;
  address:         string | null;
}

export default function SpaceDropdown({ name, welcomeMessage, contactEmail, contactPhone, address }: Props) {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);
  const hasDetails      = welcomeMessage || contactEmail || contactPhone || address;

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => hasDetails && setOpen(o => !o)}
        className={`flex items-center gap-1.5 ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className="font-semibold text-gray-900 text-sm">{name}</span>
        {hasDetails && (
          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 12 12" fill="none">
            <path d="M2 4.5L6 8l4-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-8 w-72 bg-white border border-gray-200
                        rounded-2xl shadow-lg overflow-hidden z-50
                        animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-5 space-y-4">

            {welcomeMessage && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Welcome</p>
                <p className="text-sm text-gray-700 leading-relaxed">{welcomeMessage}</p>
              </div>
            )}

            {(contactEmail || contactPhone || address) && (
              <div className={`space-y-2 ${welcomeMessage ? 'pt-3 border-t border-gray-100' : ''}`}>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Contact</p>
                {contactEmail && (
                  <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    <span className="text-gray-400">✉</span>{contactEmail}
                  </a>
                )}
                {contactPhone && (
                  <a href={`tel:${contactPhone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    <span className="text-gray-400">✆</span>{contactPhone}
                  </a>
                )}
                {address && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-gray-400 mt-0.5">⌖</span>
                    <span className="leading-snug">{address}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
