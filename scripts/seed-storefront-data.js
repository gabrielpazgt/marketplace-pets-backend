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
const BRAND_UID = 'api::brand.brand';
const SPECIE_UID = 'api::specie.specie';
const LIFE_STAGE_UID = 'api::life-stage.life-stage';
const DIET_TAG_UID = 'api::diet-tag.diet-tag';
const HEALTH_CONDITION_UID = 'api::health-condition.health-condition';
const INGREDIENT_UID = 'api::ingredient.ingredient';
const MEMBERSHIP_UID = 'api::membership.membership';
const FILE_UID = 'plugin::upload.file';

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

const main = async () => {
  const strapi = createStrapi({
    appDir: process.cwd(),
    distDir: path.join(process.cwd(), 'dist'),
  });

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marketpets-seed-'));

  try {
    await strapi.load();

    const brandMap = await ensureCatalogMap(strapi, BRAND_UID, BRAND_SEED);
    const specieMap = await ensureCatalogMap(strapi, SPECIE_UID, SPECIE_SEED);
    const lifeStageMap = await ensureCatalogMap(strapi, LIFE_STAGE_UID, LIFE_STAGE_SEED);
    const dietTagMap = await ensureCatalogMap(strapi, DIET_TAG_UID, DIET_TAG_SEED);
    const healthMap = await ensureCatalogMap(strapi, HEALTH_CONDITION_UID, HEALTH_SEED);
    const ingredientMap = await ensureCatalogMap(strapi, INGREDIENT_UID, INGREDIENT_SEED);

    await ensureCatalogMap(strapi, MEMBERSHIP_UID, MEMBERSHIP_SEED);

    const products = buildSeedProducts(slugify);
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
