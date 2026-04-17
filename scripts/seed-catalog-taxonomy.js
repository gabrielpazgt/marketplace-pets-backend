/**
 * seed-catalog-taxonomy.js
 *
 * Crea (o deja intactos si ya existen) los registros de:
 *   - catalog-animal (6 especies)
 *   - catalog-category (categorías y subcategorías por animal)
 *   - filter-scope (qué filtros aplican a qué animal + categoría)
 *
 * Uso:
 *   node scripts/seed-catalog-taxonomy.js
 *
 * Idempotente: busca por `code` / `slug` antes de crear.
 */

'use strict';

const { createStrapi } = require('@strapi/core');

const CATALOG_FILTER_UID = 'api::catalog-filter.catalog-filter';
const ANIMAL_UID    = 'api::catalog-animal.catalog-animal';
const CATEGORY_UID  = 'api::catalog-category.catalog-category';
const SCOPE_UID     = 'api::filter-scope.filter-scope';

const SCOPE_TO_CATALOG_FILTER_KEY_MAP = {
  brand: 'brand',
  price: 'price',
  form: 'form',
  proteinSource: 'protein-source',
  species: 'species',
  lifeStage: 'life-stage',
  dietTag: 'diet-tags',
  healthCondition: 'health-goal',
  ingredient: 'ingredients',
};

function resolveCatalogFilterKey(scopeKey) {
  return SCOPE_TO_CATALOG_FILTER_KEY_MAP[scopeKey] || scopeKey;
}

// ─── Datos base ───────────────────────────────────────────────────────────────

