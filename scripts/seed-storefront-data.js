const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { createStrapi } = require('@strapi/core');
const {
  BRAND_SEED,
  SPECIE_SEED,
  LIFE_STAGE_SEED,
  DIET_TAG_SEED,
  HEALTH_SEED,
  INGREDIENT_SEED,
  MEMBERSHIP_SEED,
  buildSeedProducts,
} = require('./seed-storefront-catalog-data');

const PRODUCT_UID = 'api::product.product';
const CART_ITEM_UID = 'api::cart-item.cart-item';
const ORDER_ITEM_UID = 'api::order-item.order-item';
const COUPON_UID = 'api::coupon.coupon';
const BRAND_UID = 'api::brand.brand';
const SPECIE_UID = 'api::specie.specie';
const LIFE_STAGE_UID = 'api::life-stage.life-stage';
const DIET_TAG_UID = 'api::diet-tag.diet-tag';
const HEALTH_CONDITION_UID = 'api::health-condition.health-condition';
const INGREDIENT_UID = 'api::ingredient.ingredient';
const MEMBERSHIP_UID = 'api::membership.membership';
const FILE_UID = 'plugin::upload.file';
const PRODUCT_CATEGORY_VALUES = new Set(['food', 'treats', 'hygiene', 'health', 'accesories', 'other']);

const ANIMAL_SPECIE_SLUG_MAP = {
  dog: 'perro',
  cat: 'gato',
  bird: 'ave',
  fish: 'pez',
  reptile: 'reptil',
  'small-pet': 'pequena-mascota',
};

const PROTEIN_BY_ANIMAL = {
  dog: ['chicken', 'lamb', 'beef'],
  cat: ['fish', 'turkey', 'chicken'],
  bird: ['plant', 'mixed', 'insect'],
  fish: ['fish', 'plant', 'mixed'],
  reptile: ['insect', 'mixed', 'plant'],
  'small-pet': ['plant', 'mixed', 'insect'],
};

const WEIGHT_BY_ANIMAL = {
  dog: [{ min: 1, max: 10 }, { min: 10, max: 25 }, { min: 25, max: 45 }],
  cat: [{ min: 0.5, max: 4 }, { min: 4, max: 7 }, { min: 7, max: 12 }],
  bird: [{ min: 0.05, max: 0.2 }, { min: 0.2, max: 0.8 }, { min: 0.8, max: 2.5 }],
  fish: [{ min: 0.01, max: 0.1 }, { min: 0.1, max: 0.5 }, { min: 0.5, max: 5 }],
  reptile: [{ min: 0.3, max: 2 }, { min: 2, max: 6 }, { min: 6, max: 20 }],
  'small-pet': [{ min: 0.2, max: 1 }, { min: 1, max: 3 }, { min: 3, max: 8 }],
};

const LIFE_STAGES_BY_ANIMAL = {
  dog: ['cachorro', 'adulto', 'senior'],
  cat: ['gatito', 'adulto', 'senior'],
  bird: ['cachorro', 'adulto', 'senior'],
  fish: ['cachorro', 'adulto', 'senior'],
  reptile: ['cachorro', 'adulto', 'senior'],
  'small-pet': ['cachorro', 'adulto', 'senior'],
};

const PACKS_BY_CATEGORY = {
  food: ['2kg', '1.5kg', '3kg'],
  treats: ['90g', '150g', '220g'],
  hygiene: ['300ml', '500ml', '750ml'],
  health: ['60 tabs', '120g', '250ml'],
  accesories: ['Talla S', 'Talla M', 'Talla L'],
  other: ['Kit', 'Set', 'Duo'],
};

const TITLE_PREFIXES_BY_CATEGORY = {
  food: ['Formula', 'Receta', 'Blend'],
  treats: ['Snack', 'Premio', 'Bocado'],
  hygiene: ['Care', 'Fresh', 'Clean'],
  health: ['Support', 'Balance', 'Vital'],
  accesories: ['Home', 'Move', 'Play'],
  other: ['Kit', 'Set', 'Pack'],
};

