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
    'users-permissions': {
      config: {
        register: {
          allowedFields: ['firstName', 'lastName', 'phone'],
        },
      },
    },
  };
};
