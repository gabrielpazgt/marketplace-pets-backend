'use strict';
/**
 * delete-all-products.js
 * Elimina todos los productos y sus cart-items/order-items huérfanos.
 * Solo para desarrollo. No usar en producción.
 */

const path = require('path');
const { createStrapi } = require('@strapi/core');

async function main() {
  const strapi = createStrapi({
    appDir: process.cwd(),
    distDir: path.join(process.cwd(), 'dist'),
  });
  await strapi.load();

  const PRODUCT_UID    = 'api::product.product';
  const CART_ITEM_UID  = 'api::cart-item.cart-item';
  const ORDER_ITEM_UID = 'api::order-item.order-item';

  try {
    console.log('Eliminando cart-items...');
    const deletedCartItems = await strapi.db.query(CART_ITEM_UID).deleteMany({ where: {} });
    console.log(`  → ${deletedCartItems?.count ?? '?'} cart-items eliminados`);

    console.log('Eliminando order-items...');
    const deletedOrderItems = await strapi.db.query(ORDER_ITEM_UID).deleteMany({ where: {} });
    console.log(`  → ${deletedOrderItems?.count ?? '?'} order-items eliminados`);

    console.log('Eliminando productos...');
    const deletedProducts = await strapi.db.query(PRODUCT_UID).deleteMany({ where: {} });
    console.log(`  → ${deletedProducts?.count ?? '?'} productos eliminados`);

    console.log('\n✅ Listo. Base limpia para la nueva taxonomía.');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await strapi.destroy();
  }
}

main();
