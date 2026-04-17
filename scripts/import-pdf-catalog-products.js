const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const path = require('path');
const { createStrapi } = require('@strapi/core');
const {
  SPECIE_SEED,
  LIFE_STAGE_SEED,
  DIET_TAG_SEED,
  HEALTH_SEED,
  INGREDIENT_SEED,
} = require('./seed-storefront-catalog-data');

const PRODUCT_UID = 'api::product.product';
const BRAND_UID = 'api::brand.brand';
const SPECIE_UID = 'api::specie.specie';
const LIFE_STAGE_UID = 'api::life-stage.life-stage';
const DIET_TAG_UID = 'api::diet-tag.diet-tag';
const HEALTH_CONDITION_UID = 'api::health-condition.health-condition';
const INGREDIENT_UID = 'api::ingredient.ingredient';

const DEFAULT_DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');
const DEFAULT_JSON_PATH = path.join(__dirname, 'pdf-product-catalog-data.json');
const PRODUCT_CATEGORY_VALUES = new Set(['food', 'treats', 'hygiene', 'health', 'accesories', 'other']);

const SOURCE_MATCHERS = {
  summitPrice: ['lista de precios con imagen summit 10.pdf', 'summit 10.pdf'],
  summitBrochure: ['productos-summit-grain-free-es.pdf', 'summit-grain-free'],
  generalCatalog: ['sin precio - catalogo general.pdf', 'catalogo general.pdf'],
  mallovet: ['catalogo mallovet 2023 mallo guatemala_comprimido.pdf', 'mallovet 2023'],
  wellco: ['vet2021_esp_compressed.pdf', 'vet2021'],
};

const BASE_DATA_SOURCE_ALLOWLIST = new Set([
  'lista de precios con imagen summit 10.pdf',
  'sin precio - catalogo general.pdf',
]);

const GENERAL_SECTION_PREFIXES = [
  { scope: 'companion', pattern: /^Animales De Compa(?:ñ|n)ia/i },
  { scope: 'production', pattern: /^Animales De Produccion/i },
];

const GENERAL_STOP_WORDS = new Set(['NUEVO PRODUCTO', 'NU', 'D', 'FÓRMULA:', 'DOSIS:', 'FORMA DE USO:']);
const GENERAL_SIZE_PATTERN =
  /\b\d+(?:[.,]\d+)?\s?(?:kg|g|ml|mL|gal|gallon|galon|tabletas?|tabs?|sobres?|sobre|blisters?|jeringa(?:s)?|gotero|frasco|caja|viales?|unidad(?:es)?)\b/i;
const PRODUCT_CHUNK_PATTERN =
  /([A-Za-z0-9+().%/-]+(?:\s+[A-Za-z0-9+().%/-]+){0,12}\s+\d+(?:[.,]\d+)?\s?(?:kg|g|ml|mL|gal|gallon|galon|tabletas?|tabs?|sobres?|sobre|blisters?|jeringa(?:s)?|gotero|frasco|caja|viales?|unidad(?:es)?))/gi;
const TRAILING_PRODUCT_PATTERN = /([A-Z][A-Za-z0-9+().%/-]*(?:\s+[A-Z0-9][A-Za-z0-9+().%/-]*){0,8})$/;

const WELLCO_SPECIES_HEADINGS = new Map([
  ['especies mayores', 'major'],
  ['especies menores', 'minor'],
  ['mascotas', 'pets'],
]);

const WELLCO_CATEGORY_HEADINGS = new Map([
  ['anabolicos', 'Anabolicos'],
  ['pomadas y unguentos', 'Pomadas y ungueentos'],
  ['suplementos minerales', 'Suplementos minerales'],
  ['suplementos vitaminicos', 'Suplementos vitaminicos'],
  ['vampiricida', 'Vampiricida'],
  ['antibioticos', 'Antibioticos'],
  ['antidiarreicos', 'Antidiarreicos'],
  ['antiparasitarios endectocidas', 'Antiparasitarios endectocidas'],
  ['antiparasitarios orales', 'Antiparasitarios orales'],
  ['antiparasitarios externos', 'Antiparasitarios externos'],
  ['antiparasitarios inyectables', 'Antiparasitarios inyectables'],
  ['antiparasitarios externos para bano', 'Antiparasitarios externos para bano'],
  ['antiinflamatorios', 'Antiinflamatorios'],
  ['productos de higiene', 'Productos de higiene'],
  ['desinfectantes y germicidas', 'Desinfectantes y germicidas'],
  ['alimento vitaminado', 'Alimento vitaminado'],
]);

