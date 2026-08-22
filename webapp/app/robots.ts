import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/build', '/login', '/my-maps', '/clubs/new', '/runs/new', '/auth/'],
      },
    ],
    sitemap: 'https://app.rootah.com/sitemap.xml',
  };
}
