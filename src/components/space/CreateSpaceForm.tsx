'use client';

import { useState, useTransition } from 'react';
import { createSpace } from '@/lib/actions/space';

// Derives a URL-safe slug from a plain-text name as the user types.
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

export default function CreateSpaceForm() {
  const [name,        setName]        = useState('');
  const [slug,        setSlug]        = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [error,       setError]       = useState<string | null>(null);
  const [fieldError,  setFieldError]  = useState<'name' | 'slug' | null>(null);

  const [isPending, startTransition] = useTransition();

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(toSlug(value));
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    startTransition(async () => {
      const result = await createSpace({ name, slug, description });
      // If createSpace succeeds it redirects; we only land here on failure.
      if (!result.success) {
        setError(result.error);
        setFieldError(result.field ?? null);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-2">
        <label className="block text-sm text-neutral-400" htmlFor="name">
          Space name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="Otis Studio Collectief"
          className={`w-full rounded-md border px-3 py-2 text-sm text-neutral-100
                      bg-neutral-900 placeholder-neutral-600 focus:outline-none
                      ${fieldError === 'name'
                        ? 'border-red-500'
                        : 'border-neutral-700 focus:border-neutral-500'}`}
        />
        {fieldError === 'name' && error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <label className="block text-sm text-neutral-400" htmlFor="slug">
          URL
        </label>
        <div className="flex items-center gap-0 rounded-md border border-neutral-700
                        bg-neutral-900 focus-within:border-neutral-500 overflow-hidden
                        ${fieldError === 'slug' ? 'border-red-500' : ''}">
          <span className="px-3 py-2 text-sm text-neutral-600 border-r border-neutral-700 shrink-0">
            /space/
          </span>
          <input
            id="slug"
            type="text"
            required
            value={slug}
            onChange={e => handleSlugChange(e.target.value)}
            placeholder="otis-studio"
            className="flex-1 bg-transparent px-3 py-2 text-sm text-neutral-100
                       placeholder-neutral-600 focus:outline-none"
          />
        </div>
        {fieldError === 'slug' && error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : (
          <p className="text-xs text-neutral-600">
            Lowercase letters, numbers, and hyphens only.
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="block text-sm text-neutral-400" htmlFor="description">
          Description <span className="text-neutral-600">(optional)</span>
        </label>
        <textarea
          id="description"
          rows={2}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="A short description your members will see."
          className="w-full rounded-md border border-neutral-700 bg-neutral-900
                     px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600
                     focus:border-neutral-500 focus:outline-none resize-none"
        />
      </div>

      {/* Generic error (not tied to a field) */}
      {error && !fieldError && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending || !name.trim() || !slug.trim()}
        className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-semibold
                   text-neutral-900 hover:bg-white disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Creating…' : 'Create Space'}
      </button>
    </form>
  );
}
