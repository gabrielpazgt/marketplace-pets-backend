const normalizeHeader = (value: unknown): string => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : '';
  }
  return typeof value === 'string' ? value.trim() : '';
};

export default async (policyContext: any, _config: any, { strapi }: { strapi: any }) => {
  const rawAuth = normalizeHeader(policyContext.request.header?.authorization);
  if (!rawAuth.toLowerCase().startsWith('bearer ')) {
    return false;
  }

  const token = rawAuth.slice(7).trim();
  if (!token) {
    return false;
  }

  try {
    const jwtService = strapi.service('plugin::users-permissions.jwt');
    const payload = await jwtService.verify(token);
    if (!payload?.id) {
      return false;
    }

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: payload.id },
    });
    if (!user) {
      return false;
    }

    policyContext.state.user = user;
    return true;
  } catch {
    return false;
  }
};
