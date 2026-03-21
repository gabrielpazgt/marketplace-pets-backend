const CATEGORY_ORDER = ['food', 'treats', 'hygiene', 'health', 'accesories', 'other'];

const BRAND_SEED = [
  { name: 'Pet Nutri', slug: 'pet-nutri', isActive: true },
  { name: 'Paw Care', slug: 'paw-care', isActive: true },
  { name: 'Cozy Paws', slug: 'cozy-paws', isActive: true },
  { name: 'Pet Vital', slug: 'pet-vital', isActive: true },
  { name: 'Urban Tail', slug: 'urban-tail', isActive: true },
  { name: 'Habitat One', slug: 'habitat-one', isActive: true },
  { name: 'Aqua Nova', slug: 'aqua-nova', isActive: true },
  { name: 'Terra Bloom', slug: 'terra-bloom', isActive: true },
];

const SPECIE_SEED = [
  { name: 'Perro', slug: 'perro' },
  { name: 'Gato', slug: 'gato' },
  { name: 'Ave', slug: 'ave' },
  { name: 'Pez y acuario', slug: 'pez' },
  { name: 'Reptil', slug: 'reptil' },
  { name: 'Pequena mascota', slug: 'pequena-mascota' },
];

const LIFE_STAGE_SEED = [
  { name: 'Cachorro', slug: 'cachorro' },
  { name: 'Adulto', slug: 'adulto' },
  { name: 'Senior', slug: 'senior' },
  { name: 'Gatito', slug: 'gatito' },
];

const DIET_TAG_SEED = [
  { name: 'Grain Free', slug: 'grain_free' },
  { name: 'High Protein', slug: 'high_protein' },
  { name: 'Low Calorie', slug: 'low_calorie' },
  { name: 'Urinary', slug: 'urinary' },
  { name: 'Renal', slug: 'renal' },
  { name: 'Hypoallergenic', slug: 'hypoallergenic' },
];

const HEALTH_SEED = [
  { name: 'Piel y pelaje', slug: 'piel-pelaje' },
  { name: 'Cuidado dental', slug: 'cuidado-dental' },
  { name: 'Soporte articular', slug: 'soporte-articular' },
  { name: 'Cuidado urinario', slug: 'cuidado-urinario' },
  { name: 'Digestivo', slug: 'digestivo' },
  { name: 'Control de olor', slug: 'control-olor' },
  { name: 'Hidratacion', slug: 'hidratacion' },
  { name: 'Enriquecimiento', slug: 'enriquecimiento' },
];

const INGREDIENT_SEED = [
  { name: 'Pollo', slug: 'pollo' },
  { name: 'Salmon', slug: 'salmon' },
  { name: 'Cordero', slug: 'cordero' },
  { name: 'Pavo', slug: 'pavo' },
  { name: 'Res', slug: 'res' },
  { name: 'Arroz integral', slug: 'arroz-integral' },
  { name: 'Calabaza', slug: 'calabaza' },
  { name: 'Avena', slug: 'avena' },
  { name: 'Omega 3', slug: 'omega-3' },
  { name: 'Heno', slug: 'heno' },
  { name: 'Alfalfa', slug: 'alfalfa' },
  { name: 'Semillas', slug: 'semillas' },
  { name: 'Mijo', slug: 'mijo' },
  { name: 'Zanahoria', slug: 'zanahoria' },
  { name: 'Camaron', slug: 'camaron' },
  { name: 'Spirulina', slug: 'spirulina' },
  { name: 'Calcio', slug: 'calcio' },
  { name: 'Manzanilla', slug: 'manzanilla' },
  { name: 'Carbon activado', slug: 'carbon-activado' },
  { name: 'Insecto', slug: 'insecto' },
];

const MEMBERSHIP_SEED = [
  {
    name: 'Gratuita',
    slug: 'gratuita',
    price: 0,
    isActive: true,
    description: 'Ideal para empezar y comprar sin costo mensual.',
    features: [
      'Acceso completo a la tienda',
      'Checkout agil para compras rapidas',
      'Soporte estandar por canales digitales',
    ],
  },
  {
    name: 'Premium',
    slug: 'premium',
    price: 75,
    isActive: true,
    description: 'Incluye descuento y atencion prioritaria para ayudarte mas rapido.',
    features: [
      '5% de descuento en productos seleccionados',
      'Atencion prioritaria por WhatsApp',
      'Acceso temprano a lanzamientos y promociones',
    ],
  },
];

