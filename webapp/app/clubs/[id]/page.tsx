import type { Metadata } from 'next';
import { createClient } from '../../../lib/supabase/server';
import ClubDetailClient from './ClubDetailClient';

interface ClubMeta {
  name: string;
  description: string | null;
  city: string | null;
  avatar_url: string | null;
  member_count: number;
}

async function fetchClubMeta(id: string): Promise<ClubMeta | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('run_clubs').select('name, description, city, avatar_url, member_count').eq('id', id).maybeSingle();
  return data as ClubMeta | null;
}

export async function generateMetadata({ params }: PageProps<'/clubs/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const club = await fetchClubMeta(id);
  if (!club) return { title: 'Club not found' };

  const title = `${club.name}${club.city ? ` — ${club.city}` : ''} run club`;
  const description =
    club.description?.trim() ||
    `Join ${club.name}${club.city ? ` in ${club.city}` : ''} — ${club.member_count} member${club.member_count === 1 ? '' : 's'} on Rootah.`;
  const url = `https://app.rootah.com/clubs/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | Rootah`, description, url, type: 'website', images: club.avatar_url ? [{ url: club.avatar_url }] : undefined },
    twitter: { card: 'summary', title: `${title} | Rootah`, description },
  };
}

export default async function ClubDetailPage({ params }: PageProps<'/clubs/[id]'>) {
  const { id } = await params;
  return <ClubDetailClient id={id} />;
}
