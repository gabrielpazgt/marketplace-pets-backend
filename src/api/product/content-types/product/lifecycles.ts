/**
 * product/content-types/product/lifecycles.ts
 *
 * For products with variants, auto-syncs the root `stock` and `price` fields:
 *   - stock = sum of all variant stocks
 *   - price = minimum variant price (shown as "Desde Q..." on the card)
 *
 * This keeps the DB columns accurate so that:
 *   - The `inStock` filter (stock > 0) works correctly
 *   - The price range filter and facets work correctly
 *
 * When there are no variants, both fields are left untouched (managed manually).
 */

function computeVariantStock(variants: any[]): number {
  return variants.reduce((sum: number, v: any) => {
    const s = parseInt(v?.stock ?? 0, 10);
    return sum + Math.max(0, isNaN(s) ? 0 : s);
  }, 0);
}

function computeVariantMinPrice(variants: any[]): number | null {
  const prices = variants
    .map((v: any) => parseFloat(v?.price ?? 0))
    .filter((p: number) => Number.isFinite(p) && p > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

function syncFromVariants(data: Record<string, any>, variants: any[]): void {
  data.stock = computeVariantStock(variants);
  const minPrice = computeVariantMinPrice(variants);
  if (minPrice !== null) {
    data.price = minPrice;
  }
}

export default {
  beforeCreate(event: any) {
    const data = event.params.data;
    if (Array.isArray(data.variants) && data.variants.length > 0) {
      syncFromVariants(data, data.variants);
    }
  },

  async beforeUpdate(event: any) {
    const data = event.params.data;

    if (Array.isArray(data.variants) && data.variants.length > 0) {
      // Variants are explicitly included in this update (save from admin or bulkUpdateInventory)
      syncFromVariants(data, data.variants);
      return;
    }

    // For publish/unpublish actions the admin only sends { publishedAt }.
    // Fetch the current variants to keep stock and price in sync.
    if (data.variants === undefined) {
      const productId = event.params.where?.id;
      if (!productId) return;

      const existing = await (strapi as any).db
        .query('api::product.product')
        .findOne({ where: { id: productId }, select: ['variants'] });

      if (
        existing &&
        Array.isArray(existing.variants) &&
        existing.variants.length > 0
      ) {
        syncFromVariants(data, existing.variants);
      }
    }
  },
};
