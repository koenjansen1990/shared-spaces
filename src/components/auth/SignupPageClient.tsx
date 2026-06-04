'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AuthForm from '@/components/auth/AuthForm';

// ── Placeholder images (replace with your own) ─────────────────────────────────
const TRAIL_IMAGES = [
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=220&h=280&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=220&h=280&fit=crop&q=80',
  'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=220&h=280&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=220&h=280&fit=crop&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=220&h=280&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=220&h=280&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600508774634-4e11d34730e2?w=220&h=280&fit=crop&q=80',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=220&h=280&fit=crop&q=80',
];

const CYCLING_WORDS = ['a workspace', 'a studio', 'a holiday home', 'a creative space', 'a co-working spot', 'a shared place'];

// ── Types ──────────────────────────────────────────────────────────────────────

type TrailImage = {
  id:      number;
  src:     string;
  x:       number;
  y:       number;
  opacity: number;
};

// ── Image trail ────────────────────────────────────────────────────────────────

function useImageTrail() {
  const [images, setImages]   = useState<TrailImage[]>([]);
  const counter               = useRef(0);
  const lastSpawn             = useRef(0);
  const imageIndex            = useRef(0);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const now = Date.now();
    if (now - lastSpawn.current < 100) return;
    lastSpawn.current = now;

    const id  = counter.current++;
    const src = TRAIL_IMAGES[imageIndex.current % TRAIL_IMAGES.length];
    imageIndex.current++;

    const img: TrailImage = { id, src, x: e.clientX - 55, y: e.clientY - 70, opacity: 1 };
    setImages(prev => [...prev, img]);

    // Fade out after 1500ms
    setTimeout(() => {
      setImages(prev => prev.map(i => i.id === id ? { ...i, opacity: 0 } : i));
    }, 1500);

    // Remove from DOM after fade
    setTimeout(() => {
      setImages(prev => prev.filter(i => i.id !== id));
    }, 1800);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [onMouseMove]);

  return images;
}

// ── Word cycle ─────────────────────────────────────────────────────────────────

function WordCycle() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % CYCLING_WORDS.length);
        setVisible(true);
      }, 300);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center gap-2 mb-8 select-none pointer-events-none">
      <span className="text-gray-400 text-sm font-medium">Share</span>
      <div className="relative overflow-hidden" style={{ width: '140px' }}>
        <span
          className="block text-sm font-medium text-gray-900 transition-all duration-300"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-8px)' }}
        >
          {CYCLING_WORDS[index]}
        </span>
      </div>
    </div>
  );
}

// ── Morph button ───────────────────────────────────────────────────────────────

function MorphButton() {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 transition-all duration-500 pointer-events-none"
        style={{
          backgroundColor: expanded ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0)',
          zIndex: 40,
          pointerEvents: expanded ? 'auto' : 'none',
        }}
        onClick={() => setExpanded(false)}
      />

      {/* Morph element */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border border-gray-200 overflow-hidden cursor-pointer"
        style={{
          zIndex: 50,
          width:        expanded ? '340px' : '120px',
          height:       expanded ? '420px' : '40px',
          borderRadius: expanded ? '24px' : '12px',
          transition:   'all 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onClick={() => !expanded && setExpanded(true)}
      >
        {/* Collapsed label */}
        <div
          className="absolute inset-0 flex items-center justify-center text-sm font-medium text-gray-700"
          style={{
            opacity:       expanded ? 0 : 1,
            transition:    'opacity 0.15s',
            pointerEvents: expanded ? 'none' : 'auto',
          }}
        >
          What is this?
        </div>

        {/* Expanded content */}
        <div
          className="absolute inset-0 p-6 flex flex-col"
          style={{
            opacity:       expanded ? 1 : 0,
            transition:    'opacity 0.2s',
            transitionDelay: expanded ? '0.35s' : '0s',
            pointerEvents: expanded ? 'auto' : 'none',
          }}
        >
          <button
            onClick={e => { e.stopPropagation(); setExpanded(false); }}
            className="self-end text-gray-400 hover:text-gray-700 transition-colors mb-4 text-xs"
          >
            Close ✕
          </button>

          <h3 className="text-base font-bold text-gray-900 leading-snug mb-3">
            Shared Spaces
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-5">
            A simple tool to manage access to a shared space — fairly, without the group chat chaos.
          </p>

          <div className="space-y-3">
            {[
              { icon: '⏱', label: 'Hours per member', sub: 'Set a fair weekly allowance' },
              { icon: '📅', label: 'Booking calendar', sub: 'Morning, afternoon or full day' },
              { icon: '🔗', label: 'Invite with a link', sub: 'No admin overhead' },
              { icon: '🏠', label: 'Works for any space', sub: 'Studio, office or holiday home' },
            ].map(f => (
              <div key={f.label} className="flex items-start gap-3">
                <span className="text-base mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-800">{f.label}</p>
                  <p className="text-xs text-gray-400">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function SignupPageClient({ mode }: { mode: 'login' | 'signup' }) {
  const trailImages = useImageTrail();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden"
      style={{ backgroundColor: '#F7F7F7' }}
    >
      {/* Image trail */}
      {trailImages.map(img => (
        <img
          key={img.id}
          src={img.src}
          alt=""
          className="fixed rounded-xl object-cover pointer-events-none"
          style={{
            left:       img.x,
            top:        img.y,
            width:      '110px',
            height:     '140px',
            opacity:    img.opacity,
            transition: 'opacity 0.3s ease',
            zIndex:     10,
          }}
        />
      ))}

      {/* Word cycle */}
      <WordCycle />

      {/* Form card */}
      <div className="relative z-20 w-full max-w-sm bg-white rounded-3xl border border-gray-200 px-8 py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'signup' ? 'Create account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-gray-400">
            {mode === 'signup' ? 'Join Shared Spaces' : 'Sign in to your space'}
          </p>
        </div>

        <AuthForm mode={mode} />

        <p className="text-sm text-gray-400 text-center">
          {mode === 'signup' ? (
            <>Already have an account?{' '}
              <a href="/login" className="text-gray-700 underline underline-offset-2 hover:text-gray-900 transition-colors">Sign in</a>
            </>
          ) : (
            <>Don't have an account?{' '}
              <a href="/signup" className="text-gray-700 underline underline-offset-2 hover:text-gray-900 transition-colors">Sign up</a>
            </>
          )}
        </p>
      </div>

      {/* Morph button */}
      <MorphButton />
    </div>
  );
}
