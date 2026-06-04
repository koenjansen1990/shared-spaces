import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import type { ResourceWithSlots } from '@/types';
import AddResourceForm from '@/components/space/AddResourceForm';
import ResourceCard from '@/components/space/ResourceCard';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Resources · ${slug}` };
}

export default async function ResourcesPage({ params }: Props) {
  const { slug } = await params;
  const supabase  = await createSupabaseServerClient();

  const { data: space } = await supabase
    .from('spaces')
    .select('id, plan_type')
    .eq('slug', slug)
    .single();

  if (!space) notFound();

  const { data: member } = await supabase
    .from('space_members')
    .select('role')
    .eq('space_id', space.id)
    .single();

  const isAdmin = member?.role === 'owner' || member?.role === 'admin';

  const { data: resources } = await supabase
    .from('resources')
    .select(`
      id, name, description, is_active,
      slots ( id, slot_type, recurrence_day, event_date,
              start_time, end_time, max_capacity, credit_cost, is_active )
    `)
    .eq('space_id', space.id)
    .order('name');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-100">Resources</h1>
        <span className="text-xs text-neutral-500">
          {resources?.length ?? 0} / {space.plan_type === 'free' ? '1' : '∞'}
        </span>
      </div>

      {isAdmin && (
        <AddResourceForm spaceId={space.id} planType={space.plan_type} resourceCount={resources?.length ?? 0} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(resources as ResourceWithSlots[] | null)?.map(resource => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            spaceId={space.id}
            isAdmin={isAdmin}
          />
        ))}
      </div>

      {resources?.length === 0 && (
        <p className="text-sm text-neutral-500">
          No resources yet.{isAdmin ? ' Add one above.' : ' Ask an admin to add resources.'}
        </p>
      )}
    </div>
  );
}
