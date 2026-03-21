export default ({ env }) => [
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      hsts: false,
      contentSecurityPolicy: {
        useDefaults: true,
      },
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
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