const BRAND_MATCHERS = [
  ['whole choice', 'Whole Choice'],
  ['summit 10', 'Summit 10'],
  ['alebo advanced', 'Alebo Advanced'],
  ['alebo', 'Alebo'],
  ['mr.dog', 'Mr.Dog'],
  ['mr.cat', 'Mr.Cat'],
  ['pet salon', 'Pet Salon'],
  ['lord pets', 'Lord Pets'],
  ['groom star', 'Groom Star'],
  ['fiprokill', 'Fiprokill'],
  ['fulmi traz', 'Fulmi Traz'],
  ['otican', 'Otican'],
  ['vetsalfato', 'Vetsalfato'],
  ['furosivet', 'Furosivet'],
  ['helmivet', 'Helmivet'],
  ['neurovitaminas', 'Neurovitaminas'],
  ['amoxivet', 'Amoxivet'],
  ['ampivet', 'Ampivet'],
  ['sulfavet', 'Sulfavet'],
  ['floxivet plus', 'Floxivet Plus'],
  ['floxivet', 'Floxivet'],
  ['oxivet', 'Oxivet'],
  ['colivet', 'Colivet'],
  ['melovet', 'Melovet'],
  ['dexavet', 'Dexavet'],
  ['hidravet', 'Hidravet'],
  ['cicatrisan', 'Cicatrisan'],
  ['dermiclin', 'DermiClin'],
  ['dermiclin', 'DermiClin'],
  ['clinpet plus', 'Clinpet Plus'],
  ['broximicina', 'Broximicina'],
  ['doximicina', 'Doximicina'],
  ['enromax', 'Enromax'],
  ['florfevet plus', 'Florfevet Plus'],
  ['triple sulfa mallovet', 'Triple Sulfa Mallovet'],
];

const KNOWN_DOG_ONLY_BRANDS = new Set([
  'sabueso',
  'fido',
  'alebo',
  'alebo advanced',
  'lord pets',
  'mr.dog',
]);

const KNOWN_CAT_ONLY_BRANDS = new Set(['bioma', 'mr.cat']);
const KNOWN_DOG_CAT_BRANDS = new Set([
  'furosivet',
  'vetsalfato',
  'helmivet',
  'otican',
  'floxivet',
  'floxivet plus',
  'sulfavet',
  'amoxivet',
  'ampivet',
  'melovet',
  'dexavet',
  'pet salon',
  'groom star',
  'dermiclin',
]);

const loadEnvFile = (filepath) => {
  if (!fsSync.existsSync(filepath)) return;

  const lines = fsSync.readFileSync(filepath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(path.join(process.cwd(), '.env'));

const parseFlag = (name) => process.argv.includes(name);

const parseArgValue = (name, fallback) => {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const nowIso = () => new Date().toISOString();

const cleanWhitespace = (value) =>
  String(value || '')
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .trim();

const normalizeForMatch = (value) =>
  cleanWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const slugify = (input) =>
  String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);

const uniq = (values) => Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));

const isSkuCandidate = (line) => {
  const value = cleanWhitespace(line).replace(/^#/, '').replace(/\s+/g, '');
  return Boolean(value) && /\d/.test(value) && /^[A-Z0-9-]{4,24}$/i.test(value);
};

const loadPdfParse = () => {
  const candidates = [
    'pdf-parse',
    path.join(__dirname, '..', 'node_modules', 'pdf-parse'),
    path.join(__dirname, '..', '..', '_pdf_inspect', 'node_modules', 'pdf-parse'),
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      if (error?.code !== 'MODULE_NOT_FOUND') {
        throw error;
      }
    }
  }

  throw new Error('No se encontro pdf-parse. Instala la dependencia o deja disponible _pdf_inspect/node_modules/pdf-parse.');
};

const resolvePdfPath = async (downloadsDir, patterns) => {
  const normalizedPatterns = uniq((Array.isArray(patterns) ? patterns : [patterns]).map(normalizeForMatch));
  const entries = await fs.readdir(downloadsDir, { withFileTypes: true });

  const match = entries.find((entry) => {
    if (!entry.isFile()) return false;
    const normalizedName = normalizeForMatch(entry.name);
    return normalizedPatterns.some((pattern) => normalizedName === pattern || normalizedName.includes(pattern));
  });

  if (!match) {
    throw new Error(`No se encontro el PDF para: ${normalizedPatterns.join(', ')}`);
  }

  return path.join(downloadsDir, match.name);
};

const readPdfLines = async (pdfParse, pdfPath) => {
  const buffer = await fs.readFile(pdfPath);
  const data = await pdfParse(buffer);
  const normalizedText = data.text
    .replace(/\r/g, ' ')
    .replace(/\u0000/g, ' ')
    .replace(/\n+/g, '\n')
    .replace(/[ \t]+\n/g, '\n');

  return normalizedText
    .split('\n')
    .map((line) => cleanWhitespace(line))
    .filter(Boolean);
};

const createParagraphBlocks = (text) => {
  const clean = cleanWhitespace(text);
  if (!clean) return undefined;

  return [
    {
      type: 'paragraph',
      children: [{ type: 'text', text: clean }],
    },
  ];
};

