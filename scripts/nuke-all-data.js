'use strict';
/**
 * nuke-all-data.js
 * Elimina TODOS los datos de usuario del storefront.
 * Conserva: admin_users (acceso al panel), y la taxonomía (catalog-animal,
 * catalog-category, catalog-filter, filter-scope, life-stage, diet-tag,
 * health-condition, ingredient, specie).
 * Solo para desarrollo. NO usar en producción.
 */

const path = require('path');
const { createStrapi } = require('@strapi/core');

async function deleteAll(strapi, uid, label) {
  try {
    const result = await strapi.db.query(uid).deleteMany({ where: {} });
    console.log(`  ✓ ${label}: ${result?.count ?? '?'} eliminados`);
  } catch (err) {
    console.error(`  ✗ ${label}: ${err.message}`);
  }
}

async function main() {
  const strapi = createStrapi({
    appDir: process.cwd(),
    distDir: path.join(process.cwd(), 'dist'),
  });
  await strapi.load();

  console.log('\n🗑  Limpieza total de datos (conserva taxonomía y admin)\n');

  // Dependencias primero (hijos antes que padres)
  await deleteAll(strapi, 'api::order-item.order-item',    'Order Items');
  await deleteAll(strapi, 'api::cart-item.cart-item',      'Cart Items');
  await deleteAll(strapi, 'api::order.order',              'Orders');
  await deleteAll(strapi, 'api::cart.cart',                'Carts');
  await deleteAll(strapi, 'api::pet-profile.pet-profile',  'Pet Profiles');
  await deleteAll(strapi, 'api::adress.adress',            'Addresses');
  await deleteAll(strapi, 'api::product.product',          'Products');
  await deleteAll(strapi, 'api::brand.brand',              'Brands');

  // Usuarios del storefront (NO toca admin_users / acceso al panel)
  await deleteAll(strapi, 'plugin::users-permissions.user', 'Storefront Users');

  console.log('\n✅ Base limpia. Taxonomía y admin intactos.\n');

  await strapi.destroy();
}

main().catch((err) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
