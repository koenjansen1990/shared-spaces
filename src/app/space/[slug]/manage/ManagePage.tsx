'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { updateSpaceDetails, generateInviteLink } from '@/lib/actions/profile';
import { saveSpaceDetails } from '@/lib/actions/setup';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Space } from '@/types';
import Button from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import Label from '@/components/ui/Label';

interface Props {
  space: Space;
  slug:  string;
}

export default function ManagePage({ space, slug }: Props) {
  const router = useRouter();

  const [name,        setName]        = useState(space.name);
  const [description, setDescription] = useState(space.description ?? '');
  const [basicMsg,    setBasicMsg]    = useState<string | null>(null);
  const [isBasic,     startBasic]     = useTransition();

  const [heroUrl,      setHeroUrl]      = useState(space.hero_image_url ?? '');
  const [heroUploading, setHeroUploading] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);

  const [welcome,   setWelcome]   = useState(space.welcome_message ?? '');
  const [email,     setEmail]     = useState(space.contact_email   ?? '');
  const [phone,     setPhone]     = useState(space.contact_phone   ?? '');
  const [address,   setAddress]   = useState(space.address         ?? '');
  const [detailMsg, setDetailMsg] = useState<string | null>(null);
  const [isDetail,  startDetail]  = useTransition();

  const [inviteUrl,     setInviteUrl]     = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroUploading(true);
    const supabase = createSupabaseBrowserClient();
    const ext  = file.name.split('.').pop();
    const path = `${space.id}/hero.${ext}`;
    const { error } = await supabase.storage.from('space-images').upload(path, file, { upsert: true });
    if (error) { setBasicMsg(error.message); setHeroUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('space-images').getPublicUrl(path);
    const url = `${publicUrl}?t=${Date.now()}`;
    setHeroUrl(url);
    await (supabase.from('spaces') as any).update({ hero_image_url: url }).eq('id', space.id);
    setHeroUploading(false);
    setBasicMsg('Hero image updated.');
  }

  async function handleSaveBasics() {
    if (!name.trim()) return;
    setBasicMsg(null);
    startBasic(async () => {
      const r = await saveSpaceDetails(space.id, name, description);
      if (r.success) { setBasicMsg('Saved.'); router.refresh(); }
      else setBasicMsg(r.error ?? 'Error');
    });
  }

  async function handleSaveDetails() {
    setDetailMsg(null);
    startDetail(async () => {
      const r = await updateSpaceDetails(space.id, { welcome_message: welcome, contact_email: email, contact_phone: phone, address });
      setDetailMsg(r.success ? 'Saved.' : (r.error ?? 'Error'));
    });
  }

  async function generateInvite() {
    setLoadingInvite(true);
    const r = await generateInviteLink(space.id);
    setLoadingInvite(false);
    if (r.success && r.token) setInviteUrl(`${window.location.origin}/join/${r.token}`);
  }

  function copyInvite() {
    if (inviteUrl) navigator.clipboard.writeText(inviteUrl);
  }

  return (
    <div className="max-w-lg mx-auto w-full space-y-10 py-4">

      <Button variant="ghost" size="sm" onClick={() => router.push(`/space/${slug}/schedule`)}>
        ← Back to schedule
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Spaces</h1>
        <p className="text-sm text-gray-400 mt-1">Configure your space.</p>
      </div>

      {/* Basics */}
      <section className="space-y-5">
        <h2 className="text-xs uppercase tracking-widest text-gray-400 font-medium">Basics</h2>

        {/* Hero image */}
        <div className="space-y-2">
          <Label>Hero image</Label>
          <button
            type="button"
            onClick={() => heroFileRef.current?.click()}
            disabled={heroUploading}
            className="relative w-full rounded-2xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors"
            style={{ height: '140px' }}
          >
            {heroUrl
              ? <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{heroUploading ? 'Uploading…' : 'Change image'}</span>
                  </div>
                </>
              : <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center gap-2">
                  <svg className="w-6 h-6 text-gray-300" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-xs text-gray-400">{heroUploading ? 'Uploading…' : 'Upload hero image'}</span>
                </div>
            }
          </button>
          <input ref={heroFileRef} type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
        </div>

        <div className="space-y-2">
          <Label>Space name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={2} placeholder="A short description of the space" />
        </div>

        {basicMsg && <p className={`text-sm ${basicMsg === 'Saved.' ? 'text-emerald-600' : 'text-red-500'}`}>{basicMsg}</p>}
        <Button onClick={handleSaveBasics} disabled={isBasic || !name.trim()}>
          {isBasic ? 'Saving…' : 'Save basics'}
        </Button>
      </section>

      {/* Contact & info */}
      <section className="space-y-5 pt-4 border-t border-gray-200">
        <h2 className="text-xs uppercase tracking-widest text-gray-400 font-medium">Contact & info</h2>
        <p className="text-xs text-gray-400 -mt-3">Shown in the space info panel for all members.</p>

        <div className="space-y-2">
          <Label>Welcome message</Label>
          <Textarea value={welcome} onChange={e => setWelcome(e.target.value)}
            rows={3} placeholder="Welcome to the space…" />
        </div>

        <div className="space-y-2">
          <Label>Contact email</Label>
          <Input value={email} onChange={e => setEmail(e.target.value)} type="email"
            placeholder="hello@studio.com" />
        </div>

        <div className="space-y-2">
          <Label>Contact phone</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
            placeholder="+31 6 12345678" />
        </div>

        <div className="space-y-2">
          <Label>Address</Label>
          <Textarea value={address} onChange={e => setAddress(e.target.value)}
            rows={2} placeholder="Keizersgracht 123, Amsterdam" />
        </div>

        {detailMsg && <p className={`text-sm ${detailMsg === 'Saved.' ? 'text-emerald-600' : 'text-red-500'}`}>{detailMsg}</p>}
        <Button onClick={handleSaveDetails} disabled={isDetail}>
          {isDetail ? 'Saving…' : 'Save details'}
        </Button>
      </section>

      {/* Availability */}
      <section className="space-y-4 pt-4 border-t border-gray-200">
        <h2 className="text-xs uppercase tracking-widest text-gray-400 font-medium">Availability</h2>
        <p className="text-xs text-gray-400">Change which days are bookable, capacity, and calendar view.</p>
        <Button variant="secondary" onClick={() => router.push(`/space/${slug}/setup`)}>
          Reconfigure availability →
        </Button>
      </section>

      {/* Invite link */}
      <section className="space-y-4 pt-4 border-t border-gray-200">
        <h2 className="text-xs uppercase tracking-widest text-gray-400 font-medium">Invite members</h2>

        {inviteUrl ? (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
            <p className="text-sm text-gray-500 font-mono break-all">{inviteUrl}</p>
            <Button variant="secondary" size="md" onClick={copyInvite}>Copy link</Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={generateInvite} disabled={loadingInvite}>
            {loadingInvite ? 'Generating…' : 'Generate invite link'}
          </Button>
        )}
      </section>
    </div>
  );
}