const extractLastProductChunk = (rawName) => {
  const matches = Array.from(rawName.matchAll(PRODUCT_CHUNK_PATTERN));
  if (matches.length) {
    return cleanWhitespace(matches[matches.length - 1][1]);
  }

  const trailing = rawName.match(TRAILING_PRODUCT_PATTERN);
  return cleanWhitespace(trailing?.[1] || rawName);
};

const deriveBrand = (name) => {
  const displayName = cleanWhitespace(name);
  const normalizedName = normalizeForMatch(displayName);

  for (const [pattern, brand] of BRAND_MATCHERS) {
    if (normalizedName.startsWith(pattern) || normalizedName.includes(` ${pattern} `) || normalizedName.endsWith(` ${pattern}`)) {
      return brand;
    }
  }

  const words = displayName.replace(/[()]/g, '').split(/\s+/).filter(Boolean);
  if (!words.length) return 'Catalogo importado';

  if (words.length >= 2) {
    const second = normalizeForMatch(words[1]);
    if (['advanced', 'plus', 'choice', 'star', 'salon', 'pets', 'dog', 'cat', 'drop'].includes(second)) {
      return cleanWhitespace(`${words[0]} ${words[1]}`);
    }
  }

  return words[0];
};

const inferLifeStages = (text) => {
  const normalized = normalizeForMatch(text);
  const stages = [];

  if (/\b(cachorro|puppy)\b/.test(normalized)) stages.push('cachorro');
  if (/\b(adulto|adult)\b/.test(normalized)) stages.push('adulto');
  if (/\b(senior|geriatr)\b/.test(normalized)) stages.push('senior');
  if (/\b(gatito|kitten)\b/.test(normalized)) stages.push('gatito');

  return uniq(stages);
};

const inferDietTags = (text) => {
  const normalized = normalizeForMatch(text);
  const tags = [];

  if (normalized.includes('grain free') || normalized.includes('sin cereales')) tags.push('grain_free');
  if (normalized.includes('sensitive') || normalized.includes('hipoalergen') || normalized.includes('hypoallergenic')) {
    tags.push('hypoallergenic');
  }
  if (/\b(light|sterilised|sterilized|neutered)\b/.test(normalized)) tags.push('low_calorie');
  if (normalized.includes('urinary')) tags.push('urinary');
  if (normalized.includes('renal')) tags.push('renal');
  if (normalized.includes('high protein') || normalized.includes('alto contenido de proteina')) tags.push('high_protein');

  return uniq(tags);
};

const inferHealthTags = (text, category) => {
  const normalized = normalizeForMatch(text);
  const tags = [];

  if (/\b(dental|dientes)\b/.test(normalized)) tags.push('cuidado-dental');
  if (/\b(piel|pelaje|avena|aloe|antiseborr|antifung)\b/.test(normalized) || category === 'hygiene') tags.push('piel-pelaje');
  if (/\b(olor|fragancia|perfume)\b/.test(normalized)) tags.push('control-olor');
  if (/\b(digest|diarrea|gastro|sucralfato)\b/.test(normalized)) tags.push('digestivo');
  if (/\b(urinari)\b/.test(normalized)) tags.push('cuidado-urinario');
  if (/\b(articul)\b/.test(normalized)) tags.push('soporte-articular');
  if (/\b(hidra|electrolit|suero)\b/.test(normalized)) tags.push('hidratacion');

  return uniq(tags);
};

const inferIngredientTags = (text) => {
  const normalized = normalizeForMatch(text);
  const ingredients = [];

  if (/\b(chicken|pollo)\b/.test(normalized)) ingredients.push('pollo');
  if (/\b(salmon)\b/.test(normalized)) ingredients.push('salmon');
  if (/\b(lamb|cordero)\b/.test(normalized)) ingredients.push('cordero');
  if (/\b(turkey|pavo)\b/.test(normalized)) ingredients.push('pavo');
  if (/\b(beef|res)\b/.test(normalized)) ingredients.push('res');
  if (/\b(arroz|rice)\b/.test(normalized)) ingredients.push('arroz-integral');
  if (/\b(avena|oat)\b/.test(normalized)) ingredients.push('avena');
  if (/\b(omega)\b/.test(normalized)) ingredients.push('omega-3');
  if (/\b(manzanilla)\b/.test(normalized)) ingredients.push('manzanilla');
  if (/\b(insect)\b/.test(normalized)) ingredients.push('insecto');

  return uniq(ingredients);
};

const inferProteinSource = (text) => {
  const normalized = normalizeForMatch(text);

  if (/\b(chicken|pollo)\b/.test(normalized)) return 'chicken';
  if (/\b(beef|res)\b/.test(normalized)) return 'beef';
  if (/\b(salmon|fish|pescado)\b/.test(normalized)) return 'fish';
  if (/\b(lamb|cordero)\b/.test(normalized)) return 'lamb';
  if (/\b(turkey|pavo)\b/.test(normalized)) return 'turkey';
  if (/\b(insect)\b/.test(normalized)) return 'insect';
  if (/\b(plant|vegetal|grains|cereal)\b/.test(normalized)) return 'plant';
  return undefined;
};

