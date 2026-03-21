export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1338),
  url: env('PUBLIC_URL', 'http://localhost:1338'),
  proxy: false,
  app: { keys: env.array('APP_KEYS') },
  http: {
    serverOptions: {
      requestTimeout: env.int('SERVER_REQUEST_TIMEOUT_MS', 20000),
      headersTimeout: env.int('SERVER_HEADERS_TIMEOUT_MS', 20000),
      keepAliveTimeout: env.int('SERVER_KEEPALIVE_TIMEOUT_MS', 5000),
    },
  },
});