const SPECIES_PRODUCT_PROFILES = [
  {
    slug: 'perro',
    label: 'Perro',
    audience: 'perros',
    proteinSources: ['chicken', 'lamb', 'beef'],
    lifeStages: [['cachorro'], ['adulto'], ['senior']],
    weightProfiles: [{ min: 1, max: 10 }, { min: 10, max: 25 }, { min: 25, max: 45 }],
    packs: {
      food: ['2kg', '1.5kg', '3kg'],
      treats: ['120g', '200g', '300g'],
      hygiene: ['300ml', '500ml', '750ml'],
      health: ['60 tabs', '250ml', '90 tabs'],
      accesories: ['Talla S', 'Talla M', 'Talla L'],
      other: ['Kit', 'Set', 'Duo'],
    },
    subcategories: {
      food: ['Seco', 'Humedo', 'Veterinario'],
      treats: ['Dentales', 'Entrenamiento', 'Funcionales'],
      hygiene: ['Shampoo', 'Toallitas', 'Patas'],
      health: ['Articulaciones', 'Digestivo', 'Piel y pelaje'],
      accesories: ['Paseo', 'Camas', 'Juguetes'],
      other: ['Viaje', 'Temporada', 'Organizacion'],
    },
  },
  {
    slug: 'gato',
    label: 'Gato',
    audience: 'gatos',
    proteinSources: ['fish', 'turkey', 'chicken'],
    lifeStages: [['gatito'], ['adulto'], ['senior']],
    weightProfiles: [{ min: 0.5, max: 4 }, { min: 4, max: 7 }, { min: 7, max: 12 }],
    packs: {
      food: ['1.5kg', '400g', '2kg'],
      treats: ['80g', '120g', '150g'],
      hygiene: ['5kg', '8kg', 'Unidad'],
      health: ['60 tabs', '120g', '250ml'],
      accesories: ['Mini', 'Medio', 'Maxi'],
      other: ['Kit', 'Set', 'Pack'],
    },
    subcategories: {
      food: ['Seco', 'Humedo', 'Veterinario'],
      treats: ['Dentales', 'Premios', 'Lickables'],
      hygiene: ['Arena aglomerante', 'Silica', 'Areneros'],
      health: ['Urinario', 'Bolas de pelo', 'Piel y pelaje'],
      accesories: ['Rascadores', 'Torres', 'Fuentes'],
      other: ['Viaje', 'Descanso', 'Organizacion'],
    },
  },
  {
    slug: 'ave',
    label: 'Ave',
    audience: 'aves',
    proteinSources: ['plant', 'mixed', 'insect'],
    lifeStages: [['cachorro'], ['adulto'], ['senior']],
    weightProfiles: [{ min: 0.05, max: 0.2 }, { min: 0.2, max: 0.8 }, { min: 0.8, max: 2.5 }],
    packs: {
      food: ['900g', '1.2kg', '500g'],
      treats: ['70g', '120g', '180g'],
      hygiene: ['250ml', '400g', '300ml'],
      health: ['90g', '60 tabs', '150ml'],
      accesories: ['Mini', 'Medio', 'Maxi'],
      other: ['Kit', 'Set', 'Pack'],
    },
    subcategories: {
      food: ['Semillas', 'Pellets', 'Suplementos'],
      treats: ['Picoteo', 'Entrenamiento', 'Frutas'],
      hygiene: ['Jaula limpia', 'Banos secos', 'Control de plumas'],
      health: ['Calcio', 'Plumaje', 'Digestivo'],
      accesories: ['Jaulas', 'Perchas', 'Juguetes'],
      other: ['Viaje', 'Enriquecimiento', 'Organizacion'],
    },
  },
  {
    slug: 'pez',
    label: 'Pez y acuario',
    audience: 'peces y acuarios',
    proteinSources: ['fish', 'plant', 'mixed'],
    lifeStages: [['cachorro'], ['adulto'], ['senior']],
    weightProfiles: [{ min: 0.01, max: 0.1 }, { min: 0.1, max: 0.5 }, { min: 0.5, max: 5 }],
    packs: {
      food: ['120g', '250g', '500g'],
      treats: ['30g', '60g', '90g'],
      hygiene: ['250ml', '500ml', '750ml'],
      health: ['100ml', '250ml', 'Kit'],
      accesories: ['20L', '60L', '120L'],
      other: ['Kit', 'Set', 'Pack'],
    },
    subcategories: {
      food: ['Agua dulce', 'Tropical', 'Marino'],
      treats: ['Color', 'Crecimiento', 'Weekend'],
      hygiene: ['Cristales', 'Algas', 'Sifonado'],
      health: ['Acondicionadores', 'Bacterias', 'Test kits'],
      accesories: ['Acuarios', 'Filtros', 'Iluminacion'],
      other: ['Decoracion', 'Arranque', 'Mantenimiento'],
    },
  },
  {
    slug: 'reptil',
    label: 'Reptil',
    audience: 'reptiles',
    proteinSources: ['insect', 'plant', 'mixed'],
    lifeStages: [['cachorro'], ['adulto'], ['senior']],
    weightProfiles: [{ min: 0.3, max: 2 }, { min: 2, max: 6 }, { min: 6, max: 20 }],
    packs: {
      food: ['500g', '900g', '1.4kg'],
      treats: ['80g', '140g', '220g'],
      hygiene: ['4kg', '8kg', '500ml'],
      health: ['60g', '120g', '250ml'],
      accesories: ['Small', 'Medium', 'Large'],
      other: ['Kit', 'Set', 'Pack'],
    },
    subcategories: {
      food: ['Feeders', 'Pellets', 'Tortugas'],
      treats: ['Proteico', 'Hidratacion', 'Enriquecimiento'],
      hygiene: ['Sustrato', 'Control de olor', 'Limpieza'],
      health: ['UVB', 'Calcio', 'Hidratacion'],
      accesories: ['Terrarios', 'Calefaccion', 'Refugios'],
      other: ['Monitoreo', 'Viaje', 'Mantenimiento'],
    },
  },
  {
    slug: 'pequena-mascota',
    label: 'Pequena mascota',
    audience: 'pequenas mascotas',
    proteinSources: ['plant', 'mixed', 'insect'],
    lifeStages: [['cachorro'], ['adulto'], ['senior']],
    weightProfiles: [{ min: 0.2, max: 1 }, { min: 1, max: 3 }, { min: 3, max: 8 }],
    packs: {
      food: ['1kg', '1.8kg', '3kg'],
      treats: ['90g', '150g', '220g'],
      hygiene: ['4kg', '8kg', '12kg'],
      health: ['60 tabs', '120ml', '250g'],
      accesories: ['Mini', 'Medio', 'Grande'],
      other: ['Kit', 'Set', 'Pack'],
    },
    subcategories: {
      food: ['Conejos', 'Hamsters', 'Cobayos'],
      treats: ['Crunchy', 'Entrenamiento', 'Fibra'],
      hygiene: ['Viruta', 'Pellets', 'Sustrato'],
      health: ['Digestivo', 'Dental', 'Vitamina C'],
      accesories: ['Jaulas', 'Casas', 'Bebederos'],
      other: ['Enriquecimiento', 'Viaje', 'Organizacion'],
    },
  },
];