const inferWeightRange = (text) => {
  const normalized = normalizeForMatch(text);
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*kg/);
  if (!match) return {};

  return {
    weightMinKg: Number(match[1].replace(',', '.')),
    weightMaxKg: Number(match[2].replace(',', '.')),
  };
};

const inferSpecies = (text, brand, fallback = []) => {
  const normalized = normalizeForMatch(text);
  const species = [];
  const normalizedBrand = normalizeForMatch(brand);

  if (/\b(gato|gatos|cat|felino|felinos|kitten)\b/.test(normalized)) species.push('gato');
  if (/\b(perro|perros|dog|canino|caninos|puppy|cachorro)\b/.test(normalized)) species.push('perro');
  if (/\b(ave|aves|aviar|bird|alpiste)\b/.test(normalized)) species.push('ave');

  if (!species.length && KNOWN_DOG_ONLY_BRANDS.has(normalizedBrand)) species.push('perro');
  if (!species.length && KNOWN_CAT_ONLY_BRANDS.has(normalizedBrand)) species.push('gato');
  if (!species.length && KNOWN_DOG_CAT_BRANDS.has(normalizedBrand)) species.push('perro', 'gato');
  if (!species.length) species.push(...fallback);

  return uniq(species);
};

const resolveCategoryMeta = ({ section = '', name = '', categoryHint = '' }) => {
  const normalizedSection = normalizeForMatch(section);
  const normalizedName = normalizeForMatch(name);
  const normalizedHint = normalizeForMatch(categoryHint);
  const haystack = [normalizedSection, normalizedName, normalizedHint].join(' ');

  if (
    normalizedSection.includes('alimento') ||
    /\b(alimento|whole choice|summit 10|grain free|kitten|puppy|adult dog|adult cat)\b/.test(haystack)
  ) {
    return {
      category: 'food',
      subcategory: /\b(humedo|wet|sobre|lata|pouch)\b/.test(haystack) ? 'Alimento humedo' : 'Alimento seco',
      form: /\b(humedo|wet|sobre|lata|pouch)\b/.test(haystack) ? 'wet' : 'kibble',
    };
  }

  if (normalizedSection.includes('galletitas') || /\b(galletitas|sticks|stick|snack|premio|treat)\b/.test(haystack)) {
    return {
      category: 'treats',
      subcategory: 'Premios',
      form: 'treat',
    };
  }

  if (
    normalizedSection.includes('higiene') ||
    normalizedSection.includes('arena para gatos') ||
    /\b(shampoo|jabon|fragancia|arena para gatos|arena perfumada|bano en seco|quita olores|manchas|talco)\b/.test(haystack)
  ) {
    return {
      category: 'hygiene',
      subcategory: normalizedSection.includes('arena para gatos') || normalizedName.includes('arena para gatos')
        ? 'Arena para gatos'
        : 'Cuidado e higiene',
      form: 'hygiene',
    };
  }

  return {
    category: PRODUCT_CATEGORY_VALUES.has(categoryHint) ? categoryHint : 'health',
    subcategory:
      normalizedSection.includes('antibiot') ? 'Antibioticos' :
      normalizedSection.includes('antidiarre') ? 'Digestivos' :
      normalizedSection.includes('antiinflam') ? 'Analgesicos y antiinflamatorios' :
      normalizedSection.includes('dermatolog') || normalizedSection.includes('pomadas') ? 'Dermatologicos' :
      normalizedSection.includes('suplementos') || normalizedSection.includes('anabolicos') ? 'Vitaminas y suplementos' :
      'Soporte veterinario',
    form: 'supplement',
  };
};

const normalizeImportedProduct = (product) => {
  const name = cleanWhitespace(product.name);
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const firstVariant = variants[0] || {};
  const price = Number(product.price ?? firstVariant.price ?? 0);
  const compareAtPrice = product.compareAtPrice ?? firstVariant.compareAtPrice ?? null;
  const stock = Number(product.stock ?? firstVariant.stock ?? 0);
  const categoryMeta = resolveCategoryMeta({
    section: product.section || product.subcategory || '',
    name,
    categoryHint: product.category || '',
  });
  const brand = cleanWhitespace(product.brand || deriveBrand(name));
  const mergedText = [name, product.section, product.subcategory, product.sourcePdf].filter(Boolean).join(' ');
  const published = Boolean(product.published ?? price > 0);

  return {
    name,
    slug: cleanWhitespace(product.slug || slugify(name)),
    description: product.description || createParagraphBlocks(product.summary || `Importado desde ${product.sourcePdf || 'catalogo PDF'}.`),
    price: Number.isFinite(price) ? price : 0,
    compareAtPrice: Number.isFinite(Number(compareAtPrice)) ? Number(compareAtPrice) : null,
    sku: cleanWhitespace(product.sku || firstVariant.sku || ''),
    stock: Number.isFinite(stock) ? stock : 0,
    variants,
    published,
    brand,
    category: categoryMeta.category,
    subcategory: cleanWhitespace(product.subcategory || categoryMeta.subcategory),
    form: product.form || categoryMeta.form,
    proteinSource: product.proteinSource || inferProteinSource(mergedText),
    species: uniq([...(product.species || []), ...inferSpecies(mergedText, brand)]),
    lifeStages: uniq([...(product.lifeStages || []), ...inferLifeStages(mergedText)]),
    dietTags: uniq([...(product.dietTags || []), ...inferDietTags(mergedText)]),
    health: uniq([...(product.health || []), ...inferHealthTags(mergedText, categoryMeta.category)]),
    ingredients: uniq([...(product.ingredients || []), ...inferIngredientTags(mergedText)]),
    weightMinKg: product.weightMinKg,
    weightMaxKg: product.weightMaxKg,
    sourcePdf: product.sourcePdf || null,
  };
};

