const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const pickFirstNonEmpty = (values: unknown[]): string => {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const buildUsername = (baseInput: string): string => {
  const cleanedBase = baseInput.toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (cleanedBase.length >= 3) {
    return cleanedBase.slice(0, 50);
  }

  const generated = `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  return generated.slice(0, 50);
};

const removeTransientRegisterFields = (body: Record<string, unknown>) => {
  const transientFields = [
    'nombre',
    'apellido',
    'telefono',
    'name',
    'surname',
    'givenName',
    'familyName',
    'mobile',
    'cellphone',
    'passwordConfirmation',
    'confirmPassword',
    'passwordConfirm',
    'acceptTerms',
    'termsAccepted',
  ];

  for (const field of transientFields) {
    delete body[field];
  }
};

export default (plugin: any) => {
  const patchRegister = (registerHandler: any) => async (ctx: any) => {
    const body = ctx?.request?.body;

    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const firstName = pickFirstNonEmpty([body.firstName, body.nombre, body.name, body.givenName]);
      const lastName = pickFirstNonEmpty([body.lastName, body.apellido, body.surname, body.familyName]);

      const hasPhoneInput = ['phone', 'telefono', 'mobile', 'cellphone'].some((field) => field in body);
      const phone = pickFirstNonEmpty([body.phone, body.telefono, body.mobile, body.cellphone]);

      if (firstName) {
        body.firstName = firstName;
      }

      if (lastName) {
        body.lastName = lastName;
      }

      if (hasPhoneInput) {
        if (phone) {
          body.phone = phone;
        } else {
          delete body.phone;
        }
      }

      if (!normalizeText(body.username)) {
        const emailLocalPart = normalizeText(body.email).toLowerCase().split('@')[0];
        const compositeName = [firstName, lastName]
          .filter(Boolean)
          .join('.')
          .toLowerCase();
        const usernameBase = pickFirstNonEmpty([emailLocalPart, compositeName, 'user']);
        body.username = buildUsername(usernameBase);
      }

      removeTransientRegisterFields(body);
    }

    return registerHandler(ctx);
  };

  if (typeof plugin?.controllers?.auth === 'function') {
    const originalAuthFactory = plugin.controllers.auth;
    plugin.controllers.auth = ({ strapi }: any) => {
      const authController = originalAuthFactory({ strapi });
      authController.register = patchRegister(authController.register);
      return authController;
    };
    return plugin;
  }

  if (plugin?.controllers?.auth?.register) {
    plugin.controllers.auth.register = patchRegister(plugin.controllers.auth.register);
  }

  return plugin;
};