const BRAND_MATRIX = {
  perro: {
    food: ['pet-nutri', 'pet-vital', 'pet-nutri'],
    treats: ['pet-nutri', 'paw-care', 'pet-vital'],
    hygiene: ['paw-care', 'paw-care', 'cozy-paws'],
    health: ['pet-vital', 'terra-bloom', 'pet-vital'],
    accesories: ['urban-tail', 'cozy-paws', 'urban-tail'],
    other: ['urban-tail', 'cozy-paws', 'habitat-one'],
  },
  gato: {
    food: ['pet-vital', 'pet-nutri', 'pet-vital'],
    treats: ['pet-vital', 'paw-care', 'pet-nutri'],
    hygiene: ['paw-care', 'paw-care', 'cozy-paws'],
    health: ['pet-vital', 'terra-bloom', 'pet-vital'],
    accesories: ['cozy-paws', 'urban-tail', 'habitat-one'],
    other: ['urban-tail', 'cozy-paws', 'habitat-one'],
  },
  ave: {
    food: ['pet-nutri', 'habitat-one', 'pet-vital'],
    treats: ['pet-nutri', 'habitat-one', 'pet-vital'],
    hygiene: ['paw-care', 'habitat-one', 'terra-bloom'],
    health: ['pet-vital', 'terra-bloom', 'habitat-one'],
    accesories: ['habitat-one', 'cozy-paws', 'urban-tail'],
    other: ['habitat-one', 'urban-tail', 'cozy-paws'],
  },
  pez: {
    food: ['aqua-nova', 'pet-vital', 'aqua-nova'],
    treats: ['aqua-nova', 'pet-nutri', 'aqua-nova'],
    hygiene: ['aqua-nova', 'paw-care', 'aqua-nova'],
    health: ['aqua-nova', 'pet-vital', 'aqua-nova'],
    accesories: ['aqua-nova', 'habitat-one', 'aqua-nova'],
    other: ['aqua-nova', 'habitat-one', 'urban-tail'],
  },
  reptil: {
    food: ['terra-bloom', 'pet-vital', 'terra-bloom'],
    treats: ['terra-bloom', 'pet-nutri', 'terra-bloom'],
    hygiene: ['terra-bloom', 'paw-care', 'terra-bloom'],
    health: ['terra-bloom', 'pet-vital', 'terra-bloom'],
    accesories: ['terra-bloom', 'habitat-one', 'terra-bloom'],
    other: ['terra-bloom', 'urban-tail', 'habitat-one'],
  },
  'pequena-mascota': {
    food: ['pet-nutri', 'pet-vital', 'pet-nutri'],
    treats: ['pet-vital', 'pet-nutri', 'cozy-paws'],
    hygiene: ['paw-care', 'habitat-one', 'paw-care'],
    health: ['pet-vital', 'terra-bloom', 'pet-vital'],
    accesories: ['habitat-one', 'cozy-paws', 'urban-tail'],
    other: ['habitat-one', 'cozy-paws', 'urban-tail'],
  },
};

