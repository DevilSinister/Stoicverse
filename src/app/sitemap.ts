import { MetadataRoute } from 'next'

/*
  Only pages a signed-out visitor can actually read.

  `/subscription` was listed here at priority 0.8 while sitting behind
  `requireActiveMembership` — so the one pricing URL advertised to search
  engines redirected every visitor who followed it, including the crawler. The
  route is gone; membership terms are on `/` under `#membership` and the
  purchase itself is `/checkout`, which is signed-in by design and does not
  belong in a sitemap.
*/
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://askstoic.com'
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
