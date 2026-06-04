'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createResource } from '@/lib/actions/resource';
import type { PlanType } from '@/types';

interface Props {
  spaceId:       string;
  planType:      PlanType;
  resourceCount: number;
}

export default function AddResourceForm({ spaceId, planType, resourceCount }: Props) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [name, setName]       = useState('');
  const [desc, setDesc]       = useState('');
  const [error, setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const atFreeLimit = planType === 'free' && resourceCount >= 1;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createResource({ space_id: spaceId, name, description: desc });
      if (!result.success) {
        if (result.error === 'SUBSCRIPTION_REQUIRED') {
          setError('Upgrade to Premium to add more than 1 resource.');
        } else {
          setError(result.error ?? 'Something went wrong.');
        }
        return;
      }
      setName('');
      setDesc('');
      setOpen(false);
      router.refresh();
    });
  }

  if (atFreeLimit) {
    return (
      <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-400">
        Free plan is limited to 1 resource.{' '}
        <span className="underline underline-offset-2 cursor-pointer">Upgrade to add more.</span>
      </div>
    );
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm
                     text-neutral-300 hover:border-neutral-500 hover:text-neutral-100 transition-colors"
        >
          + Add resource
        </button>
      ) : (
        <form onSubmit={handleSubmit}
          className="rounded-lg border border-neutral-700 bg-neutral-900 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-200">New resource</h2>

          <div className="space-y-1">
            <label className="block text-xs text-neutral-400" htmlFor="res-name">Name</label>
            <input
              id="res-name"
              required
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Main Studio Room"
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5
                         text-sm text-neutral-100 placeholder-neutral-600
                         focus:border-neutral-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-neutral-400" htmlFor="res-desc">
              Description <span className="text-neutral-600">(optional)</span>
            </label>
            <input
              id="res-desc"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="e.g. 80m² live room with grand piano"
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5
                         text-sm text-neutral-100 placeholder-neutral-600
                         focus:border-neutral-500 focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="rounded bg-neutral-100 px-4 py-1.5 text-xs font-semibold
                         text-neutral-900 hover:bg-white disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              className="rounded px-4 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
