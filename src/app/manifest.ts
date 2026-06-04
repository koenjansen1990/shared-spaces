import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'Shared Spaces',
    short_name:       'Spaces',
    description:      'Book and manage shared creative resources with your trusted group.',
    start_url:        '/',
    display:          'standalone',
    background_color: '#0a0a0a',
    theme_color:      '#0a0a0a',
    orientation:      'portrait-primary',
    scope:            '/',
    icons: [
      {
        src:     '/icons/icon-192.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icons/icon-192-maskable.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'maskable',
      },
      {
        src:     '/icons/icon-512.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icons/icon-512-maskable.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'maskable',
      },
    ],
    // Web Share Target: let the OS share sheet send URLs/text into the app.
    // Requires manifest to be served with HTTPS.
    share_target: {
      action:  '/share',
      method:  'GET',
      params: {
        title: 'title',
        text:  'text',
        url:   'url',
      },
    },
  };
}
