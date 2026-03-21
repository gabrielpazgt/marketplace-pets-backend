import type { Core } from '@strapi/strapi';
import { seedCatalogTaxonomy } from './api/storefront/utils/catalog-taxonomy-db';

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
    const seededCatalogTaxonomy = await seedCatalogTaxonomy(strapi);

    if (seededCatalogTaxonomy) {
      strapi.log.info('[catalog-taxonomy] Seed inicial creado para Collection Types del catalogo');
    }

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
