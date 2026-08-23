import type { Metadata } from 'next';
import { createClient } from '../../../lib/supabase/server';
import ProfileClient from './ProfileClient';

interface ProfileMeta {
  username: string;
  bio: string | null;
  avatar_url: string | null;
}

async function fetchProfileMeta(id: string): Promise<ProfileMeta | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('username, bio, avatar_url').eq('id', id).maybeSingle();
  return data as ProfileMeta | null;
}

export async function generateMetadata({ params }: PageProps<'/profile/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const profile = await fetchProfileMeta(id);
  if (!profile) return { title: 'Profile not found' };

  const title = `${profile.username} on Rootah`;
  const description = profile.bio?.trim() || `See ${profile.username}'s running routes and activity on Rootah.`;
  const url = `https://app.rootah.com/profile/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | Rootah`, description, url, type: 'profile', images: profile.avatar_url ? [{ url: profile.avatar_url }] : undefined },
    twitter: { card: 'summary', title: `${title} | Rootah`, description },
  };
}

export default async function ProfilePage({ params }: PageProps<'/profile/[id]'>) {
  const { id } = await params;
  return <ProfileClient id={id} />;
}
