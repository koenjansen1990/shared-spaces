'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { deleteSpace } from '@/lib/actions/space';
import type { SpaceMembership } from '@/app/dashboard/page';

const SPACE_TYPE_LABELS: Record<string, string> = {
  workplace:    'Workspace / Studio',
  holiday_home: 'Holiday Home',
};

const SPACE_TYPE_EMOJI: Record<string, string> = {
  workplace:    '🏢',
  holiday_home: '🏡',
};

// ── Delete confirmation modal ────────────────────────────

function DeleteModal({
  space,
  onConfirm,
  onClose,
}: {
  space:     { id: string; name: string };
  onConfirm: () => void;
  onClose:   () => void;
}) {
  const [typed,     setTyped]     = useState('');
  const [isPending, startDelete]  = useTransition();
  const [error,     setError]     = useState<string | null>(null);
  const confirmed = typed.trim() === space.name.trim();

  function handleDelete() {
    setError(null);
    startDelete(async () => {
      const r = await deleteSpace(space.id);
      if (!r.success) { setError(r.error ?? 'Something went wrong.'); return; }
      onConfirm();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full sm:max-w-sm bg-white border border-gray-200 shadow-xl
                   rounded-t-3xl sm:rounded-3xl p-6 space-y-5
                   animate-in fade-in slide-in-from-bottom-4 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1 mb-1" />

        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest">Danger zone</p>
          <h2 className="text-2xl font-bold text-gray-900 mt-0.5">Delete space</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            This will permanently delete <strong className="text-gray-900">{space.name}</strong> and all its bookings, members, and data. This cannot be undone.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-widest">
            Type <span className="text-gray-700 font-semibold">{space.name}</span> to confirm
          </label>
          <Input
            autoFocus
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder={space.name}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="space-y-2">
          <button
            onClick={handleDelete}
            disabled={!confirmed || isPending}
            className="w-full py-4 rounded-2xl bg-red-600 text-white font-semibold text-base
                       hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {isPending ? 'Deleting…' : 'Delete permanently'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Space card ───────────────────────────────────────────

function SpaceCard({
  membership,
  onDeleteRequest,
}: {
  membership:      SpaceMembership;
  onDeleteRequest: (space: { id: string; name: string }) => void;
}) {
  const { role, space } = membership;
  const isOwner         = role === 'owner';
  const isAdmin         = role === 'owner' || role === 'admin';
  const setupIncomplete = !space.onboarding_completed_at;
  const typeLabel       = space.space_type ? (SPACE_TYPE_LABELS[space.space_type] ?? space.space_type) : null;
  const typeEmoji       = space.space_type ? (SPACE_TYPE_EMOJI[space.space_type] ?? '🏢') : '🏢';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <Link href={`/space/${space.slug}/schedule`} className="flex flex-col flex-1">
        {/* Hero */}
        {space.hero_image_url ? (
          <div className="relative h-32 w-full">
            <Image src={space.hero_image_url} alt={space.name} fill className="object-cover" />
          </div>
        ) : (
          <div className="h-32 w-full bg-gray-100 flex items-center justify-center text-4xl">
            {typeEmoji}
          </div>
        )}

        <div className="p-4 flex flex-col gap-1 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-gray-900 leading-tight">{space.name}</span>
            {isAdmin ? (
              <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-900 text-white">
                Admin
              </span>
            ) : (
              <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                Member
              </span>
            )}
          </div>

          {typeLabel && <span className="text-xs text-gray-400">{typeLabel}</span>}

          {setupIncomplete && (
            <span className="mt-1 inline-flex self-start text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Setup incomplete
            </span>
          )}
        </div>
      </Link>

      {/* Card footer */}
      {(isAdmin && setupIncomplete) || isOwner ? (
        <div className="px-4 pb-4 flex items-center justify-between">
          {isAdmin && setupIncomplete ? (
            <Link href={`/space/${space.slug}/setup`} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
              Continue setup →
            </Link>
          ) : <span />}

          {isOwner && (
            <button
              onClick={e => { e.preventDefault(); onDeleteRequest({ id: space.id, name: space.name }); }}
              className="text-xs text-gray-300 hover:text-red-500 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────

interface Props {
  owned:  SpaceMembership[];
  member: SpaceMembership[];
}

export default function DashboardPage({ owned: initialOwned, member }: Props) {
  const [owned,       setOwned]       = useState(initialOwned);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const hasSpaces = owned.length > 0 || member.length > 0;

  function handleDeleted() {
    if (!deleteTarget) return;
    setOwned(prev => prev.filter(m => m.space.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Your spaces</h1>
          <Link href="/spaces/new">
            <Button variant="primary" size="md">+ New space</Button>
          </Link>
        </div>

        {!hasSpaces && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 flex flex-col items-center text-center gap-4">
            <span className="text-5xl">🏢</span>
            <h2 className="text-lg font-semibold text-gray-900">No spaces yet</h2>
            <p className="text-sm text-gray-500 max-w-xs">
              Create your first space to get started. Invite your team and manage bookings together.
            </p>
            <Link href="/spaces/new">
              <Button variant="primary" size="md">Create a space</Button>
            </Link>
          </div>
        )}

        {owned.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Owned spaces</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {owned.map(m => (
                <SpaceCard key={m.space.id} membership={m} onDeleteRequest={setDeleteTarget} />
              ))}
            </div>
          </section>
        )}

        {member.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Member of</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {member.map(m => (
                <SpaceCard key={m.space.id} membership={m} onDeleteRequest={() => {}} />
              ))}
            </div>
          </section>
        )}
      </div>

      {deleteTarget && (
        <DeleteModal
          space={deleteTarget}
          onConfirm={handleDeleted}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