const PRICE_BASE = {
  food: 62,
  treats: 26,
  hygiene: 38,
  health: 58,
  accesories: 85,
  other: 48,
};

const TITLE_PREFIXES = {
  food: ['Formula', 'Receta', 'Blend'],
  treats: ['Snack', 'Premio', 'Bocado'],
  hygiene: ['Care', 'Fresh', 'Clean'],
  health: ['Support', 'Balance', 'Vital'],
  accesories: ['Home', 'Move', 'Play'],
  other: ['Kit', 'Set', 'Pack'],
};

const PROTEIN_INGREDIENTS = {
  chicken: ['pollo', 'arroz-integral', 'calabaza'],
  beef: ['res', 'zanahoria', 'manzanilla'],
  fish: ['salmon', 'camaron', 'spirulina'],
  lamb: ['cordero', 'avena', 'calabaza'],
  turkey: ['pavo', 'avena', 'calabaza'],
  insect: ['insecto', 'calcio', 'zanahoria'],
  plant: ['heno', 'alfalfa', 'zanahoria'],
  mixed: ['semillas', 'mijo', 'omega-3'],
};

const DIET_MATRIX = {
  perro: { food: ['grain_free', 'high_protein', 'hypoallergenic'], treats: ['low_calorie', 'hypoallergenic', 'high_protein'], hygiene: [], health: ['renal', 'grain_free', 'hypoallergenic'], accesories: [], other: [] },
  gato: { food: ['urinary', 'hypoallergenic', 'grain_free'], treats: ['low_calorie', 'urinary', 'hypoallergenic'], hygiene: [], health: ['urinary', 'renal', 'hypoallergenic'], accesories: [], other: [] },
  ave: { food: ['high_protein', 'grain_free', 'hypoallergenic'], treats: ['low_calorie', 'high_protein', 'hypoallergenic'], hygiene: [], health: ['high_protein', 'renal', 'hypoallergenic'], accesories: [], other: [] },
  pez: { food: ['high_protein', 'grain_free', 'hypoallergenic'], treats: ['high_protein', 'low_calorie', 'hypoallergenic'], hygiene: [], health: ['renal', 'hypoallergenic', 'grain_free'], accesories: [], other: [] },
  reptil: { food: ['high_protein', 'grain_free', 'hypoallergenic'], treats: ['high_protein', 'low_calorie', 'hypoallergenic'], hygiene: [], health: ['renal', 'hypoallergenic', 'grain_free'], accesories: [], other: [] },
  'pequena-mascota': { food: ['grain_free', 'high_protein', 'hypoallergenic'], treats: ['low_calorie', 'high_protein', 'hypoallergenic'], hygiene: [], health: ['renal', 'hypoallergenic', 'grain_free'], accesories: [], other: [] },
};

