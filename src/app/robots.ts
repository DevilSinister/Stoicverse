import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/dashboard', '/checkout', '/courses', '/creator', '/master'],
    },
    sitemap: 'https://askstoic.com/sitemap.xml',
  }
}
