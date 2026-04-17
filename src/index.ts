import type { Core } from '@strapi/strapi';
import {
  CATALOG_FILTER_UID,
  FILTER_SCOPE_UID,
  resolveCatalogFilterKeyFromScopeKey,
  resolveFilterScopeKeyFromScopeRecord,
} from './api/filter-scope/utils/catalog-filter-key-map';

const ensureOperatorRole = async (strapi: Core.Strapi) => {
  try {
    // 1. Crear rol si no existe
    let role = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'operator' },
    });

    if (!role) {
      role = await strapi.db.query('plugin::users-permissions.role').create({
        data: {
          name: 'Operator',
          type: 'operator',
          description: 'Rol operativo: acceso al portal de gestión de pedidos',
        },
      });
      strapi.log.info('[users-permissions] Rol "operator" creado automáticamente');
    }

    // 2. Copiar permisos del rol "authenticated" para que /api/users/me y demás funcionen
    const authenticatedRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
      populate: ['permissions'],
    });

    if (!authenticatedRole?.permissions?.length) return;

    const existingPerms = await strapi.db.query('plugin::users-permissions.permission').findMany({
      where: { role: { id: (role as any).id } },
    });

    const existingActions = new Set((existingPerms as any[]).map((p) => p.action));
    let copied = 0;

    for (const perm of authenticatedRole.permissions as any[]) {
      if (!existingActions.has(perm.action)) {
        await strapi.db.query('plugin::users-permissions.permission').create({
          data: { action: perm.action, role: (role as any).id },
        });
        copied++;
      }
    }

    if (copied > 0) {
      strapi.log.info(`[users-permissions] ${copied} permisos copiados de "authenticated" a "operator"`);
    }
  } catch (err) {
    strapi.log.warn('[users-permissions] No se pudo configurar rol operator:', err);
  }
};

const ensureOpsUser = async (strapi: Core.Strapi) => {
  const username = process.env.OPS_USER_USERNAME?.trim();
  const email    = process.env.OPS_USER_EMAIL?.trim();
  const password = process.env.OPS_USER_PASSWORD?.trim();

  if (!username || !email || !password) return; // sin vars de entorno, no hace nada

  try {
    const role = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'operator' },
    });
    if (!role) return; // el rol debe existir primero (corre después de ensureOperatorRole)

    const userService = strapi.plugin('users-permissions').service('user');
    const existing = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { username },
    });

    if (existing) {
      // Solo actualizar password y rol si cambió algo
      await userService.edit(existing.id, { password, role: (role as any).id, confirmed: true, blocked: false });
      strapi.log.info(`[ops-user] Usuario "${username}" actualizado`);
    } else {
      await userService.add({
        username,
        email,
        password,
        role: (role as any).id,
        confirmed: true,
        blocked: false,
        provider: 'local',
      });
      strapi.log.info(`[ops-user] Usuario "${username}" creado automáticamente`);
    }
  } catch (err) {
    strapi.log.warn('[ops-user] No se pudo crear/actualizar el usuario operativo:', err);
  }
};

const PERFORMANCE_INDEX_STATEMENTS = [
  `CREATE INDEX IF NOT EXISTS idx_products_published_created_at ON public.products USING btree (created_at DESC) WHERE published_at IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_products_published_category_created_at ON public.products USING btree (category, created_at DESC) WHERE published_at IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_products_published_subcategory_ci ON public.products USING btree (lower(subcategory)) WHERE published_at IS NOT NULL AND subcategory IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_products_published_category_subcategory_ci_created_at ON public.products USING btree (category, lower(subcategory), created_at DESC) WHERE published_at IS NOT NULL AND subcategory IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_products_published_price ON public.products USING btree (price) WHERE published_at IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_products_published_stock ON public.products USING btree (stock) WHERE published_at IS NOT NULL AND stock > 0`,
  `CREATE INDEX IF NOT EXISTS idx_products_published_slug ON public.products USING btree (slug) WHERE published_at IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_products_featured_created_at ON public.products USING btree (created_at DESC) WHERE published_at IS NOT NULL AND is_featured = true`,
  `CREATE INDEX IF NOT EXISTS idx_carts_active_session_key ON public.carts USING btree (session_key) WHERE status_cart = 'active' AND session_key IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_carts_status_cart ON public.carts USING btree (status_cart)`,
  `CREATE INDEX IF NOT EXISTS idx_coupons_published_code_lower ON public.coupons USING btree (lower(code)) WHERE published_at IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_coupons_active_window ON public.coupons USING btree (active_from, active_to) WHERE published_at IS NOT NULL AND is_active = true`,
];