const HEALTH_MATRIX = {
  perro: { food: ['digestivo', 'piel-pelaje', 'soporte-articular'], treats: ['cuidado-dental', 'enriquecimiento', 'digestivo'], hygiene: ['piel-pelaje', 'control-olor', 'hidratacion'], health: ['soporte-articular', 'digestivo', 'piel-pelaje'], accesories: ['enriquecimiento'], other: ['enriquecimiento'] },
  gato: { food: ['cuidado-urinario', 'piel-pelaje', 'digestivo'], treats: ['cuidado-dental', 'enriquecimiento', 'digestivo'], hygiene: ['control-olor', 'cuidado-urinario', 'piel-pelaje'], health: ['cuidado-urinario', 'digestivo', 'piel-pelaje'], accesories: ['enriquecimiento'], other: ['enriquecimiento'] },
  ave: { food: ['digestivo', 'hidratacion', 'piel-pelaje'], treats: ['enriquecimiento', 'digestivo', 'hidratacion'], hygiene: ['control-olor', 'hidratacion', 'piel-pelaje'], health: ['hidratacion', 'piel-pelaje', 'digestivo'], accesories: ['enriquecimiento'], other: ['enriquecimiento'] },
  pez: { food: ['hidratacion', 'digestivo', 'control-olor'], treats: ['hidratacion', 'enriquecimiento', 'digestivo'], hygiene: ['control-olor', 'hidratacion', 'digestivo'], health: ['hidratacion', 'digestivo', 'control-olor'], accesories: ['enriquecimiento'], other: ['enriquecimiento'] },
  reptil: { food: ['hidratacion', 'digestivo', 'enriquecimiento'], treats: ['hidratacion', 'enriquecimiento', 'digestivo'], hygiene: ['control-olor', 'hidratacion', 'digestivo'], health: ['hidratacion', 'enriquecimiento', 'digestivo'], accesories: ['enriquecimiento'], other: ['enriquecimiento'] },
  'pequena-mascota': { food: ['digestivo', 'cuidado-dental', 'hidratacion'], treats: ['digestivo', 'enriquecimiento', 'cuidado-dental'], hygiene: ['control-olor', 'hidratacion', 'digestivo'], health: ['digestivo', 'cuidado-dental', 'hidratacion'], accesories: ['enriquecimiento'], other: ['enriquecimiento'] },
};

const roundPrice = (value) => Number(value.toFixed(2));

const titleCase = (value) =>
  String(value || '')
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');

const allLifeStagesFor = (profile) => Array.from(new Set(profile.lifeStages.flat()));

const resolveBrandSlug = (profile, category, variantIndex) =>
  BRAND_MATRIX[profile.slug][category][variantIndex % BRAND_MATRIX[profile.slug][category].length];

const resolveDietTags = (profile, category, variantIndex) =>
  (DIET_MATRIX[profile.slug][category] || []).length
    ? [DIET_MATRIX[profile.slug][category][variantIndex % DIET_MATRIX[profile.slug][category].length]]
    : [];

const resolveHealthClaims = (profile, category, variantIndex) =>
  (HEALTH_MATRIX[profile.slug][category] || []).length
    ? [HEALTH_MATRIX[profile.slug][category][variantIndex % HEALTH_MATRIX[profile.slug][category].length]]
    : [];

const resolveIngredients = (category, proteinSource, variantIndex) => {
  if (category === 'accesories' || category === 'other') return [];
  if (category === 'hygiene') return [['avena'], ['carbon-activado'], ['manzanilla']][variantIndex % 3];
  if (category === 'health') return [['omega-3'], ['calcio'], ['manzanilla']][variantIndex % 3];
  const base = PROTEIN_INGREDIENTS[proteinSource] || ['calabaza', 'avena'];
  return category === 'treats' ? base.slice(0, 2) : base;
};

const buildProductName = (profile, category, subcategory, pack, variantIndex) => {
  const prefix = TITLE_PREFIXES[category][variantIndex % TITLE_PREFIXES[category].length];
  if (category === 'other') return `${prefix} ${subcategory} ${profile.label}`;
  return `${prefix} ${subcategory} ${profile.label} ${pack}`.trim();
};