const extractGeneralBlocks = (lines) => {
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const prefix = GENERAL_SECTION_PREFIXES.find(({ pattern }) => pattern.test(line));
    if (prefix) {
      const section = cleanWhitespace(line.replace(prefix.pattern, ''));
      current = { scope: prefix.scope, section, lines: [line] };
      blocks.push(current);
      continue;
    }

    if (current) current.lines.push(line);
  }

  return blocks;
};

const isGeneralNarrativeLine = (line) =>
  line.length > 92 || (line.match(/[a-záéíóúñ]+/g) || []).length > 10 || /Vehiculo|Excipientes|Administrar|tratamiento|mecanismo de accion/i.test(line);

const cleanupGeneralProductName = (rawName) => {
  const stripped = cleanWhitespace(rawName)
    .replace(/Animales De Compa(?:ñ|n)ia/gi, ' ')
    .replace(/Animales De Produccion/gi, ' ')
    .replace(/\b(?:Cosmetico|Dermatologico|Desparasitante|Antibiotico|Antimicotico|Multivitaminico|Suero|Medicamentos?)\b/gi, ' ')
    .replace(/\bF[ÓO]RMULA\b:?/gi, ' ')
    .replace(/\bDOSIS\b:?/gi, ' ');

  const chunk = extractLastProductChunk(stripped)
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/^peso de\s+/i, '')
    .replace(/\bShampo\b/gi, 'Shampoo')
    .replace(/\bAloe Vera(\d)/i, 'Aloe Vera $1');

  return cleanWhitespace(chunk);
};

const extractGeneralProductName = (blockLines, codeIndex) => {
  let anchor = -1;

  for (let index = codeIndex - 1; index >= Math.max(1, codeIndex - 6); index -= 1) {
    const line = blockLines[index];
    if (GENERAL_STOP_WORDS.has(line) || isSkuCandidate(line)) break;
    if (GENERAL_SIZE_PATTERN.test(line) && !isGeneralNarrativeLine(line)) {
      anchor = index;
      break;
    }
  }

  if (anchor < 0) {
    for (let index = codeIndex - 1; index >= Math.max(1, codeIndex - 4); index -= 1) {
      const line = blockLines[index];
      if (GENERAL_STOP_WORDS.has(line) || isSkuCandidate(line)) break;
      if (!isGeneralNarrativeLine(line)) {
        anchor = index;
        break;
      }
    }
  }

  if (anchor < 0) return '';

  const picked = [blockLines[anchor]];
  for (let index = anchor - 1; index >= Math.max(1, anchor - 2); index -= 1) {
    const line = blockLines[index];
    if (GENERAL_STOP_WORDS.has(line) || isSkuCandidate(line) || isGeneralNarrativeLine(line)) break;
    picked.unshift(line);
  }

  return cleanupGeneralProductName(picked.join(' '));
};