const PRICE_BASE_BY_CATEGORY = {
  food: 68,
  treats: 29,
  hygiene: 41,
  health: 62,
  accesories: 88,
  other: 54,
};

const nowIso = () => new Date().toISOString();

const slugify = (input) =>
  String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);

const safeText = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const createProductSvg = ({ title, subtitle, background, accent }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="1200" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="1200" rx="96" fill="${background}"/>
  <circle cx="990" cy="220" r="170" fill="${accent}" opacity="0.14"/>
  <circle cx="180" cy="1030" r="180" fill="${accent}" opacity="0.16"/>
  <rect x="110" y="130" width="980" height="940" rx="56" fill="white" opacity="0.92"/>
  <rect x="170" y="220" width="860" height="22" rx="11" fill="${accent}" opacity="0.60"/>
  <rect x="170" y="268" width="720" height="14" rx="7" fill="${accent}" opacity="0.26"/>
  <text x="170" y="420" font-family="Verdana, Arial, sans-serif" font-size="64" font-weight="700" fill="#0F172A">${safeText(
    title
  )}</text>
  <text x="170" y="490" font-family="Verdana, Arial, sans-serif" font-size="36" font-weight="500" fill="#334155">${safeText(
    subtitle
  )}</text>
  <rect x="170" y="565" width="350" height="90" rx="22" fill="${accent}" opacity="0.90"/>
  <text x="208" y="624" font-family="Verdana, Arial, sans-serif" font-size="34" font-weight="700" fill="white">MARKETPETS</text>
  <rect x="170" y="710" width="860" height="12" rx="6" fill="${accent}" opacity="0.18"/>
  <rect x="170" y="742" width="620" height="12" rx="6" fill="${accent}" opacity="0.18"/>
  <rect x="170" y="774" width="720" height="12" rx="6" fill="${accent}" opacity="0.18"/>
</svg>
`;

const ensureEntryBySlug = async (strapi, uid, inputData) => {
  const slug = inputData.slug || slugify(inputData.name);
  const data = {
    ...inputData,
    slug,
    publishedAt: inputData.publishedAt || nowIso(),
  };

  const existing = await strapi.db.query(uid).findOne({
    where: { slug },
  });

  if (existing) {
    await strapi.db.query(uid).update({
      where: { id: existing.id },
      data: {
        ...data,
        publishedAt: existing.publishedAt || data.publishedAt,
      },
    });

    return { id: existing.id, action: 'updated', slug };
  }

  const created = await strapi.db.query(uid).create({ data });
  return { id: created.id, action: 'created', slug };
};

const ensureCatalogMap = async (strapi, uid, entries) => {
  const map = {};
  for (const entry of entries) {
    const created = await ensureEntryBySlug(strapi, uid, entry);
    map[created.slug] = created.id;
  }
  return map;
};

const ensureProductImage = async (strapi, tmpDir, product, palette) => {
  const filename = `${product.slug}.svg`;
  const existing = await strapi.db.query(FILE_UID).findOne({
    where: { name: filename },
  });

  if (existing) {
    return existing.id;
  }

  const svg = createProductSvg({
    title: product.name,
    subtitle: product.subtitle || 'Imagen de prueba para frontend local',
    background: palette.background,
    accent: palette.accent,
  });

  const filepath = path.join(tmpDir, filename);
  await fs.writeFile(filepath, svg, 'utf8');
  const stats = await fs.stat(filepath);

  const uploaded = await strapi.plugin('upload').service('upload').upload({
    data: {
      fileInfo: {
        alternativeText: product.name,
        caption: `Producto de prueba: ${product.name}`,
      },
    },
    files: {
      filepath,
      originalFilename: filename,
      mimetype: 'image/svg+xml',
      size: stats.size,
    },
  });

  if (!Array.isArray(uploaded) || uploaded.length === 0) {
    throw new Error(`No se pudo subir imagen para ${product.slug}`);
  }

  return uploaded[0].id;
};

const ensureProduct = async (strapi, productData) => {
  const existing = await strapi.db.query(PRODUCT_UID).findOne({
    where: { slug: productData.slug },
  });

  if (existing) {
    await strapi.db.query(PRODUCT_UID).update({
      where: { id: existing.id },
      data: {
        ...productData,
        publishedAt: existing.publishedAt || productData.publishedAt || nowIso(),
      },
    });
    return { id: existing.id, action: 'updated' };
  }

  const created = await strapi.db.query(PRODUCT_UID).create({
    data: {
      ...productData,
      publishedAt: productData.publishedAt || nowIso(),
    },
  });

  return { id: created.id, action: 'created' };
};

const parseFlag = (name) => process.argv.includes(name);

const parseArgNumber = (name, fallback) => {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (!found) return fallback;

  const parsed = Number(found.slice(prefix.length));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizeFilterKeyList = (filters) =>
  Array.from(
    new Set(
      (Array.isArray(filters) ? filters : [])
        .map((item) => normalizeText(typeof item === 'string' ? item : item?.key))
        .filter(Boolean)
    )
  );

const collectEntityIds = async (strapi, uid, where = {}) => {
  const ids = [];
  let lastId = 0;
  const limit = 250;

  for (;;) {
    const constraints = [{ id: { $gt: lastId } }];
    if (where && Object.keys(where).length) {
      constraints.unshift(where);
    }

    const rows = await strapi.db.query(uid).findMany({
      where: constraints.length === 1 ? constraints[0] : { $and: constraints },
      select: ['id'],
      limit,
      orderBy: { id: 'asc' },
    });

    if (!rows.length) break;
    for (const row of rows) {
      ids.push(row.id);
    }

    lastId = rows[rows.length - 1].id;
    if (rows.length < limit) break;
  }

  return ids;
};

const resetProductsCatalog = async (strapi) => {
  const couponIds = await collectEntityIds(strapi, COUPON_UID);
  for (const couponId of couponIds) {
    await strapi.db.query(COUPON_UID).update({
      where: { id: couponId },
      data: { eligibleProducts: [] },
    });
  }

  const cartItemIds = await collectEntityIds(strapi, CART_ITEM_UID, {
    product: { id: { $notNull: true } },
  });
  for (const itemId of cartItemIds) {
    await strapi.db.query(CART_ITEM_UID).delete({ where: { id: itemId } });
  }

  const orderItemIds = await collectEntityIds(strapi, ORDER_ITEM_UID, {
    product: { id: { $notNull: true } },
  });
  for (const itemId of orderItemIds) {
    await strapi.db.query(ORDER_ITEM_UID).update({
      where: { id: itemId },
      data: { product: null },
    });
  }

  const productIds = await collectEntityIds(strapi, PRODUCT_UID);
  for (const productId of productIds) {
    await strapi.db.query(PRODUCT_UID).delete({ where: { id: productId } });
  }

  return {
    couponsUpdated: couponIds.length,
    cartItemsDeleted: cartItemIds.length,
    orderItemsDetached: orderItemIds.length,
    productsDeleted: productIds.length,
  };
};

const resolveLegacyCategory = (category) => {
  const raw = normalizeText(category?.legacyCategory);
  if (PRODUCT_CATEGORY_VALUES.has(raw)) return raw;
  return 'other';
};

const resolveAnimalKey = (animal) => normalizeText(animal?.key || animal?.slug);

const resolveSpecieSlug = (animal) => {
  const key = resolveAnimalKey(animal);
  if (ANIMAL_SPECIE_SLUG_MAP[key]) return ANIMAL_SPECIE_SLUG_MAP[key];

  const hints = (animal?.legacySpeciesHints || []).map((hint) => normalizeText(hint));
  if (hints.includes('perro') || hints.includes('dog')) return 'perro';
  if (hints.includes('gato') || hints.includes('cat')) return 'gato';
  if (hints.includes('ave') || hints.includes('bird')) return 'ave';
  if (hints.includes('pez') || hints.includes('fish') || hints.includes('acuario')) return 'pez';
  if (hints.includes('reptil') || hints.includes('reptile')) return 'reptil';
  if (hints.includes('roedor') || hints.includes('small-pet') || hints.includes('pequena mascota')) return 'pequena-mascota';

  return null;
};

const resolveForm = (legacyCategory, subcategorySlug) => {
  if (legacyCategory === 'food') {
    return normalizeText(subcategorySlug).includes('humedo') ? 'wet' : 'kibble';
  }
  if (legacyCategory === 'treats') return 'treat';
  if (legacyCategory === 'hygiene') return 'hygiene';
  if (legacyCategory === 'health') return 'supplement';
  return 'accesory';
};

const resolveProteinSource = (animalKey, legacyCategory, index) => {
  if (!['food', 'treats', 'health'].includes(legacyCategory)) {
    return undefined;
  }

  const pool = PROTEIN_BY_ANIMAL[animalKey] || ['mixed', 'plant', 'chicken'];
  return pool[index % pool.length];
};

const resolveWeightRange = (animalKey, legacyCategory, index) => {
  if (['hygiene', 'accesories', 'other'].includes(legacyCategory)) {
    return { min: 0, max: 999 };
  }

  const pool = WEIGHT_BY_ANIMAL[animalKey] || [{ min: 0, max: 999 }];
  return pool[index % pool.length];
};

const resolveLifeStages = (animalKey, legacyCategory, index) => {
  const defaults = LIFE_STAGES_BY_ANIMAL[animalKey] || ['adulto', 'senior'];

  if (['food', 'treats', 'health'].includes(legacyCategory)) {
    return [defaults[index % defaults.length]];
  }

  return defaults;
};

const buildDescription = (animalLabel, categoryLabel, subcategoryLabel, name) => [
  {
    type: 'paragraph',
    children: [
      {
        type: 'text',
        text: `${name}. Producto de prueba para ${animalLabel.toLowerCase()} dentro de ${categoryLabel} / ${subcategoryLabel}.`,
      },
    ],
  },
];

const buildProductsFromTaxonomy = (taxonomyData, slugify, targetCount) => {
  const animals = Array.isArray(taxonomyData?.animals) ? taxonomyData.animals : [];
  const combos = [];

  for (const animal of animals) {
    const animalKey = resolveAnimalKey(animal);
    const animalLabel = String(animal?.label || animalKey || 'Mascota').trim();
    const specieSlug = resolveSpecieSlug(animal);
    const categories = Array.isArray(animal?.categories) ? animal.categories : [];

    for (const category of categories) {
      const legacyCategory = resolveLegacyCategory(category);
      const categoryLabel = String(category?.label || legacyCategory).trim();
      const categoryFilterKeys = normalizeFilterKeyList(category?.recommendedFilters);
      const subcategories = Array.isArray(category?.subcategories) ? category.subcategories : [];

      for (const subcategory of subcategories) {
        const subcategoryLabel = String(subcategory?.label || subcategory?.slug || 'General').trim();
        const subcategorySlug = String(subcategory?.slug || '').trim();
        const subcategoryFilterKeys = normalizeFilterKeyList(subcategory?.recommendedFilters);

        if (!subcategoryLabel) continue;

        combos.push({
          animalKey,
          animalLabel,
          specieSlug,
          legacyCategory,
          categoryLabel,
          subcategoryLabel,
          subcategorySlug,
          recommendedFilterKeys: subcategoryFilterKeys.length ? subcategoryFilterKeys : categoryFilterKeys,
        });
      }
    }
  }

  const grouped = new Map();
  for (const combo of combos) {
    const key = `${combo.animalKey}|${combo.legacyCategory}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(combo);
  }

  const groupKeys = Array.from(grouped.keys()).sort();
  for (const key of groupKeys) {
    grouped.get(key).sort((a, b) => a.subcategoryLabel.localeCompare(b.subcategoryLabel, 'es'));
  }

  const selected = [];
  while (selected.length < targetCount) {
    let added = false;

    for (const key of groupKeys) {
      const bucket = grouped.get(key);
      if (!bucket || !bucket.length) continue;
      selected.push(bucket.shift());
      added = true;
      if (selected.length >= targetCount) break;
    }

    if (!added) break;
  }

  const dietSlugs = DIET_TAG_SEED.map((item) => item.slug);
  const healthSlugs = HEALTH_SEED.map((item) => item.slug);
  const ingredientSlugs = INGREDIENT_SEED.map((item) => item.slug);
  const products = [];

  selected.forEach((entry, index) => {
    const packPool = PACKS_BY_CATEGORY[entry.legacyCategory] || ['Unidad'];
    const titlePool = TITLE_PREFIXES_BY_CATEGORY[entry.legacyCategory] || ['Pack'];
    const title = titlePool[index % titlePool.length];
    const pack = packPool[index % packPool.length];
    const proteinSource = resolveProteinSource(entry.animalKey, entry.legacyCategory, index);
    const weightRange = resolveWeightRange(entry.animalKey, entry.legacyCategory, index);
    const lifeStages = resolveLifeStages(entry.animalKey, entry.legacyCategory, index);
    const form = resolveForm(entry.legacyCategory, entry.subcategorySlug);

    const name = entry.legacyCategory === 'other'
      ? `${title} ${entry.subcategoryLabel} ${entry.animalLabel}`
      : `${title} ${entry.subcategoryLabel} ${entry.animalLabel} ${pack}`.trim();

    const basePrice = PRICE_BASE_BY_CATEGORY[entry.legacyCategory] || 49;
    const price = Number((basePrice + (index % 7) * 5 + Math.floor(index / 9) * 2).toFixed(2));
    const stock = 12 + (index % 9) * 4 + Math.floor(index / 6);
    const dietTags = ['food', 'treats', 'health'].includes(entry.legacyCategory)
      ? [dietSlugs[index % dietSlugs.length]]
      : [];
    const health = [healthSlugs[index % healthSlugs.length]];
    const supportsIngredients = (entry.recommendedFilterKeys || []).includes('ingredients');
    const ingredients = supportsIngredients
      ? [ingredientSlugs[index % ingredientSlugs.length], ingredientSlugs[(index + 3) % ingredientSlugs.length]]
      : [];

    products.push({
      name,
      subtitle: `Prueba de filtros para ${entry.animalLabel.toLowerCase()} en ${entry.categoryLabel.toLowerCase()}.`,
      description: buildDescription(entry.animalLabel, entry.categoryLabel, entry.subcategoryLabel, name),
      slug: slugify(`${entry.animalKey}-${entry.legacyCategory}-${entry.subcategorySlug || entry.subcategoryLabel}-${index + 1}`),
      price,
      stock,
      isFeatured: index % 11 === 0,
      category: entry.legacyCategory,
      subcategory: entry.subcategoryLabel,
      form,
      proteinSource,
      brandSlug: BRAND_SEED[index % BRAND_SEED.length].slug,
      species: entry.specieSlug ? [entry.specieSlug] : [],
      lifeStages,
      dietTags,
      health,
      ingredients,
      weightMinKg: weightRange.min,
      weightMaxKg: weightRange.max,
    });
  });

  return products;
};

