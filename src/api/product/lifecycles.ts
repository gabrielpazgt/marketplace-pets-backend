/**
 * product/lifecycles.ts
 *
 * Before creating or updating a product, if it has variants, auto-sync the
 * root `stock` field to the sum of all variant stocks. This ensures the
 * DB-level `stock` column reflects variant inventory so that filters like
 * `inStock` (which query the DB column directly) work correctly.
 *
 * If the product has no variants, `stock` is left as-is (managed manually).
 */

function syncRootStockFromVariants(data: Record<string, any>): void {
  const variants = data.variants;
  if (!Array.isArray(variants) || variants.length === 0) return;

  const total = variants.reduce((sum: number, v: any) => {
    const s = parseInt(v?.stock ?? 0, 10);
    return sum + Math.max(0, isNaN(s) ? 0 : s);
  }, 0);

  data.stock = total;
}

export default {
  beforeCreate(event: any) {
    syncRootStockFromVariants(event.params.data);
  },

  beforeUpdate(event: any) {
    syncRootStockFromVariants(event.params.data);
  },
};
