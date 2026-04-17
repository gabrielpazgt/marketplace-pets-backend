'use strict';
/**
 * clean-seed-brands.js
 * Elimina solo las marcas creadas por seed-orders.js (slug termina en -test)
 * y todos los productos asociados a esas marcas.
 */

const path = require('path');
const { createStrapi } = require('@strapi/core');

const BRAND_UID      = 'api::brand.brand';
const PRODUCT_UID    = 'api::product.product';
const CART_ITEM_UID  = 'api::cart-item.cart-item';

async function main() {
  const strapi = createStrapi({
    appDir: process.cwd(),
    distDir: path.join(process.cwd(), 'dist'),
  });
  await strapi.load();

  try {
    // 1. Encontrar marcas seed
    const seedBrands = await strapi.db.query(BRAND_UID).findMany({
      where: { slug: { $endsWith: '-test' } },
      select: ['id', 'name', 'slug'],
    });

    if (seedBrands.length === 0) {
      console.log('No se encontraron marcas seed (slug termina en -test). Nada que limpiar.');
      return;
    }

    console.log(`\nMarcas seed encontradas (${seedBrands.length}):`);
    seedBrands.forEach(b => console.log(`  - ${b.name} [${b.slug}]`));

    const brandIds = seedBrands.map(b => b.id);

    // 2. Encontrar productos de esas marcas
    const seedProducts = await strapi.db.query(PRODUCT_UID).findMany({
      where: { brand: { $in: brandIds } },
      select: ['id', 'name', 'sku'],
    });

    console.log(`\nProductos asociados a eliminar: ${seedProducts.length}`);
    if (seedProducts.length) {
      const productIds = seedProducts.map(p => p.id);

      // 3. Limpiar cart-items que referencian esos productos
      const deletedCart = await strapi.db.query(CART_ITEM_UID).deleteMany({
        where: { product: { $in: productIds } },
      });
      console.log(`  → ${deletedCart?.count ?? 0} cart-items eliminados`);

      // 4. Eliminar productos (los order-items quedan con product=null, nameSnapshot intacto)
      const deletedProds = await strapi.db.query(PRODUCT_UID).deleteMany({
        where: { id: { $in: productIds } },
      });
      console.log(`  → ${deletedProds?.count ?? 0} productos eliminados`);
    }

    // 5. Eliminar marcas seed
    const deletedBrands = await strapi.db.query(BRAND_UID).deleteMany({
      where: { id: { $in: brandIds } },
    });
    console.log(`  → ${deletedBrands?.count ?? 0} marcas eliminadas`);

    console.log('\n✅ Limpieza completada. Puedes ingresar marcas y productos reales desde el admin.');
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  } finally {
    await strapi.destroy();
  }
}

main();
