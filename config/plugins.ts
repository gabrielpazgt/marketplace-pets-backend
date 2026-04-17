export default ({ env }) => {
  const emailProvider = env('EMAIL_PROVIDER', 'sendmail');
  const isNodeMailer = emailProvider.toLowerCase() === 'nodemailer';

  return {
    email: {
      config: {
        provider: emailProvider,
        providerOptions: isNodeMailer
          ? {
              host: env('SMTP_HOST'),
              port: env.int('SMTP_PORT', 587),
              secure: env.bool('SMTP_SECURE', false),
              requireTLS: env.bool('SMTP_REQUIRE_TLS', true),
              auth: {
                user: env('SMTP_USERNAME'),
                pass: env('SMTP_PASSWORD'),
              },
              tls: {
                rejectUnauthorized: env.bool('SMTP_TLS_REJECT_UNAUTHORIZED', true),
              },
            }
          : {},
        settings: {
          defaultFrom: env('EMAIL_DEFAULT_FROM', 'no-reply@strapi.io'),
          defaultReplyTo: env('EMAIL_DEFAULT_REPLY_TO', env('EMAIL_DEFAULT_FROM', 'no-reply@strapi.io')),
        },
      },
    },
    upload: {
      config: {
        // Desactiva la re-compresión del archivo original por Sharp.
        // En Windows, el archivo temporal "optimized-*" queda bloqueado
        // y causa EBUSY al intentar borrarlo. Los breakpoints (thumbnail,
        // small, medium, large) siguen generándose normalmente.
        sizeOptimization: false,
      },
    },
    'users-permissions': {
      config: {
        register: {
          allowedFields: ['firstName', 'lastName', 'phone'],
        },
        providers: {
          google: {
            enabled: true,
            icon: 'google',
            key: env('GOOGLE_CLIENT_ID', ''),
            secret: env('GOOGLE_CLIENT_SECRET', ''),
            callback: `${env('PUBLIC_URL', 'http://localhost:1338')}/api/auth/google/callback`,
            scope: ['email', 'profile'],
            custom_params: { prompt: 'select_account' },
          },
        },
      },
    },
  };
};
