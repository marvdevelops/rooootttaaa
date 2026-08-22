import type { MetadataRoute } from 'next';
import { createClient } from '../lib/supabase/server';

const SITE_URL = 'https://app.rootah.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/explore`, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${SITE_URL}/runs`, changeFrequency: 'hourly', priority: 0.7 },
    { url: `${SITE_URL}/clubs`, changeFrequency: 'daily', priority: 0.6 },
  ];

  const supabase = await createClient();
  const { data: routes } = await supabase
    .from('routes')
    .select('id, created_at')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(5000);

  const routeEntries: MetadataRoute.Sitemap = (routes ?? []).map((r) => ({
    url: `${SITE_URL}/routes/${r.id}`,
    lastModified: new Date(r.created_at as string),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const { data: clubs } = await supabase.from('run_clubs').select('id').eq('is_private', false).limit(2000);
  const clubEntries: MetadataRoute.Sitemap = (clubs ?? []).map((c) => ({
    url: `${SITE_URL}/clubs/${c.id}`,
    changeFrequency: 'weekly',
    priority: 0.4,
  }));

  return [...staticEntries, ...routeEntries, ...clubEntries];
}