const parseGeneralCatalogPdf = async (pdfParse, pdfPath) => {
  const lines = await readPdfLines(pdfParse, pdfPath);
  const blocks = extractGeneralBlocks(lines);
  const products = [];

  for (const block of blocks) {
    if (block.scope !== 'companion') continue;

    for (let index = 1; index < block.lines.length; index += 1) {
      const line = block.lines[index];
      if (!isSkuCandidate(line)) continue;

      const name = extractGeneralProductName(block.lines, index);
      if (!name || name.length < 4) continue;

      const sku = cleanWhitespace(line.replace(/^#/, '')).replace(/\s+/g, '');
      const section = block.section || '';
      const descriptionWindow = block.lines.slice(index + 1, Math.min(block.lines.length, index + 8)).join(' ');
      const brand = deriveBrand(name);
      const categoryMeta = resolveCategoryMeta({ section, name });
      const species = inferSpecies([section, name, descriptionWindow].join(' '), brand);
      const weightRange = inferWeightRange(name);

      products.push(
        normalizeImportedProduct({
          sourcePdf: path.basename(pdfPath),
          name,
          sku,
          published: false,
          price: 0,
          stock: 0,
          brand,
          section,
          category: categoryMeta.category,
          subcategory: categoryMeta.subcategory,
          form: categoryMeta.form,
          species,
          weightMinKg: weightRange.weightMinKg,
          weightMaxKg: weightRange.weightMaxKg,
        })
      );
    }
  }

  return products;
};

const parseWellcoIndexPdf = async (pdfParse, pdfPath) => {
  const lines = await readPdfLines(pdfParse, pdfPath);
  const products = [];
  const startIndex = lines.findIndex((line) => normalizeForMatch(line) === 'especies mayores');
  const indexLines = startIndex >= 0 ? lines.slice(startIndex, startIndex + 360) : [];
  let currentSpecies = '';
  let currentCategory = '';

  for (const line of indexLines) {
    const normalizedLine = normalizeForMatch(line);
    if (!normalizedLine || /^\d+$/.test(normalizedLine) || normalizedLine.includes('indice interactivo')) continue;

    if (WELLCO_SPECIES_HEADINGS.has(normalizedLine)) {
      currentSpecies = WELLCO_SPECIES_HEADINGS.get(normalizedLine);
      currentCategory = '';
      continue;
    }

    if (WELLCO_CATEGORY_HEADINGS.has(normalizedLine)) {
      currentCategory = WELLCO_CATEGORY_HEADINGS.get(normalizedLine);
      continue;
    }

    if (/^linea veterinaria /.test(normalizedLine) || normalizedLine.includes('selecciona titulo')) {
      currentCategory = '';
      continue;
    }

    if (!currentCategory) continue;

    const isPetRelevant =
      currentSpecies === 'minor' ||
      currentSpecies === 'pets' ||
      normalizedLine.includes('aves') ||
      normalizedLine.includes('alpiste') ||
      normalizeForMatch(currentCategory).includes('alimento vitaminado');

    if (!isPetRelevant) continue;

    if (line.length <= 3 && products.length) {
      products[products.length - 1].name = cleanWhitespace(`${products[products.length - 1].name} ${line}`);
      continue;
    }

    if (
      /^[\-•(]/.test(line) ||
      /:/.test(line) ||
      line.length > 58 ||
      /^(administrar|precauciones|tratamiento|via|aplique|cada|para|bovinos|equinos|ovinos|caprinos|porcinos|lechones|el|la|los|las)\b/i.test(line) ||
      ['animales', 'granja', 'estas viendo', 'seccion de', 'e 500', 'antiparasitario', 'endectabolico de larga accion'].includes(
        normalizedLine
      )
    ) {
      continue;
    }

    const brand = deriveBrand(line);
    const fallbackSpecies =
      currentSpecies === 'minor' || currentSpecies === 'pets' ? ['perro', 'gato'] :
      normalizedLine.includes('aves') || normalizedLine.includes('alpiste') ? ['ave'] :
      [];

    const categoryMeta = resolveCategoryMeta({ section: currentCategory, name: line, categoryHint: currentCategory });

    products.push(
      normalizeImportedProduct({
        sourcePdf: path.basename(pdfPath),
        name: line,
        published: false,
        price: 0,
        stock: 0,
        brand,
        section: currentCategory,
        category: categoryMeta.category,
        subcategory: categoryMeta.subcategory,
        form: categoryMeta.form,
        species: inferSpecies([currentCategory, line].join(' '), brand, fallbackSpecies),
      })
    );
  }

  return products;
};

const parseMallovetPdf = async (pdfParse, pdfPath) => {
  const lines = (await readPdfLines(pdfParse, pdfPath))
    .map((line) => cleanWhitespace(line))
    .filter((line) => line.length >= 4 && !/^\d+$/.test(line));

  const seen = new Set();
  const products = [];

  for (const line of lines) {
    const normalizedLine = normalizeForMatch(line);
    if (seen.has(normalizedLine)) continue;
    seen.add(normalizedLine);

    products.push(
      normalizeImportedProduct({
        sourcePdf: path.basename(pdfPath),
        name: line,
        published: false,
        price: 0,
        stock: 0,
        brand: deriveBrand(line),
        section: 'Antibioticos',
        category: 'health',
        subcategory: 'Antibioticos',
        form: 'supplement',
        species: ['perro', 'gato'],
      })
    );
  }

  return products;
};

const loadExistingCatalogData = async (jsonPath) => {
  try {
    const raw = await fs.readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    const products = Array.isArray(parsed?.products)
      ? parsed.products
          .filter((product) => {
            if (!product?.sourcePdf) return true;
            return BASE_DATA_SOURCE_ALLOWLIST.has(normalizeForMatch(product.sourcePdf));
          })
          .map(normalizeImportedProduct)
      : [];
    return { products };
  } catch (error) {
    if (error?.code === 'ENOENT') return { products: [] };
    throw error;
  }
};

const buildSeenSkuSet = (products) => {
  const seen = new Set();

  for (const product of products) {
    if (product.sku) seen.add(product.sku);
    for (const variant of product.variants || []) {
      if (variant?.sku) seen.add(cleanWhitespace(variant.sku));
    }
  }

  return seen;
};

const mergeProducts = (baseProducts, incomingProducts) => {
  const merged = [...baseProducts];
  const seenSlugs = new Map(merged.map((product, index) => [product.slug, index]));
  const seenSkus = buildSeenSkuSet(merged);

  for (const rawProduct of incomingProducts) {
    const product = normalizeImportedProduct(rawProduct);
    if (product.sku && seenSkus.has(product.sku)) continue;

    const existingIndex = seenSlugs.get(product.slug);
    if (typeof existingIndex === 'number') {
      const existing = merged[existingIndex];
      merged[existingIndex] = normalizeImportedProduct({
        ...existing,
        ...product,
        published: existing.published || product.published,
        price: existing.price || product.price,
        stock: existing.stock || product.stock,
        dietTags: uniq([...(existing.dietTags || []), ...(product.dietTags || [])]),
        health: uniq([...(existing.health || []), ...(product.health || [])]),
        ingredients: uniq([...(existing.ingredients || []), ...(product.ingredients || [])]),
        lifeStages: uniq([...(existing.lifeStages || []), ...(product.lifeStages || [])]),
        species: uniq([...(existing.species || []), ...(product.species || [])]),
      });
      if (product.sku) seenSkus.add(product.sku);
      continue;
    }

    merged.push(product);
    seenSlugs.set(product.slug, merged.length - 1);
    if (product.sku) seenSkus.add(product.sku);
  }

  return merged;
};

const enrichSummitProducts = (products) =>
  products.map((product) => {
    const normalizedBrand = normalizeForMatch(product.brand);
    if (!normalizedBrand.includes('summit') && !normalizedBrand.includes('whole choice')) return product;

    return normalizeImportedProduct({
      ...product,
      dietTags: uniq([...(product.dietTags || []), ...inferDietTags(product.name)]),
      lifeStages: uniq([...(product.lifeStages || []), ...inferLifeStages(product.name)]),
      health: uniq([...(product.health || []), ...inferHealthTags(product.name, product.category)]),
      ingredients: uniq([...(product.ingredients || []), ...inferIngredientTags(product.name)]),
      proteinSource: product.proteinSource || inferProteinSource(product.name),
    });
  });

const buildCatalogDataset = async ({ downloadsDir, jsonPath }) => {
  const pdfParse = loadPdfParse();
  const baseData = await loadExistingCatalogData(jsonPath);

  const generalCatalogPath = await resolvePdfPath(downloadsDir, SOURCE_MATCHERS.generalCatalog);
  const mallovetPath = await resolvePdfPath(downloadsDir, SOURCE_MATCHERS.mallovet);
  const wellcoPath = await resolvePdfPath(downloadsDir, SOURCE_MATCHERS.wellco);

  const [generalProducts, mallovetProducts, wellcoProducts] = await Promise.all([
    parseGeneralCatalogPdf(pdfParse, generalCatalogPath),
    parseMallovetPdf(pdfParse, mallovetPath),
    parseWellcoIndexPdf(pdfParse, wellcoPath),
  ]);

  const enrichedBase = enrichSummitProducts(baseData.products);
  const merged = mergeProducts(enrichedBase, [...generalProducts, ...mallovetProducts, ...wellcoProducts]);

  return {
    products: merged.sort((left, right) => {
      const bySource = cleanWhitespace(left.sourcePdf || '').localeCompare(cleanWhitespace(right.sourcePdf || ''), 'es');
      if (bySource !== 0) return bySource;
      return left.name.localeCompare(right.name, 'es');
    }),
  };
};

const ensureEntryBySlug = async (strapi, uid, inputData) => {
  const slug = inputData.slug || slugify(inputData.name);
  const existing = await strapi.db.query(uid).findOne({ where: { slug } });
  const data = {
    ...inputData,
    slug,
    publishedAt: inputData.publishedAt || nowIso(),
  };

  if (existing) {
    await strapi.db.query(uid).update({
      where: { id: existing.id },
      data: {
        ...data,
        publishedAt: existing.publishedAt || data.publishedAt,
      },
    });

    return { id: existing.id, slug, action: 'updated' };
  }

  const created = await strapi.db.query(uid).create({ data });
  return { id: created.id, slug, action: 'created' };
};

const ensureCatalogMap = async (strapi, uid, entries) => {
  const map = {};
  for (const entry of entries) {
    const result = await ensureEntryBySlug(strapi, uid, entry);
    map[result.slug] = result.id;
  }
  return map;
};

const ensureProduct = async (strapi, productData, published) => {
  const existing = await strapi.db.query(PRODUCT_UID).findOne({
    where: { slug: productData.slug },
  });

  const data = {
    ...productData,
    publishedAt: published ? existing?.publishedAt || nowIso() : null,
  };

  if (existing) {
    await strapi.db.query(PRODUCT_UID).update({
      where: { id: existing.id },
      data,
    });
    return { id: existing.id, action: 'updated' };
  }

  const created = await strapi.db.query(PRODUCT_UID).create({ data });
  return { id: created.id, action: 'created' };
};

const importCatalogDataset = async ({ dataset, jsonPath, skipImport }) => {
  await fs.writeFile(jsonPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');

  if (skipImport) {
    return {
      imported: false,
      created: 0,
      updated: 0,
      totalProducts: dataset.products.length,
      publishedProducts: dataset.products.filter((product) => product.published).length,
    };
  }

  const strapi = createStrapi({
    appDir: process.cwd(),
    distDir: path.join(process.cwd(), 'dist'),
  });

  try {
    await strapi.load();

    const brandSeed = uniq(dataset.products.map((product) => product.brand))
      .filter(Boolean)
      .map((brand) => ({ name: brand, slug: slugify(brand), isActive: true }));

    const brandMap = await ensureCatalogMap(strapi, BRAND_UID, brandSeed);
    const specieMap = await ensureCatalogMap(strapi, SPECIE_UID, SPECIE_SEED);
    const lifeStageMap = await ensureCatalogMap(strapi, LIFE_STAGE_UID, LIFE_STAGE_SEED);
    const dietTagMap = await ensureCatalogMap(strapi, DIET_TAG_UID, DIET_TAG_SEED);
    const healthMap = await ensureCatalogMap(strapi, HEALTH_CONDITION_UID, HEALTH_SEED);
    const ingredientMap = await ensureCatalogMap(strapi, INGREDIENT_UID, INGREDIENT_SEED);

    const counter = { created: 0, updated: 0 };

    for (let index = 0; index < dataset.products.length; index += 1) {
      const product = dataset.products[index];
      const prepared = {
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        sku: product.sku || null,
        stock: product.stock,
        variants: product.variants || [],
        category: product.category,
        subcategory: product.subcategory,
        form: product.form,
        proteinSource: product.proteinSource,
        weightMinKg: product.weightMinKg ?? 0,
        weightMaxKg: product.weightMaxKg ?? 999,
        brand: brandMap[slugify(product.brand)] || null,
        speciesSupported: (product.species || []).map((slug) => specieMap[slug]).filter(Boolean),
        lifeStages: (product.lifeStages || []).map((slug) => lifeStageMap[slug]).filter(Boolean),
        diet_tags: (product.dietTags || []).map((slug) => dietTagMap[slug]).filter(Boolean),
        health_claims: (product.health || []).map((slug) => healthMap[slug]).filter(Boolean),
        ingredients: (product.ingredients || []).map((slug) => ingredientMap[slug]).filter(Boolean),
      };

      const saved = await ensureProduct(strapi, prepared, product.published);
      counter[saved.action] += 1;

      if ((index + 1) % 25 === 0 || index === dataset.products.length - 1) {
        console.log(`- Upsert ${index + 1}/${dataset.products.length}`);
      }
    }

    const totalProducts = await strapi.db.query(PRODUCT_UID).count();
    const publishedProducts = await strapi.db.query(PRODUCT_UID).count({
      where: { publishedAt: { $notNull: true } },
    });

    return {
      imported: true,
      ...counter,
      totalProducts,
      publishedProducts,
    };
  } finally {
    try {
      await strapi.destroy();
    } catch (error) {
      console.warn('No se pudo cerrar Strapi de forma limpia, pero la importacion ya termino.', error?.message || error);
    }
  }
};

const main = async () => {
  const downloadsDir = parseArgValue('--downloads-dir', DEFAULT_DOWNLOADS_DIR);
  const jsonPath = parseArgValue('--json-path', DEFAULT_JSON_PATH);
  const skipImport = parseFlag('--skip-import');

  const dataset = await buildCatalogDataset({ downloadsDir, jsonPath });
  const result = await importCatalogDataset({ dataset, jsonPath, skipImport });

  const summaryBySource = dataset.products.reduce((accumulator, product) => {
    const source = product.sourcePdf || 'Sin fuente';
    accumulator[source] = (accumulator[source] || 0) + 1;
    return accumulator;
  }, {});

  console.log('Importacion de catalogo PDF completada');
  console.log(`- Dataset consolidado: ${dataset.products.length} productos`);
  console.log(`- Fuentes: ${JSON.stringify(summaryBySource, null, 2)}`);

  if (result.imported) {
    console.log(`- Creados: ${result.created}`);
    console.log(`- Actualizados: ${result.updated}`);
    console.log(`- Total en Strapi: ${result.totalProducts}`);
    console.log(`- Publicados: ${result.publishedProducts}`);
  } else {
    console.log('- Se omitio la importacion a Strapi por --skip-import');
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error importando catalogos PDF:', error);
    process.exit(1);
  });
