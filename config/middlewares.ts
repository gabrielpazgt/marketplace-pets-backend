export default ({ env }) => [
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      hsts: {
        maxAge: 31536000,       // 1 year
        includeSubDomains: true,
      },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'"],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            env('SUPABASE_API_URL', ''),
            // Strapi admin assets
            'https://market-assets.strapi.io',
          ],
          'media-src': ["'self'", 'data:', 'blob:', env('SUPABASE_API_URL', '')],
          'connect-src': [
            "'self'",
            env('SUPABASE_API_URL', ''),
            env('PUBLIC_URL', 'http://localhost:1338'),
          ],
          'font-src': ["'self'", 'data:'],
          'frame-src': ["'none'"],
          'object-src': ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      xssFilter: true,
      noSniff: true,
      hidePoweredBy: true,
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: env.array('CORS_ORIGIN', ['http://localhost:4200', 'http://127.0.0.1:4200']),
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Cart-Session'],
      credentials: true,
      keepHeaderOnError: true,
    },
  },
  {
    name: 'global::rate-limit',
    config: {},
  },
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