const main = async () => {
  const resetProducts = parseFlag('--reset-products');
  const targetCount = parseArgNumber('--target-count', 108);

  const strapi = createStrapi({
    appDir: process.cwd(),
    distDir: path.join(process.cwd(), 'dist'),
  });

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marketpets-seed-'));

  try {
    await strapi.load();

    if (resetProducts) {
      const resetSummary = await resetProductsCatalog(strapi);
      console.log('Limpieza de productos completada');
      console.log(`- Cupones actualizados: ${resetSummary.couponsUpdated}`);
      console.log(`- Cart items eliminados: ${resetSummary.cartItemsDeleted}`);
      console.log(`- Order items desligados: ${resetSummary.orderItemsDetached}`);
      console.log(`- Productos eliminados: ${resetSummary.productsDeleted}`);
    }

    const brandMap = await ensureCatalogMap(strapi, BRAND_UID, BRAND_SEED);
    const specieMap = await ensureCatalogMap(strapi, SPECIE_UID, SPECIE_SEED);
    const lifeStageMap = await ensureCatalogMap(strapi, LIFE_STAGE_UID, LIFE_STAGE_SEED);
    const dietTagMap = await ensureCatalogMap(strapi, DIET_TAG_UID, DIET_TAG_SEED);
    const healthMap = await ensureCatalogMap(strapi, HEALTH_CONDITION_UID, HEALTH_SEED);
    const ingredientMap = await ensureCatalogMap(strapi, INGREDIENT_UID, INGREDIENT_SEED);

    await ensureCatalogMap(strapi, MEMBERSHIP_UID, MEMBERSHIP_SEED);

    let products = [];
    try {
      const storefrontService = strapi.service('api::storefront.storefront');
      const taxonomyPayload = await storefrontService.listCatalogTaxonomy();
      products = buildProductsFromTaxonomy(taxonomyPayload?.data || {}, slugify, targetCount);
    } catch (taxonomyError) {
      console.warn('No se pudo usar la taxonomia en DB, usando seed estatico.', taxonomyError?.message || taxonomyError);
      products = buildSeedProducts(slugify);
    }

    const palettes = [
      { background: '#FFF8EC', accent: '#EA9A00' },
      { background: '#EEF6FF', accent: '#1976D2' },
      { background: '#EFFAF3', accent: '#1B8A5A' },
      { background: '#FFF2F2', accent: '#D84343' },
      { background: '#F5F3FF', accent: '#5C4DB1' },
      { background: '#F2FBFB', accent: '#00897B' },
    ];

    const resultCounter = { created: 0, updated: 0 };

    for (let index = 0; index < products.length; index += 1) {
      const product = products[index];
      const palette = palettes[index % palettes.length];
      const imageId = await ensureProductImage(strapi, tmpDir, product, palette);

      const prepared = {
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        stock: product.stock,
        isFeatured: Boolean(product.isFeatured),
        category: product.category,
        subcategory: product.subcategory,
        form: product.form,
        proteinSource: product.proteinSource,
        weightMinKg: product.weightMinKg ?? 0,
        weightMaxKg: product.weightMaxKg ?? 999,
        brand: brandMap[product.brandSlug] || null,
        speciesSupported: (product.species || []).map((slug) => specieMap[slug]).filter(Boolean),
        lifeStages: (product.lifeStages || []).map((slug) => lifeStageMap[slug]).filter(Boolean),
        diet_tags: (product.dietTags || []).map((slug) => dietTagMap[slug]).filter(Boolean),
        health_claims: (product.health || []).map((slug) => healthMap[slug]).filter(Boolean),
        ingredients: (product.ingredients || []).map((slug) => ingredientMap[slug]).filter(Boolean),
        images: [imageId],
      };

      const saved = await ensureProduct(strapi, prepared);
      resultCounter[saved.action] += 1;
    }

    const totalProducts = await strapi.db.query(PRODUCT_UID).count();
    const totalPublishedProducts = await strapi.db
      .query(PRODUCT_UID)
      .count({ where: { publishedAt: { $notNull: true } } });

    console.log('Seed completado');
    console.log(`- Productos en catalogo demo: ${products.length}`);
    console.log(`- Productos creados: ${resultCounter.created}`);
    console.log(`- Productos actualizados: ${resultCounter.updated}`);
    console.log(`- Total productos: ${totalProducts}`);
    console.log(`- Publicados: ${totalPublishedProducts}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await strapi.destroy();
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error en seed:', error);
    process.exit(1);
  });