const ensurePerformanceIndexes = async (strapi: Core.Strapi) => {
  const db = strapi.db?.connection;
  if (!db?.raw) {
    return;
  }

  for (const statement of PERFORMANCE_INDEX_STATEMENTS) {
    try {
      await db.raw(statement);
    } catch (error) {
      strapi.log.warn(`[performance] Could not apply index: ${statement}`);
      strapi.log.warn(String(error));
    }
  }
};

const ensureGoogleOAuthPrompt = async (strapi: Core.Strapi) => {
  try {
    const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
    const grantSettings = ((await pluginStore.get({ key: 'grant' })) || {}) as Record<string, any>;
    if (!grantSettings?.google) return;
    if (grantSettings.google.custom_params?.prompt === 'select_account') return;
    grantSettings.google.custom_params = { ...grantSettings.google.custom_params, prompt: 'select_account' };
    await pluginStore.set({ key: 'grant', value: grantSettings });
    strapi.log.info('[users-permissions] Google OAuth: prompt=select_account configurado');
  } catch (e) {
    strapi.log.warn('[users-permissions] No se pudo configurar Google OAuth prompt', e);
  }
};

const ensureFilterScopeCatalogFilters = async (strapi: Core.Strapi) => {
  try {
    const [catalogFilters, filterScopes] = await Promise.all([
      strapi.db.query(CATALOG_FILTER_UID).findMany({
        select: ['id', 'documentId', 'key'],
      }),
      strapi.db.query(FILTER_SCOPE_UID).findMany({
        select: ['id', 'documentId', 'filterKey'],
        populate: {
          catalogFilter: { select: ['id', 'documentId', 'key'] },
        },
      }),
    ]);

    if (!catalogFilters?.length || !filterScopes?.length) return;

    const catalogFilterByKey = new Map<string, any>();
    for (const filter of catalogFilters) {
      const key = String((filter as any)?.key || '').trim();
      if (key) catalogFilterByKey.set(key, filter);
    }

    let updatedCount = 0;
    let missingCount = 0;

    for (const scope of filterScopes as any[]) {
      const resolvedScopeKey = resolveFilterScopeKeyFromScopeRecord(scope);
      const relationFilter = scope.catalogFilter?.key
        ? scope.catalogFilter
        : catalogFilterByKey.get(resolveCatalogFilterKeyFromScopeKey(resolvedScopeKey));

      if (!relationFilter?.id) {
        missingCount += 1;
        continue;
      }

      const data: Record<string, unknown> = {};
      if (!scope.catalogFilter?.id) {
        data.catalogFilter = { id: relationFilter.id };
      }

      if (resolvedScopeKey && scope.filterKey !== resolvedScopeKey) {
        data.filterKey = resolvedScopeKey;
      }

      if (!Object.keys(data).length) continue;

      await strapi.db.query(FILTER_SCOPE_UID).update({
        where: { id: scope.id },
        data,
      });
      updatedCount += 1;
    }

    if (updatedCount > 0) {
      strapi.log.info(`[filter-scope] ${updatedCount} scopes sincronizados con Catalog Filter`);
    }

    if (missingCount > 0) {
      strapi.log.warn(`[filter-scope] ${missingCount} scopes no pudieron vincularse a un Catalog Filter`);
    }
  } catch (error) {
    strapi.log.warn('[filter-scope] No se pudo sincronizar catalogFilter en Filter Scope', error);
  }
};

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensurePerformanceIndexes(strapi);
    await ensureOperatorRole(strapi);
    await ensureOpsUser(strapi);
    await ensureGoogleOAuthPrompt(strapi);
    await ensureFilterScopeCatalogFilters(strapi);

    const resetPasswordUrl = process.env.UP_RESET_PASSWORD_URL?.trim();
    if (!resetPasswordUrl) {
      return;
    }

    const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
    const advancedSettings = ((await pluginStore.get({ key: 'advanced' })) || {}) as Record<string, unknown>;

    if (advancedSettings.email_reset_password === resetPasswordUrl) {
      return;
    }

    await pluginStore.set({
      key: 'advanced',
      value: {
        ...advancedSettings,
        email_reset_password: resetPasswordUrl,
      },
    });

    strapi.log.info(`[users-permissions] Password reset URL configured: ${resetPasswordUrl}`);
  },
};