const ANIMALS = [
  {
    key: 'dog', slug: 'perro', label: 'Perro', sortOrder: 1,
    headline: 'Todo para tu perro',
    subtitle: 'Encuentra la mejor nutrición, accesorios y cuidado para tu mejor amigo.',
    searchHint: 'Busca por raza, tamaño o necesidad',
    legacySpeciesHints: ['perro', 'dog', 'canino'],
    categories: [
      {
        slug: 'alimentacion', label: 'Alimentación', legacyCategory: 'food', sortOrder: 1,
        subcategories: [
          { slug: 'alimento-seco',      label: 'Alimento seco',      sortOrder: 1 },
          { slug: 'alimento-humedo',    label: 'Alimento húmedo',    sortOrder: 2 },
          { slug: 'alimento-medicado',  label: 'Alimento medicado',  sortOrder: 3 },
          { slug: 'formulas-lacteas',   label: 'Fórmulas lácteas',   sortOrder: 4 },
        ],
      },
      {
        slug: 'treats', label: 'Treats', legacyCategory: 'treats', sortOrder: 2,
        subcategories: [
          { slug: 'premios-naturales',  label: 'Premios naturales',  sortOrder: 1 },
          { slug: 'snacks-dentales',    label: 'Snacks dentales',    sortOrder: 2 },
          { slug: 'entrenamiento',      label: 'Entrenamiento',      sortOrder: 3 },
        ],
      },
      {
        slug: 'farmacia', label: 'Farmacia', legacyCategory: 'health', sortOrder: 3,
        subcategories: [
          { slug: 'antipulgas',         label: 'Antipulgas y garrapatas', sortOrder: 1 },
          { slug: 'desparasitantes',    label: 'Desparasitantes',         sortOrder: 2 },
          { slug: 'suplementos',        label: 'Suplementos',             sortOrder: 3 },
          { slug: 'vitaminas',          label: 'Vitaminas',               sortOrder: 4 },
        ],
      },
      {
        slug: 'cuidado-rutinario', label: 'Cuidado rutinario', sortOrder: 4,
        subcategories: [
          { slug: 'higiene-dental',     label: 'Higiene dental',    sortOrder: 1 },
          { slug: 'limpieza-oidos',     label: 'Limpieza de oídos', sortOrder: 2 },
          { slug: 'corte-unas',         label: 'Corte de uñas',     sortOrder: 3 },
        ],
      },
      {
        slug: 'aseo', label: 'Aseo', legacyCategory: 'hygiene', sortOrder: 5,
        subcategories: [
          { slug: 'shampoo',            label: 'Shampoo',           sortOrder: 1 },
          { slug: 'acondicionador',     label: 'Acondicionador',    sortOrder: 2 },
          { slug: 'toallas',            label: 'Toallas',           sortOrder: 3 },
          { slug: 'colonia',            label: 'Colonia',           sortOrder: 4 },
        ],
      },
      {
        slug: 'grooming', label: 'Grooming', sortOrder: 6,
        subcategories: [
          { slug: 'cepillos',           label: 'Cepillos',          sortOrder: 1 },
          { slug: 'peines',             label: 'Peines',            sortOrder: 2 },
          { slug: 'tijeras',            label: 'Tijeras',           sortOrder: 3 },
        ],
      },
      {
        slug: 'juguetes', label: 'Juguetes', sortOrder: 7,
        subcategories: [
          { slug: 'interactivos',       label: 'Interactivos',      sortOrder: 1 },
          { slug: 'masticables',        label: 'Masticables',       sortOrder: 2 },
          { slug: 'pelotas',            label: 'Pelotas',           sortOrder: 3 },
          { slug: 'peluches',           label: 'Peluches',          sortOrder: 4 },
        ],
      },
      {
        slug: 'descanso', label: 'Descanso', sortOrder: 8,
        subcategories: [
          { slug: 'camas',              label: 'Camas',             sortOrder: 1 },
          { slug: 'cobijas',            label: 'Cobijas',           sortOrder: 2 },
          { slug: 'cojines',            label: 'Cojines',           sortOrder: 3 },
        ],
      },
      {
        slug: 'suministros', label: 'Suministros', legacyCategory: 'accesories', sortOrder: 9,
        subcategories: [
          { slug: 'correas',            label: 'Correas',           sortOrder: 1 },
          { slug: 'collares',           label: 'Collares',          sortOrder: 2 },
          { slug: 'arneses',            label: 'Arneses',           sortOrder: 3 },
          { slug: 'bozales',            label: 'Bozales',           sortOrder: 4 },
        ],
      },
      {
        slug: 'accesorios', label: 'Accesorios', sortOrder: 10,
        subcategories: [
          { slug: 'bolsos-mochilas',    label: 'Bolsos y mochilas', sortOrder: 1 },
          { slug: 'comederos',          label: 'Comederos',         sortOrder: 2 },
          { slug: 'bebederos',          label: 'Bebederos',         sortOrder: 3 },
        ],
      },
      {
        slug: 'ropa', label: 'Ropa', sortOrder: 11,
        subcategories: [
          { slug: 'camisetas',          label: 'Camisetas',         sortOrder: 1 },
          { slug: 'abrigos',            label: 'Abrigos',           sortOrder: 2 },
          { slug: 'impermeables',       label: 'Impermeables',      sortOrder: 3 },
          { slug: 'zapatos',            label: 'Zapatos',           sortOrder: 4 },
        ],
      },
    ],
  },
  {
    key: 'cat', slug: 'gato', label: 'Gato', sortOrder: 2,
    headline: 'Todo para tu gato',
    subtitle: 'Nutrición, higiene y accesorios pensados para el bienestar felino.',
    searchHint: 'Busca por edad, tipo de pelaje o necesidad',
    legacySpeciesHints: ['gato', 'cat', 'felino'],
    categories: [
      {
        slug: 'alimentacion-gato', label: 'Alimentación', legacyCategory: 'food', sortOrder: 1,
        subcategories: [
          { slug: 'alimento-seco-gato',    label: 'Alimento seco',      sortOrder: 1 },
          { slug: 'alimento-humedo-gato',  label: 'Alimento húmedo',    sortOrder: 2 },
          { slug: 'alimento-medicado-gato',label: 'Alimento medicado',  sortOrder: 3 },
          { slug: 'kitten',                label: 'Kitten / Gatito',    sortOrder: 4 },
        ],
      },
      {
        slug: 'treats-gato', label: 'Treats', legacyCategory: 'treats', sortOrder: 2,
        subcategories: [
          { slug: 'premios-naturales-gato', label: 'Premios naturales', sortOrder: 1 },
          { slug: 'snacks-dentales-gato',   label: 'Snacks dentales',   sortOrder: 2 },
          { slug: 'hairball-control',        label: 'Control de bolas de pelo', sortOrder: 3 },
        ],
      },
      {
        slug: 'farmacia-gato', label: 'Farmacia', legacyCategory: 'health', sortOrder: 3,
        subcategories: [
          { slug: 'antipulgas-gato',     label: 'Antipulgas',           sortOrder: 1 },
          { slug: 'desparasitantes-gato',label: 'Desparasitantes',      sortOrder: 2 },
          { slug: 'suplementos-gato',    label: 'Suplementos',          sortOrder: 3 },
        ],
      },
      {
        slug: 'aseo-gato', label: 'Aseo', legacyCategory: 'hygiene', sortOrder: 4,
        subcategories: [
          { slug: 'shampoo-gato',        label: 'Shampoo',              sortOrder: 1 },
          { slug: 'cepillos-gato',       label: 'Cepillos',             sortOrder: 2 },
          { slug: 'toallitas-gato',      label: 'Toallitas',            sortOrder: 3 },
        ],
      },
      {
        slug: 'arena-sanitaria', label: 'Arena e higiene', sortOrder: 5,
        subcategories: [
          { slug: 'arenas',              label: 'Arenas',               sortOrder: 1 },
          { slug: 'areneros',            label: 'Areneros',             sortOrder: 2 },
          { slug: 'desodorizantes',      label: 'Desodorizantes',       sortOrder: 3 },
        ],
      },
      {
        slug: 'juguetes-gato', label: 'Juguetes', sortOrder: 6,
        subcategories: [
          { slug: 'plumas',              label: 'Plumas y varitas',     sortOrder: 1 },
          { slug: 'pelotas-gato',        label: 'Pelotas',             sortOrder: 2 },
          { slug: 'interactivos-gato',   label: 'Interactivos',        sortOrder: 3 },
        ],
      },
      {
        slug: 'descanso-gato', label: 'Descanso', sortOrder: 7,
        subcategories: [
          { slug: 'camas-gato',          label: 'Camas',                sortOrder: 1 },
          { slug: 'rascadores',          label: 'Rascadores',           sortOrder: 2 },
          { slug: 'hamacas',             label: 'Hamacas',              sortOrder: 3 },
        ],
      },
      {
        slug: 'accesorios-gato', label: 'Accesorios', legacyCategory: 'accesories', sortOrder: 8,
        subcategories: [
          { slug: 'collares-gato',       label: 'Collares',             sortOrder: 1 },
          { slug: 'arneses-gato',        label: 'Arneses',              sortOrder: 2 },
          { slug: 'comederos-gato',      label: 'Comederos',            sortOrder: 3 },
          { slug: 'transportadoras',     label: 'Transportadoras',      sortOrder: 4 },
        ],
      },
    ],
  },
  {
    key: 'fish', slug: 'pez', label: 'Pez y acuario', sortOrder: 3,
    headline: 'Tu mundo acuático',
    subtitle: 'Alimento, equipos y decoración para peces y acuarios de agua dulce y salada.',
    searchHint: 'Busca por tipo de pez o tamaño de acuario',
    legacySpeciesHints: ['pez', 'fish', 'acuario'],
    categories: [
      {
        slug: 'alimentacion-pez', label: 'Alimentación', legacyCategory: 'food', sortOrder: 1,
        subcategories: [
          { slug: 'escamas',             label: 'Escamas',              sortOrder: 1 },
          { slug: 'granulos-pez',        label: 'Gránulos',             sortOrder: 2 },
          { slug: 'alimento-vivo',       label: 'Alimento vivo / congelado', sortOrder: 3 },
          { slug: 'pastillas-fondo',     label: 'Pastillas de fondo',   sortOrder: 4 },
        ],
      },
      {
        slug: 'acuario', label: 'Acuario', sortOrder: 2,
        subcategories: [
          { slug: 'filtros-agua',        label: 'Filtros de agua',      sortOrder: 1 },
          { slug: 'iluminacion-acuario', label: 'Iluminación',          sortOrder: 2 },
          { slug: 'calefactores',        label: 'Calefactores',         sortOrder: 3 },
          { slug: 'bombas-oxigeno',      label: 'Bombas de oxígeno',    sortOrder: 4 },
          { slug: 'sustratos',           label: 'Sustratos',            sortOrder: 5 },
        ],
      },
      {
        slug: 'acondicionadores-agua', label: 'Acondicionadores', sortOrder: 3,
        subcategories: [
          { slug: 'anticloro',           label: 'Anticloro',            sortOrder: 1 },
          { slug: 'bacterias-beneficas', label: 'Bacterias benéficas',  sortOrder: 2 },
          { slug: 'tratamiento-agua',    label: 'Tratamiento de agua',  sortOrder: 3 },
        ],
      },
      {
        slug: 'decoracion-acuario', label: 'Decoración', sortOrder: 4,
        subcategories: [
          { slug: 'plantas-artificiales',label: 'Plantas artificiales', sortOrder: 1 },
          { slug: 'rocas-decorativas',   label: 'Rocas y troncos',     sortOrder: 2 },
          { slug: 'fondos-acuario',      label: 'Fondos',               sortOrder: 3 },
        ],
      },
      {
        slug: 'farmacia-pez', label: 'Farmacia', legacyCategory: 'health', sortOrder: 5,
        subcategories: [
          { slug: 'antiparasitarios-pez',label: 'Antiparasitarios',     sortOrder: 1 },
          { slug: 'antibacterianos',     label: 'Antibacterianos',      sortOrder: 2 },
          { slug: 'cicatrizantes-pez',   label: 'Cicatrizantes',        sortOrder: 3 },
        ],
      },
    ],
  },
  {
    key: 'bird', slug: 'ave', label: 'Ave', sortOrder: 4,
    headline: 'Para tus aves',
    subtitle: 'Nutrición completa, jaulas, accesorios y cuidado para todo tipo de aves.',
    searchHint: 'Busca por tipo de ave o necesidad',
    legacySpeciesHints: ['ave', 'bird', 'pajaro', 'loro'],
    categories: [
      {
        slug: 'alimentacion-ave', label: 'Alimentación', legacyCategory: 'food', sortOrder: 1,
        subcategories: [
          { slug: 'semillas',            label: 'Mezclas de semillas',  sortOrder: 1 },
          { slug: 'pellets-ave',         label: 'Pellets',              sortOrder: 2 },
          { slug: 'frutas-deshidratadas',label: 'Frutas deshidratadas', sortOrder: 3 },
          { slug: 'granulos-ave',        label: 'Gránulos',             sortOrder: 4 },
        ],
      },
      {
        slug: 'jaulas', label: 'Jaulas', sortOrder: 2,
        subcategories: [
          { slug: 'jaulas-pequenas',     label: 'Jaulas pequeñas',      sortOrder: 1 },
          { slug: 'jaulas-grandes',      label: 'Jaulas grandes',       sortOrder: 2 },
          { slug: 'aviarios',            label: 'Aviarios',             sortOrder: 3 },
        ],
      },
      {
        slug: 'accesorios-ave', label: 'Accesorios', legacyCategory: 'accesories', sortOrder: 3,
        subcategories: [
          { slug: 'perchas',             label: 'Perchas',              sortOrder: 1 },
          { slug: 'comederos-ave',       label: 'Comederos',            sortOrder: 2 },
          { slug: 'bebederos-ave',       label: 'Bebederos',            sortOrder: 3 },
        ],
      },
      {
        slug: 'juguetes-ave', label: 'Juguetes', sortOrder: 4,
        subcategories: [
          { slug: 'colgantes',           label: 'Colgantes',            sortOrder: 1 },
          { slug: 'cuerdas-ave',         label: 'Cuerdas y escaleras',  sortOrder: 2 },
          { slug: 'espejos',             label: 'Espejos',              sortOrder: 3 },
        ],
      },
      {
        slug: 'aseo-ave', label: 'Aseo', legacyCategory: 'hygiene', sortOrder: 5,
        subcategories: [
          { slug: 'banaderas-ave',       label: 'Bañaderas',            sortOrder: 1 },
          { slug: 'spray-plumaje',       label: 'Spray para plumaje',   sortOrder: 2 },
        ],
      },
      {
        slug: 'farmacia-ave', label: 'Farmacia', legacyCategory: 'health', sortOrder: 6,
        subcategories: [
          { slug: 'vitaminas-ave',       label: 'Vitaminas',            sortOrder: 1 },
          { slug: 'minerales-ave',       label: 'Minerales',            sortOrder: 2 },
          { slug: 'antiparasitarios-ave',label: 'Antiparasitarios',     sortOrder: 3 },
        ],
      },
    ],
  },
  {
    key: 'reptile', slug: 'reptil', label: 'Reptil', sortOrder: 5,
    headline: 'Para tus reptiles',
    subtitle: 'Alimento, terrarios y equipos especializados para reptiles.',
    searchHint: 'Busca por especie o necesidad de hábitat',
    legacySpeciesHints: ['reptil', 'reptile', 'iguana', 'gecko'],
    categories: [
      {
        slug: 'alimentacion-reptil', label: 'Alimentación', legacyCategory: 'food', sortOrder: 1,
        subcategories: [
          { slug: 'insectos-vivos',      label: 'Insectos vivos',       sortOrder: 1 },
          { slug: 'alimento-congelado',  label: 'Alimento congelado',   sortOrder: 2 },
          { slug: 'suplementos-reptil',  label: 'Suplementos',          sortOrder: 3 },
        ],
      },
      {
        slug: 'terrario', label: 'Terrario', sortOrder: 2,
        subcategories: [
          { slug: 'iluminacion-uv',      label: 'Iluminación UV',       sortOrder: 1 },
          { slug: 'calefaccion',         label: 'Calefacción',          sortOrder: 2 },
          { slug: 'sustratos-reptil',    label: 'Sustratos',            sortOrder: 3 },
          { slug: 'decoracion-terrario', label: 'Decoración',           sortOrder: 4 },
        ],
      },
      {
        slug: 'accesorios-reptil', label: 'Accesorios', legacyCategory: 'accesories', sortOrder: 3,
        subcategories: [
          { slug: 'escondites',          label: 'Escondites',           sortOrder: 1 },
          { slug: 'troncos-reptil',      label: 'Troncos y ramas',     sortOrder: 2 },
          { slug: 'termometros',         label: 'Termómetros e higrómetros', sortOrder: 3 },
        ],
      },
      {
        slug: 'farmacia-reptil', label: 'Farmacia', legacyCategory: 'health', sortOrder: 4,
        subcategories: [
          { slug: 'vitaminas-reptil',    label: 'Vitaminas y calcio',   sortOrder: 1 },
          { slug: 'antiparasitarios-reptil', label: 'Antiparasitarios', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    key: 'small-pet', slug: 'roedor', label: 'Roedor y pequeña mascota', sortOrder: 6,
    headline: 'Para tus pequeñas mascotas',
    subtitle: 'Nutrición, jaulas y accesorios para hamsters, conejos, cobayos y más.',
    searchHint: 'Busca por tipo de roedor o necesidad',
    legacySpeciesHints: ['roedor', 'hamster', 'conejo', 'cobayo', 'small-pet'],
    categories: [
      {
        slug: 'alimentacion-roedor', label: 'Alimentación', legacyCategory: 'food', sortOrder: 1,
        subcategories: [
          { slug: 'pellets-roedor',      label: 'Pellets',              sortOrder: 1 },
          { slug: 'mezclas-roedor',      label: 'Mezclas de semillas',  sortOrder: 2 },
          { slug: 'heno',                label: 'Heno',                 sortOrder: 3 },
          { slug: 'snacks-roedor',       label: 'Snacks y premios',     sortOrder: 4 },
        ],
      },
      {
        slug: 'jaulas-roedor', label: 'Jaulas', sortOrder: 2,
        subcategories: [
          { slug: 'jaulas-hamster',      label: 'Jaulas para hamster',  sortOrder: 1 },
          { slug: 'jaulas-conejo',       label: 'Jaulas para conejo',   sortOrder: 2 },
          { slug: 'accesorios-jaula',    label: 'Accesorios de jaula',  sortOrder: 3 },
        ],
      },
      {
        slug: 'juguetes-roedor', label: 'Juguetes', sortOrder: 3,
        subcategories: [
          { slug: 'ruedas',              label: 'Ruedas',               sortOrder: 1 },
          { slug: 'tubos-tuneles',       label: 'Tubos y túneles',      sortOrder: 2 },
          { slug: 'juguetes-madera',     label: 'Juguetes de madera',   sortOrder: 3 },
        ],
      },
      {
        slug: 'descanso-roedor', label: 'Descanso', sortOrder: 4,
        subcategories: [
          { slug: 'camas-roedor',        label: 'Camas y nidos',        sortOrder: 1 },
          { slug: 'viruta-sustrato',     label: 'Viruta y sustrato',    sortOrder: 2 },
        ],
      },
      {
        slug: 'farmacia-roedor', label: 'Farmacia', legacyCategory: 'health', sortOrder: 5,
        subcategories: [
          { slug: 'vitaminas-roedor',    label: 'Vitaminas',            sortOrder: 1 },
          { slug: 'antiparasitarios-roedor', label: 'Antiparasitarios', sortOrder: 2 },
        ],
      },
    ],
  },
];

// ─── Filter scopes ────────────────────────────────────────────────────────────
// filterKey → los mismos keys que usa el drawer del frontend
// animalSlugs / categorySlugs → vacío = todos
const FILTER_SCOPES = [
  // Globales (todos los animales, todas las categorías)
  { filterKey: 'price',           animalSlugs: [],                            categorySlugs: [], sortOrder: 10 },
  { filterKey: 'brand',           animalSlugs: [],                            categorySlugs: [], sortOrder: 20 },
  { filterKey: 'species',         animalSlugs: [],                            categorySlugs: [], sortOrder: 30 },

  // Etapa de vida → perro y gato, alimentación y farmacia
  {
    filterKey: 'lifeStage',
    animalSlugs: ['perro', 'gato'],
    categorySlugs: ['alimentacion', 'treats', 'farmacia', 'alimentacion-gato', 'treats-gato', 'farmacia-gato'],
    sortOrder: 40,
  },

  // Formato/presentación → animales que comen pienso/semillas
  {
    filterKey: 'form',
    animalSlugs: ['perro', 'gato', 'ave', 'pez'],
    categorySlugs: ['alimentacion', 'treats', 'alimentacion-gato', 'treats-gato', 'alimentacion-ave', 'alimentacion-pez'],
    sortOrder: 50,
  },

  // Proteína / sabor → perro, gato, pez
  {
    filterKey: 'proteinSource',
    animalSlugs: ['perro', 'gato', 'pez'],
    categorySlugs: ['alimentacion', 'treats', 'alimentacion-gato', 'treats-gato', 'alimentacion-pez'],
    sortOrder: 60,
  },

  // Necesidad alimentaria (dietTag) → perro, gato
  {
    filterKey: 'dietTag',
    animalSlugs: ['perro', 'gato'],
    categorySlugs: ['alimentacion', 'treats', 'farmacia', 'alimentacion-gato', 'treats-gato', 'farmacia-gato'],
    sortOrder: 70,
  },

  // Objetivo de salud → perro, gato
  {
    filterKey: 'healthCondition',
    animalSlugs: ['perro', 'gato'],
    categorySlugs: ['alimentacion', 'farmacia', 'alimentacion-gato', 'farmacia-gato'],
    sortOrder: 80,
  },

  // Ingredientes → perro, gato + alimentación
  {
    filterKey: 'ingredient',
    animalSlugs: ['perro', 'gato'],
    categorySlugs: ['alimentacion', 'treats', 'alimentacion-gato', 'treats-gato'],
    sortOrder: 90,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertAnimal(strapi, data) {
  const existing = await strapi.db.query(ANIMAL_UID).findOne({ where: { slug: data.slug } });
  if (existing) {
    console.log(`  [skip] animal "${data.slug}" ya existe`);
    return existing;
  }
  const created = await strapi.db.query(ANIMAL_UID).create({
    data: {
      key: data.key,
      slug: data.slug,
      label: data.label,
      headline: data.headline || null,
      subtitle: data.subtitle || null,
      searchHint: data.searchHint || null,
      legacySpeciesHints: data.legacySpeciesHints || [],
      sortOrder: data.sortOrder || 0,
      isActive: true,
      publishedAt: new Date(),
    },
  });
  console.log(`  [+] animal "${data.slug}"`);
  return created;
}

async function upsertCategory(strapi, data, animalId, parentId = null) {
  const existing = await strapi.db.query(CATEGORY_UID).findOne({ where: { code: data.code } });
  if (existing) {
    console.log(`    [skip] category "${data.code}" ya existe`);
    return existing;
  }
  const created = await strapi.db.query(CATEGORY_UID).create({
    data: {
      code: data.code,
      key: data.key,
      slug: data.slug,
      label: data.label,
      legacyCategory: data.legacyCategory || null,
      level: data.level,
      sortOrder: data.sortOrder || 0,
      isActive: true,
      animal: animalId ? { id: animalId } : undefined,
      parent: parentId ? { id: parentId } : undefined,
      publishedAt: new Date(),
    },
  });
  console.log(`    [+] category "${data.code}"`);
  return created;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const strapi = createStrapi({
    appDir: process.cwd(),
    distDir: require('path').join(process.cwd(), 'dist'),
  });
  await strapi.load();

  try {
    // ── 1. Catalog animals + categories ───────────────────────────────────────
    console.log('\n=== Creando catalog-animal y catalog-category ===');
    const animalMap = {}; // slug → id
    const categoryMap = {}; // slug → id

    for (const animalDef of ANIMALS) {
      const animal = await upsertAnimal(strapi, animalDef);
      animalMap[animalDef.slug] = animal.id;

      for (const catDef of animalDef.categories) {
        const catCode = `${animalDef.slug}-${catDef.slug}`;
        const cat = await upsertCategory(strapi, {
          code: catCode,
          key: catDef.slug,
          slug: catDef.slug,
          label: catDef.label,
          legacyCategory: catDef.legacyCategory,
          level: 'category',
          sortOrder: catDef.sortOrder,
        }, animal.id, null);
        categoryMap[catDef.slug] = cat.id;

        for (const subDef of (catDef.subcategories || [])) {
          const subCode = `${animalDef.slug}-${catDef.slug}-${subDef.slug}`;
          await upsertCategory(strapi, {
            code: subCode,
            key: subDef.slug,
            slug: subDef.slug,
            label: subDef.label,
            level: 'subcategory',
            sortOrder: subDef.sortOrder,
          }, animal.id, cat.id);
        }
      }
    }

    // ── 2. Filter scopes ──────────────────────────────────────────────────────
    console.log('\n=== Creando filter-scope ===');
    const catalogFilters = await strapi.db.query(CATALOG_FILTER_UID).findMany({
      select: ['id', 'key'],
    });
    const catalogFilterMap = Object.fromEntries(
      (catalogFilters || []).map((item) => [item.key, item.id])
    );

    for (const scopeDef of FILTER_SCOPES) {
      // Buscar si ya existe este filterKey con el mismo scope
      const existing = await strapi.db.query(SCOPE_UID).findOne({
        where: { filterKey: scopeDef.filterKey },
        populate: { animals: true, categories: true },
      });

      // Si ya existe y tiene el mismo número de relaciones, skip
      if (existing) {
        console.log(`  [skip] scope "${scopeDef.filterKey}" ya existe`);
        continue;
      }

      const animalIds = scopeDef.animalSlugs
        .map((slug) => animalMap[slug])
        .filter(Boolean)
        .map((id) => ({ id }));

      const categoryIds = scopeDef.categorySlugs
        .map((slug) => categoryMap[slug])
        .filter(Boolean)
        .map((id) => ({ id }));

      const catalogFilterKey = resolveCatalogFilterKey(scopeDef.filterKey);
      const catalogFilterId = catalogFilterMap[catalogFilterKey];
      if (!catalogFilterId) {
        throw new Error(`No existe catalog-filter para scope "${scopeDef.filterKey}" (esperaba "${catalogFilterKey}")`);
      }

      await strapi.db.query(SCOPE_UID).create({
        data: {
          catalogFilter: { id: catalogFilterId },
          filterKey: scopeDef.filterKey,
          sortOrder: scopeDef.sortOrder,
          isVisible: true,
          animals: animalIds,
          categories: categoryIds,
        },
      });
      console.log(`  [+] scope "${scopeDef.filterKey}" (${animalIds.length} animales, ${categoryIds.length} categorías)`);
    }

    console.log('\n✅ Seed completado con éxito.');
  } catch (err) {
    console.error('❌ Error durante el seed:', err);
    process.exit(1);
  } finally {
    await strapi.destroy();
  }
}

main();