const buildSubtitle = (profile, category, subcategory, variantIndex) => {
  const copy = {
    food: [
      `Nutricion diaria para ${profile.audience}`,
      `Receta funcional de ${subcategory.toLowerCase()} para ${profile.audience}`,
      `Compra guiada por filtros para ${profile.audience}`,
    ],
    treats: [
      `Recompensa ligera para ${profile.audience}`,
      'Apoyo de entrenamiento y enriquecimiento',
      'Snack de prueba para comparar filtros',
    ],
    hygiene: [
      `Mantenimiento frecuente para ${profile.audience}`,
      `Rutina limpia con foco en ${subcategory.toLowerCase()}`,
      'Cuidado practico para el dia a dia',
    ],
    health: [
      `Soporte puntual para ${profile.audience}`,
      'Refuerzo funcional con lectura rapida',
      'Bienestar guiado por objetivo',
    ],
    accesories: [
      `Equipo esencial para ${profile.audience}`,
      'Accesorio pensado para uso continuo',
      'Prueba de catalogo con mas contexto',
    ],
    other: [
      `Complemento flexible para ${profile.audience}`,
      'Pack util para navegar otras soluciones',
      'Cobertura extra para probar facetas',
    ],
  };

  return copy[category][variantIndex % copy[category].length];
};

const buildDescription = (profile, category, subcategory, title) => [
  {
    type: 'paragraph',
    children: [
      {
        type: 'text',
        text: `${title}. Producto de prueba para ${profile.audience} dentro de ${titleCase(category)} y la subcategoria ${subcategory}.`,
      },
    ],
  },
];

const buildSeedProducts = (slugify) => {
  const products = [];

  SPECIES_PRODUCT_PROFILES.forEach((profile, speciesIndex) => {
    CATEGORY_ORDER.forEach((category, categoryIndex) => {
      profile.subcategories[category].forEach((subcategory, variantIndex) => {
        const pack = profile.packs[category][variantIndex % profile.packs[category].length];
        const proteinSource =
          category === 'food'
            ? profile.proteinSources[variantIndex % profile.proteinSources.length]
            : category === 'treats'
              ? profile.proteinSources[(variantIndex + 1) % profile.proteinSources.length]
              : category === 'health'
                ? (variantIndex === 0 ? 'fish' : profile.proteinSources[variantIndex % profile.proteinSources.length])
                : undefined;
        const weightProfile =
          category === 'hygiene' || category === 'accesories' || category === 'other'
            ? { min: 0, max: 999 }
            : profile.weightProfiles[variantIndex % profile.weightProfiles.length];
        const lifeStages =
          category === 'food' || category === 'treats' || category === 'health'
            ? profile.lifeStages[variantIndex % profile.lifeStages.length]
            : allLifeStagesFor(profile);
        const name = buildProductName(profile, category, subcategory, pack, variantIndex);

        products.push({
          name,
          subtitle: buildSubtitle(profile, category, subcategory, variantIndex),
          description: buildDescription(profile, category, subcategory, name),
          slug: slugify(`${name}-${category}-${variantIndex + 1}`),
          price: roundPrice(PRICE_BASE[category] + speciesIndex * 11 + variantIndex * 9 + categoryIndex * 4 + (category === 'accesories' ? 15 : 0)),
          stock: 24 + speciesIndex * 14 + categoryIndex * 7 + variantIndex * 18,
          isFeatured: variantIndex === 0 && (category === 'food' || category === 'accesories'),
          category,
          subcategory,
          form:
            category === 'food'
              ? (variantIndex === 1 ? 'wet' : 'kibble')
              : category === 'treats'
                ? 'treat'
                : category === 'hygiene'
                  ? 'hygiene'
                  : category === 'health'
                    ? 'supplement'
                    : 'accesory',
          proteinSource,
          brandSlug: resolveBrandSlug(profile, category, variantIndex),
          species: [profile.slug],
          lifeStages,
          dietTags: resolveDietTags(profile, category, variantIndex),
          health: resolveHealthClaims(profile, category, variantIndex),
          ingredients: resolveIngredients(category, proteinSource, variantIndex),
          weightMinKg: weightProfile.min,
          weightMaxKg: weightProfile.max,
        });
      });
    });
  });

  return products;
};

module.exports = {
  BRAND_SEED,
  SPECIE_SEED,
  LIFE_STAGE_SEED,
  DIET_TAG_SEED,
  HEALTH_SEED,
  INGREDIENT_SEED,
  MEMBERSHIP_SEED,
  buildSeedProducts,
};
