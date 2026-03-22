const normalizeHeader = (value: unknown): string => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : '';
  }
  return typeof value === 'string' ? value.trim() : '';
};

interface PolicyContextLike {
  request: {
    header?: {
      authorization?: unknown;
    };
  };
  state: {
    user?: unknown;
  };
}

interface JwtPayloadLike {
  id?: number;
}

interface StrapiLike {
  service(uid: 'plugin::users-permissions.jwt'): {
    verify(token: string): Promise<JwtPayloadLike>;
  };
  db: {
    query(uid: 'plugin::users-permissions.user'): {
      findOne(args: { where: { id: number } }): Promise<unknown>;
    };
  };
}

export default async (
  policyContext: PolicyContextLike,
  _config: unknown,
  { strapi }: { strapi: StrapiLike }
) => {
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
