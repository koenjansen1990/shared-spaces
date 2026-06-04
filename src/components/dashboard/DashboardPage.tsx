'use client';

import Link from 'next/link';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import type { SpaceMembership } from '@/app/dashboard/page';

const SPACE_TYPE_LABELS: Record<string, string> = {
  workplace:    'Workspace / Studio',
  holiday_home: 'Holiday Home',
};

const SPACE_TYPE_EMOJI: Record<string, string> = {
  workplace:    '🏢',
  holiday_home: '🏡',
};

function SpaceCard({ membership }: { membership: SpaceMembership }) {
  const { role, space } = membership;
  const isAdmin = role === 'owner' || role === 'admin';
  const setupIncomplete = !space.onboarding_completed_at;
  const typeLabel = space.space_type ? (SPACE_TYPE_LABELS[space.space_type] ?? space.space_type) : null;
  const typeEmoji = space.space_type ? (SPACE_TYPE_EMOJI[space.space_type] ?? '🏢') : '🏢';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <Link href={`/space/${space.slug}/schedule`} className="flex flex-col flex-1">
        {/* Hero */}
        {space.hero_image_url ? (
          <div className="relative h-32 w-full">
            <Image
              src={space.hero_image_url}
              alt={space.name}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="h-32 w-full bg-gray-100 flex items-center justify-center text-4xl">
            {typeEmoji}
          </div>
        )}

        <div className="p-4 flex flex-col gap-1 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-gray-900 leading-tight">{space.name}</span>
            {/* Role pill */}
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

          {typeLabel && (
            <span className="text-xs text-gray-400">{typeLabel}</span>
          )}

          {setupIncomplete && (
            <span className="mt-1 inline-flex self-start text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Setup incomplete
            </span>
          )}
        </div>
      </Link>

      {/* Continue setup link — only for admins with incomplete setup */}
      {isAdmin && setupIncomplete && (
        <div className="px-4 pb-4">
          <Link
            href={`/space/${space.slug}/setup`}
            className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            Continue setup →
          </Link>
        </div>
      )}
    </div>
  );
}

interface Props {
  owned:  SpaceMembership[];
  member: SpaceMembership[];
}

export default function DashboardPage({ owned, member }: Props) {
  const hasSpaces = owned.length > 0 || member.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
        {/* Top bar */}
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
                <SpaceCard key={m.space.id} membership={m} />
              ))}
            </div>
          </section>
        )}

        {member.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Member of</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {member.map(m => (
                <SpaceCard key={m.space.id} membership={m} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
