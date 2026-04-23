import crypto from 'crypto';
import { getCatalogTaxonomyPayloadFromDatabase } from '../utils/catalog-taxonomy-db';
import { resolveFilterScopeKeyFromScopeRecord } from '../../filter-scope/utils/catalog-filter-key-map';

const USER_UID = 'plugin::users-permissions.user';
const PRODUCT_UID = 'api::product.product';
const PET_PROFILE_UID = 'api::pet-profile.pet-profile';
const ADDRESS_UID = 'api::adress.adress';
const MEMBERSHIP_UID = 'api::membership.membership';
const SPECIE_UID = 'api::specie.specie';
const LIFE_STAGE_UID = 'api::life-stage.life-stage';
const DIET_TAG_UID = 'api::diet-tag.diet-tag';
const HEALTH_CONDITION_UID = 'api::health-condition.health-condition';
const HEADER_ANNOUNCEMENT_UID = 'api::header-announcement.header-announcement';
const ENVIRONMENT_UID = 'api::environment.environment';
const CART_UID = 'api::cart.cart';
const CART_ITEM_UID = 'api::cart-item.cart-item';
const COUPON_UID = 'api::coupon.coupon';
const ORDER_UID = 'api::order.order';
const ORDER_ITEM_UID = 'api::order-item.order-item';
const ORDER_STATUS_LOG_UID = 'api::order-status-log.order-status-log';
const MEMBERSHIP_LOG_UID = 'api::membership-log.membership-log';

const DEFAULT_CURRENCY = 'GTQ';
const MAX_PAGE_SIZE = 100;
const MAX_DISCOVERY_PRODUCTS = 5000;
const PRODUCT_QUERY_TIMEOUT_MS = 8000;
const QUERY_CACHE_TTL_MS = 5000;
const QUERY_CACHE_MAX_ENTRIES = 300;
const DISCOVERY_CACHE_TTL_MS = 1000 * 60 * 15;
const DEFAULT_LANGUAGE = 'es';
const DEFAULT_TIME_ZONE = 'America/Guatemala';
const FREE_SHIPPING_THRESHOLD = 400;
const STANDARD_SHIPPING_PRICE = 30;
const EXPRESS_SHIPPING_PRICE = 40;
const CART_RECOMMENDATION_LIMIT = 4;
const CART_RECOMMENDATION_CANDIDATE_LIMIT = 40;
const CATEGORY_LABELS: Record<string, string> = {
  food: 'Alimento',
  treats: 'Snacks',
  hygiene: 'Higiene',
  health: 'Salud',
  accesories: 'Accesorios',
  other: 'Otros',
};
const FORM_LABELS: Record<string, string> = {
  kibble: 'Croquetas',
  wet: 'Alimento humedo',
  treat: 'Premio',
  supplement: 'Suplemento',
  accesory: 'Accesorio',
  hygiene: 'Cuidado e higiene',
};
const PROTEIN_SOURCE_LABELS: Record<string, string> = {
  chicken: 'Pollo',
  beef: 'Res',
  fish: 'Pescado',
  lamb: 'Cordero',
  turkey: 'Pavo',
  insect: 'Proteina de insecto',
  plant: 'Proteina vegetal',
  mixed: 'Mezcla proteica',
};

type ShippingMethod = 'standard' | 'express';
type PaymentKind = 'card' | 'bank' | 'cash';

const throwHttpError = (status: number, message: string, details: any = undefined) => {
  const error: any = new Error(message);
  error.status = status;
  error.details = details;
  throw error;
};

const runWithTimeout = <T>(operation: Promise<T>, timeoutMs: number, context: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const timeoutError: any = new Error(`Timed out while ${context}`);
      timeoutError.code = 'QUERY_TIMEOUT';
      reject(timeoutError);
    }, timeoutMs);

    operation
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const isQueryTimeoutError = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && (error as any).code === 'QUERY_TIMEOUT');

const productsQueryCache = new Map<string, { expiresAt: number; payload: any }>();
const facetsQueryCache = new Map<string, { expiresAt: number; payload: any }>();
const discoveryCache = new Map<string, { expiresAt: number; payload: string }>();

const stableSerialize = (input: any): any => {
  if (Array.isArray(input)) {
    return input.map((item) => stableSerialize(item));
  }

  if (!input || typeof input !== 'object') {
    return input;
  }

  return Object.keys(input)
    .sort()
    .reduce((acc, key) => {
      acc[key] = stableSerialize((input as Record<string, any>)[key]);
      return acc;
    }, {} as Record<string, any>);
};

const buildQueryCacheKey = (scope: string, query: any, userId?: number): string =>
  `${scope}|u:${toInt(userId, 0)}|${JSON.stringify(stableSerialize(query || {}))}`;

const getQueryCache = <T>(cache: Map<string, { expiresAt: number; payload: T }>, key: string): T | null => {
  const current = cache.get(key);
  if (!current) return null;
  if (current.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return current.payload;
};

const setQueryCache = <T>(cache: Map<string, { expiresAt: number; payload: T }>, key: string, payload: T): void => {
  if (cache.size >= QUERY_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, {
    expiresAt: Date.now() + QUERY_CACHE_TTL_MS,
    payload,
  });
};

const toNumber = (value: any, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toInt = (value: any, fallback = 0): number => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const normalizePublicUrl = (value: unknown): string =>
  normalizeText(value).replace(/\/+$/g, '');

const resolveOrigin = (value: unknown): string => {
  const normalized = normalizeText(value);
  if (!normalized) return '';

  try {
    return new URL(normalized).origin;
  } catch {
    return '';
  }
};

const joinPublicUrl = (baseUrl: string, path = ''): string => {
  const normalizedBase = normalizePublicUrl(baseUrl);
  const normalizedPath = normalizeText(path);
  if (!normalizedPath) return normalizedBase;
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  if (!normalizedBase) return normalizedPath;
  return normalizedPath.startsWith('/')
    ? `${normalizedBase}${normalizedPath}`
    : `${normalizedBase}/${normalizedPath}`;
};

const escapeXml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toIsoDate = (value: unknown): string => {
  const normalized = normalizeText(value);
  if (!normalized) return '';

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
};

const xmlTag = (tag: string, value: unknown): string => `<${tag}>${escapeXml(value)}</${tag}>`;

const formatFeedPrice = (value: number): string => `${roundMoney(value).toFixed(2)} ${DEFAULT_CURRENCY}`;

const extractRichTextPlainText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => extractRichTextPlainText(item))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const node = value as Record<string, unknown>;
  const parts = [
    typeof node.text === 'string' ? node.text.trim() : '',
    extractRichTextPlainText(node.children),
    extractRichTextPlainText(node.content),
  ];

  if (!parts.some(Boolean)) {
    const fallback = Object.entries(node)
      .filter(([key]) => !['type', 'level', 'format', 'text', 'children', 'content'].includes(key))
      .map(([, nestedValue]) => extractRichTextPlainText(nestedValue))
      .filter(Boolean)
      .join(' ');

    parts.push(fallback);
  }

  return parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeText = (value: any): string => (typeof value === 'string' ? value.trim() : '');

const normalizeSearchText = (value: any): string =>
  normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const SEARCH_TERM_ALIASES: Record<string, string[]> = {
  alimento: ['alimentacion', 'comida', 'food', 'croquetas', 'croqueta', 'nutricion'],
  alimentacion: ['alimento', 'comida', 'food', 'nutricion'],
  comida: ['alimento', 'alimentacion', 'food', 'croquetas', 'croqueta', 'nutricion'],
  food: ['alimento', 'alimentacion', 'comida', 'nutricion'],
  treats: ['treat', 'snack', 'snacks', 'premio', 'premios'],
  treat: ['treats', 'snack', 'snacks', 'premio', 'premios'],
  snack: ['snacks', 'treat', 'treats', 'premio', 'premios'],
  snacks: ['snack', 'treat', 'treats', 'premio', 'premios'],
  premio: ['premios', 'snack', 'snacks', 'treat', 'treats'],
  premios: ['premio', 'snack', 'snacks', 'treat', 'treats'],
  salud: ['health', 'farmacia', 'bienestar'],
  health: ['salud', 'farmacia', 'bienestar'],
  farmacia: ['salud', 'health', 'bienestar'],
  higiene: ['aseo', 'grooming', 'limpieza', 'hygiene'],
  aseo: ['higiene', 'grooming', 'limpieza', 'hygiene'],
  grooming: ['higiene', 'aseo', 'limpieza', 'hygiene'],
  limpieza: ['higiene', 'aseo', 'grooming', 'hygiene'],
  accesorios: ['accesories', 'accessories', 'equipo', 'suministros'],
  accesories: ['accesorios', 'accessories', 'equipo', 'suministros'],
  accessories: ['accesorios', 'accesories', 'equipo', 'suministros'],
  ropa: ['zapatos', 'calzado', 'vestimenta'],
  zapatos: ['zapato', 'calzado', 'ropa'],
  zapato: ['zapatos', 'calzado', 'ropa'],
  calzado: ['zapato', 'zapatos', 'ropa'],
  perro: ['perros', 'dog', 'dogs', 'canino'],
  perros: ['perro', 'dog', 'dogs', 'canino'],
  dog: ['dogs', 'perro', 'perros', 'canino'],
  dogs: ['dog', 'perro', 'perros', 'canino'],
  gato: ['gatos', 'cat', 'cats', 'felino'],
  gatos: ['gato', 'cat', 'cats', 'felino'],
  cat: ['cats', 'gato', 'gatos', 'felino'],
  cats: ['cat', 'gato', 'gatos', 'felino'],
  caballo: ['caballos', 'horse', 'horses', 'equina', 'equino'],
  caballos: ['caballo', 'horse', 'horses', 'equina', 'equino'],
  horse: ['horses', 'caballo', 'caballos', 'equina', 'equino'],
  horses: ['horse', 'caballo', 'caballos', 'equina', 'equino'],
  ave: ['aves', 'bird', 'birds'],
  aves: ['ave', 'bird', 'birds'],
  bird: ['birds', 'ave', 'aves'],
  birds: ['bird', 'ave', 'aves'],
  reptil: ['reptiles', 'reptile', 'reptiles'],
  reptiles: ['reptil', 'reptile'],
  reptile: ['reptil', 'reptiles'],
  pez: ['peces', 'fish', 'acuario', 'acuarios'],
  peces: ['pez', 'fish', 'acuario', 'acuarios'],
  fish: ['pez', 'peces', 'acuario', 'acuarios'],
  acuario: ['acuarios', 'fish', 'pez', 'peces'],
  acuarios: ['acuario', 'fish', 'pez', 'peces'],
};

const tokenizeSearch = (value: any): string[] =>
  Array.from(
    new Set(
      normalizeSearchText(value)
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
    )
  );

const expandSearchToken = (token: string): string[] => {
  const normalized = normalizeSearchText(token);
  if (!normalized) return [];

  const singular = normalized.endsWith('s') && normalized.length > 3 ? normalized.slice(0, -1) : '';
  const plural = !normalized.endsWith('s') && normalized.length > 2 ? `${normalized}s` : '';
  const aliases = [
    normalized,
    singular,
    plural,
    ...(SEARCH_TERM_ALIASES[normalized] || []),
    ...(singular ? SEARCH_TERM_ALIASES[singular] || [] : []),
  ];

  return Array.from(new Set(aliases.map((item) => normalizeSearchText(item)).filter((item) => item.length >= 2)));
};

const buildSearchFieldConditions = (term: string): any[] => [
  { name: { $containsi: term } },
  { slug: { $containsi: term } },
  { category: { $containsi: term } },
  { subcategory: { $containsi: term } },
  { form: { $containsi: term } },
  { proteinSource: { $containsi: term } },
  { brand: { name: { $containsi: term } } },
  { speciesSupported: { name: { $containsi: term } } },
];

const pickFirstNonEmpty = (values: any[]): string => {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const pickFirstPresentValue = (values: any[]): any => {
  for (const value of values) {
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === 'string' && !value.trim()) {
      continue;
    }

    return value;
  }

  return undefined;
};

const hasOwnField = (payload: any, fields: string[]): boolean =>
  fields.some((field) => Object.prototype.hasOwnProperty.call(payload || {}, field));

const normalizeBooleanInput = (value: any): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'si', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return null;
};

const normalizeDateInput = (value: any): string | null => {
  const raw = normalizeText(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
};

const normalizeDateTimeInput = (value: any): string | null => {
  const raw = normalizeText(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
};

const normalizeSessionKey = (value: any): string => {
  const cleaned = normalizeText(value);
  return cleaned.length > 0 ? cleaned : '';
};

const parseIdList = (value: any): number[] => {
  if (!value) return [];
  const source = Array.isArray(value) ? value : String(value).split(',');
  return source
    .map((item) => toInt(item, 0))
    .filter((item, index, self) => item > 0 && self.indexOf(item) === index);
};

const parseTextList = (value: any): string[] => {
  if (!value) return [];
  const source = Array.isArray(value) ? value : String(value).split(',');
  return source
    .map((item) => normalizeText(item))
    .filter((item, index, self) => item.length > 0 && self.indexOf(item) === index);
};

const parseBool = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const getRelationId = (value: any): number | null => {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value.id) return value.id;
  return null;
};

const isObject = (value: any): boolean => !!value && typeof value === 'object' && !Array.isArray(value);

const toIsoNow = (): string => new Date().toISOString();

const parseSort = (value: any): Record<string, 'asc' | 'desc'> => {
  const fallback: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' };
  const raw = normalizeText(value);
  if (!raw) return fallback;

  const [field, orderRaw] = raw.split(':');
  const allowedFields = new Set(['createdAt', 'updatedAt', 'price', 'name', 'stock']);
  if (!allowedFields.has(field)) return fallback;

  const order = orderRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc';
  return { [field]: order };
};

const serializeProduct = (product: any) => {
  const variants = normalizeProductVariants(product).map((variant) => serializeProductVariant(variant));

  return {
    id: product.id,
    documentId: product.documentId,
    name: product.name,
    slug: product.slug,
    description: product.description,
    sku: normalizeText(product.sku) || null,
    price: getEffectiveProductPrice(product),
    compareAtPrice: getEffectiveProductCompareAtPrice(product),
    stock: getEffectiveProductStock(product),
    variants,
    badge: product.badge || null,
    isFeatured: Boolean(product.isFeatured),
    category: product.category,
    subcategory: normalizeText(product.subcategory) || null,
    form: product.form,
    proteinSource: product.proteinSource,
    weightMinKg: toNumber(product.weightMinKg, 0),
    weightMaxKg: toNumber(product.weightMaxKg, 999),
    publishedAt: product.publishedAt,
    images: product.images || [],
    brand: serializeBrandSummary(product.brand || null),
    speciesSupported: product.speciesSupported || [],
    lifeStages: product.lifeStages || [],
    diet_tags: product.diet_tags || [],
    health_claims: product.health_claims || [],
    ingredients: product.ingredients || [],
    catalogAnimals: (product.catalogAnimals || []).map((a: any) => ({
      id: a.id,
      documentId: a.documentId,
      key: a.key,
      slug: a.slug,
      label: a.label,
    })),
    catalogCategory: product.catalogCategory
      ? {
          id: product.catalogCategory.id,
          documentId: product.catalogCategory.documentId,
          key: product.catalogCategory.key,
          slug: product.catalogCategory.slug,
          label: product.catalogCategory.label,
          level: product.catalogCategory.level,
          legacyCategory: product.catalogCategory.legacyCategory || null,
        }
      : null,
    characteristics: product.characteristics || null,
    benefits: product.benefits || null,
  };
};

const serializeProductCompact = (product: any) => {
  const variants = normalizeProductVariants(product).map((variant) => serializeProductVariant(variant));

  return {
    id: product.id,
    documentId: product.documentId,
    name: product.name,
    slug: product.slug,
    sku: normalizeText(product.sku) || null,
    price: getEffectiveProductPrice(product),
    compareAtPrice: getEffectiveProductCompareAtPrice(product),
    stock: getEffectiveProductStock(product),
    variants,
    badge: product.badge || null,
    category: product.category,
    subcategory: normalizeText(product.subcategory) || null,
    publishedAt: product.publishedAt,
    images: product.images || [],
    brand: serializeBrandSummary(product.brand || null),
  };
};

const buildFacetEntries = <T extends Record<string, any>>(
  entries: T[],
  sortField: keyof T
): T[] =>
  [...entries].sort((a, b) => {
    const countDiff = toInt(b.count, 0) - toInt(a.count, 0);
    if (countDiff !== 0) return countDiff;
    return String(a[sortField] || '').localeCompare(String(b[sortField] || ''), 'es');
  });

const collectNamedFacet = (values: Array<string | null | undefined>, labelMap?: Record<string, string>) => {
  const bucket = new Map<string, { value: string; label: string; count: number }>();

  for (const rawValue of values) {
    const value = normalizeText(rawValue);
    if (!value) continue;

    const current = bucket.get(value);
    if (current) {
      current.count += 1;
      continue;
    }

    bucket.set(value, {
      value,
      label: labelMap?.[value] || value,
      count: 1,
    });
  }

  return buildFacetEntries(Array.from(bucket.values()), 'label');
};

const collectTaxonomyFacet = (items: any[] = []) => {
  const bucket = new Map<number, { id: number; documentId?: string; name: string; slug?: string | null; count: number }>();

  for (const rawItem of items) {
    const id = toInt(rawItem?.id, 0);
    const name = normalizeText(rawItem?.name);
    if (id <= 0 || !name) continue;

    const current = bucket.get(id);
    if (current) {
      current.count += 1;
      continue;
    }

    bucket.set(id, {
      id,
      documentId: rawItem?.documentId,
      name,
      slug: normalizeText(rawItem?.slug) || null,
      count: 1,
    });
  }

  return buildFacetEntries(Array.from(bucket.values()), 'name');
};

const collectBrandFacet = (items: any[] = []) => {
  const bucket = new Map<number, { id: number; documentId?: string; name: string; slug?: string | null; logo?: any; count: number }>();

  for (const brand of items) {
    const id = toInt(brand?.id, 0);
    const name = normalizeText(brand?.name);
    if (id <= 0 || !name) continue;

    const current = bucket.get(id);
    if (current) {
      current.count += 1;
      continue;
    }

    bucket.set(id, {
      id,
      documentId: brand?.documentId,
      name,
      slug: normalizeText(brand?.slug) || null,
      logo: brand?.logo || null,
      count: 1,
    });
  }

  return buildFacetEntries(Array.from(bucket.values()), 'name');
};

const buildShippingPolicy = (
  subtotal: number,
  discountTotal: number,
  freeShippingThreshold = FREE_SHIPPING_THRESHOLD
) => {
  const threshold = Math.max(0, roundMoney(toNumber(freeShippingThreshold, FREE_SHIPPING_THRESHOLD)));
  const effectiveSubtotal = roundMoney(Math.max(0, subtotal - discountTotal));
  const amountToFreeShipping = threshold <= 0
    ? 0
    : roundMoney(Math.max(0, threshold - effectiveSubtotal));
  const qualifiesForFreeShipping = threshold <= 0 || amountToFreeShipping <= 0;
  const progressPct = threshold > 0
    ? Math.min(100, Math.round((effectiveSubtotal / threshold) * 100))
    : 100;

  return {
    freeShippingThreshold: threshold,
    qualifiesForFreeShipping,
    amountToFreeShipping,
    progressPct,
  };
};

const resolveShippingMethod = (value: any): ShippingMethod => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized || normalized === 'standard') return 'standard';
  if (normalized === 'express') return 'express';
  throwHttpError(400, 'shippingMethod must be standard or express');
};

const resolvePaymentKind = (value: any): PaymentKind | null => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return null;
  if (normalized === 'card') return 'card';
  if (normalized === 'bank') return 'bank';
  if (normalized === 'cash') return 'cash';
  throwHttpError(400, 'paymentKind must be card, bank or cash');
};

const resolveShippingTotal = (
  subtotal: number,
  discountTotal: number,
  method: ShippingMethod,
  freeShippingThreshold = FREE_SHIPPING_THRESHOLD,
  department?: string
): number => {
  const threshold = Math.max(0, roundMoney(toNumber(freeShippingThreshold, FREE_SHIPPING_THRESHOLD)));
  const effectiveSubtotal = roundMoney(Math.max(0, subtotal - discountTotal));
  if (effectiveSubtotal <= 0) return 0;
  if (method === 'express') return EXPRESS_SHIPPING_PRICE;
  const isCapital = !department || normalizeText(department).toLowerCase() === 'guatemala';
  if (isCapital) {
    return threshold <= 0 || effectiveSubtotal >= threshold ? 0 : STANDARD_SHIPPING_PRICE;
  }
  return Math.round(STANDARD_SHIPPING_PRICE * 0.5);
};

const formatCurrencyLabel = (value: number): string => `Q${roundMoney(value).toFixed(2)}`;

const couponPopulate = {
  eligibleBrands: true,
  eligibleProducts: {
    populate: {
      brand: true,
    },
  },
  fundedByBrand: true,
  influencer: {
    populate: {
      avatar: true,
    },
  },
};

const serializeBrandSummary = (brand: any) =>
  brand
    ? {
        id: brand.id,
        documentId: brand.documentId,
        name: brand.name,
        slug: brand.slug || null,
        logo: serializeMedia(brand.logo || null),
      }
    : null;

const serializeInfluencerSummary = (user: any) =>
  user
    ? {
        id: user.id,
        documentId: user.documentId,
        username: user.username,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username,
        avatar: user.avatar || null,
      }
    : null;

const serializeCouponProductSummary = (product: any) =>
  product
    ? {
        id: product.id,
        documentId: product.documentId,
        name: product.name,
        slug: product.slug || null,
        brand: serializeBrandSummary(product.brand || null),
      }
    : null;

const resolveCouponScope = (coupon: any): 'global' | 'brand' | 'product' | 'mixed' => {
  const hasBrands = Array.isArray(coupon?.eligibleBrands) && coupon.eligibleBrands.length > 0;
  const hasProducts = Array.isArray(coupon?.eligibleProducts) && coupon.eligibleProducts.length > 0;

  if (hasBrands && hasProducts) return 'mixed';
  if (hasProducts) return 'product';
  if (hasBrands) return 'brand';
  return 'global';
};

const getCouponScopeLabel = (scope: 'global' | 'brand' | 'product' | 'mixed'): string => {
  if (scope === 'brand') return ' en marcas seleccionadas';
  if (scope === 'product') return ' en productos seleccionados';
  if (scope === 'mixed') return ' en productos y marcas seleccionadas';
  return '';
};

const getCartItemLineTotal = (item: any): number => {
  const storedLineTotal = toNumber(item?.lineTotal, Number.NaN);
  if (Number.isFinite(storedLineTotal)) {
    return roundMoney(Math.max(0, storedLineTotal));
  }

  const qty = Math.max(1, toInt(item?.qty, 1));
  const resolvedVariant = item?.product
    ? resolveProductVariant(item.product, item?.variant, false)
    : null;
  const productPrice = resolvedVariant
    ? toNumber(resolvedVariant.price, toNumber(item?.unitPrice, 0))
    : item?.product
      ? getEffectiveProductPrice(item.product)
      : toNumber(item?.unitPrice, 0);

  return roundMoney(Math.max(0, productPrice) * qty);
};

const getCouponEligibilityContext = (coupon: any, cartItems: any[] = [], subtotal = 0) => {
  const scope = resolveCouponScope(coupon);
  const eligibleBrandIds = new Set(
    (coupon?.eligibleBrands || []).map((brand: any) => getRelationId(brand)).filter((id: any) => Boolean(id))
  );
  const eligibleProductIds = new Set(
    (coupon?.eligibleProducts || [])
      .map((product: any) => getRelationId(product))
      .filter((id: any) => Boolean(id))
  );

  if (scope === 'global') {
    return {
      scope,
      eligibleItems: cartItems || [],
      eligibleSubtotal: roundMoney(Math.max(0, toNumber(subtotal, 0))),
    };
  }

  const eligibleItems = (cartItems || []).filter((item: any) => {
    const productId = getRelationId(item?.product);
    const brandId = getRelationId(item?.product?.brand);
    return eligibleProductIds.has(productId) || eligibleBrandIds.has(brandId);
  });

  const eligibleSubtotal = roundMoney(
    eligibleItems.reduce((sum: number, item: any) => sum + getCartItemLineTotal(item), 0)
  );

  return {
    scope,
    eligibleItems,
    eligibleSubtotal,
  };
};

const resolveAffiliateCommission = (coupon: any, eligibleSubtotal: number) => {
  const type =
    coupon?.affiliateCommissionType === 'fixed'
      ? 'fixed'
      : coupon?.affiliateCommissionType === 'percent'
        ? 'percent'
        : null;
  const value = roundMoney(toNumber(coupon?.affiliateCommissionValue, 0));

  if (!coupon?.influencer || !type || value <= 0 || eligibleSubtotal <= 0) {
    return {
      type,
      value,
      amount: 0,
    };
  }

  const rawAmount = type === 'percent' ? roundMoney((eligibleSubtotal * value) / 100) : roundMoney(value);

  return {
    type,
    value,
    amount: roundMoney(Math.max(0, Math.min(rawAmount, eligibleSubtotal))),
  };
};

const serializeCouponTargets = (coupon: any) => ({
  scope: resolveCouponScope(coupon),
  eligibleBrands: (coupon?.eligibleBrands || []).map((brand: any) => serializeBrandSummary(brand)).filter(Boolean),
  eligibleProducts: (coupon?.eligibleProducts || [])
    .map((product: any) => serializeCouponProductSummary(product))
    .filter(Boolean),
});

const isCouponCurrentlyAvailable = (coupon: any, nowMs: number): boolean => {
  if (!coupon || !coupon.isActive) return false;
  if (!coupon.publishedAt) return false;

  if (coupon.activeFrom) {
    const startsAt = new Date(coupon.activeFrom).getTime();
    if (Number.isFinite(startsAt) && startsAt > nowMs) return false;
  }

  if (coupon.activeTo) {
    const endsAt = new Date(coupon.activeTo).getTime();
    if (Number.isFinite(endsAt) && endsAt < nowMs) return false;
  }

  const usageLimit = toInt(coupon.usageLimit, 0);
  const usageCount = toInt(coupon.usageCount, 0);
  if (usageLimit > 0 && usageCount >= usageLimit) return false;

  return true;
};

const serializePublicCoupon = (coupon: any) => {
  const targets = serializeCouponTargets(coupon);
  const value = roundMoney(toNumber(coupon?.value, 0));
  const type = coupon?.type === 'fixed' ? 'fixed' : 'percent';
  const minSubtotal = roundMoney(toNumber(coupon?.minSubtotal, 0));
  const usageLimit = toInt(coupon?.usageLimit, 0);
  const usageCount = toInt(coupon?.usageCount, 0);
  const discountLabel = type === 'percent' ? `${value}% de descuento` : `${formatCurrencyLabel(value)} de descuento`;
  const minSubtotalLabel =
    minSubtotal > 0 ? ` en compras elegibles desde ${formatCurrencyLabel(minSubtotal)}` : '';
  const scopeLabel = getCouponScopeLabel(targets.scope);

  return {
    id: coupon.id,
    code: coupon.code,
    type,
    value,
    minSubtotal,
    ...targets,
    showInHeaderMarquee: coupon?.showInHeaderMarquee !== false,
    activeFrom: coupon.activeFrom || null,
    activeTo: coupon.activeTo || null,
    usageLimit: usageLimit > 0 ? usageLimit : null,
    usageCount,
    isActive: Boolean(coupon.isActive),
    displayMessage: `Código ${coupon.code}: ${discountLabel}${scopeLabel}${minSubtotalLabel}`,
  };
};

const isHeaderAnnouncementCurrentlyAvailable = (announcement: any, nowMs: number): boolean => {
  if (!announcement || announcement.isActive === false) return false;

  if (announcement.startsAt) {
    const startsAt = new Date(announcement.startsAt).getTime();
    if (Number.isFinite(startsAt) && startsAt > nowMs) return false;
  }

  if (announcement.endsAt) {
    const endsAt = new Date(announcement.endsAt).getTime();
    if (Number.isFinite(endsAt) && endsAt < nowMs) return false;
  }

  return normalizeText(announcement.message).length > 0;
};

const serializeHeaderAnnouncement = (announcement: any) => ({
  id: announcement.id,
  documentId: announcement.documentId || null,
  title: announcement.title || null,
  message: announcement.message || '',
  audience: announcement.audience || 'all',
  startsAt: announcement.startsAt || null,
  endsAt: announcement.endsAt || null,
});

const serializeMedia = (file: any) => {
  if (!file) return null;

  return {
    id: file.id,
    documentId: file.documentId || null,
    url: file.url || '',
    alternativeText: file.alternativeText || null,
    name: file.name || null,
    formats: file.formats || {},
  };
};

const normalizeVariantIdentity = (value: any): string =>
  normalizeSearchText(value).replace(/\s+/g, '-');

const normalizeProductVariants = (product: any): any[] => {
  const rawVariants = Array.isArray(product?.variants) ? product.variants : [];

  const normalized = rawVariants
    .map((rawVariant: any, index: number) => {
      if (!isObject(rawVariant)) return null;

      const label = pickFirstNonEmpty([
        rawVariant.label,
        rawVariant.presentation,
        rawVariant.size,
        rawVariant.name,
      ]) || `Presentacion ${index + 1}`;
      const price = roundMoney(Math.max(0, toNumber(rawVariant.price, toNumber(product?.price, 0))));
      const compareAtPrice = roundMoney(Math.max(0, toNumber(rawVariant.compareAtPrice, 0)));
      const sku = normalizeText(rawVariant.sku) || null;
      const presentation = normalizeText(rawVariant.presentation) || label;
      const size = normalizeText(rawVariant.size) || null;
      const id =
        normalizeVariantIdentity(rawVariant.id || sku || label)
        || `variant-${index + 1}`;

      return {
        id,
        sku,
        label,
        presentation,
        size,
        price,
        compareAtPrice: compareAtPrice > price ? compareAtPrice : null,
        stock: Math.max(0, toInt(rawVariant.stock, 0)),
        isDefault: normalizeBooleanInput(rawVariant.isDefault) === true,
        sortOrder: toInt(rawVariant.sortOrder, index),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return String(a.label || '').localeCompare(String(b.label || ''), 'es');
    });

  if (!normalized.length) return [];

  if (!normalized.some((variant) => variant.isDefault)) {
    normalized[0].isDefault = true;
  }

  return normalized;
};

const serializeProductVariant = (variant: any) => {
  if (!variant) return null;

  return {
    id: variant.id,
    sku: variant.sku || null,
    label: variant.label,
    presentation: variant.presentation || null,
    size: variant.size || null,
    price: roundMoney(toNumber(variant.price, 0)),
    compareAtPrice: roundMoney(toNumber(variant.compareAtPrice, 0)) || null,
    stock: Math.max(0, toInt(variant.stock, 0)),
    isDefault: Boolean(variant.isDefault),
    sortOrder: toInt(variant.sortOrder, 0),
  };
};

const getDefaultProductVariant = (product: any) => {
  const variants = normalizeProductVariants(product);
  return variants.find((variant) => variant.isDefault) || variants[0] || null;
};

const getEffectiveProductPrice = (product: any): number => {
  const defaultVariant = getDefaultProductVariant(product);
  if (defaultVariant) {
    return roundMoney(toNumber(defaultVariant.price, 0));
  }

  return roundMoney(toNumber(product?.price, 0));
};

const getEffectiveProductCompareAtPrice = (product: any): number | null => {
  const effectivePrice = getEffectiveProductPrice(product);
  const defaultVariant = getDefaultProductVariant(product);
  const rawCompareAtPrice = defaultVariant
    ? toNumber(defaultVariant.compareAtPrice, 0)
    : toNumber(product?.compareAtPrice, 0);
  const compareAtPrice = roundMoney(rawCompareAtPrice);

  return compareAtPrice > effectivePrice ? compareAtPrice : null;
};

const getEffectiveProductStock = (product: any): number => {
  const variants = normalizeProductVariants(product);
  if (!variants.length) {
    return Math.max(0, toInt(product?.stock, 0));
  }

  return Math.max(
    0,
    variants.reduce((acc: number, variant: any) => acc + Math.max(0, toInt(variant.stock, 0)), 0)
  );
};

const resolveProductVariant = (product: any, requestedVariant: any, fallbackToDefault = false) => {
  const variants = normalizeProductVariants(product);
  if (!variants.length) return null;

  const requestedId = normalizeVariantIdentity(requestedVariant?.id || '');
  const requestedSku = normalizeText(requestedVariant?.sku).toLowerCase();
  const requestedLabel = normalizeSearchText(
    requestedVariant?.label || requestedVariant?.presentation || requestedVariant?.size || ''
  );

  const matched = variants.find((variant: any) => {
    if (requestedId && variant.id === requestedId) return true;
    if (requestedSku && String(variant.sku || '').toLowerCase() === requestedSku) return true;
    if (requestedLabel) {
      const normalizedLabel = normalizeSearchText(variant.label || '');
      const normalizedPresentation = normalizeSearchText(variant.presentation || '');
      const normalizedSize = normalizeSearchText(variant.size || '');
      return [normalizedLabel, normalizedPresentation, normalizedSize].includes(requestedLabel);
    }

    return false;
  });

  if (matched) return matched;
  if (fallbackToDefault) return getDefaultProductVariant(product);
  return null;
};

const buildVariantSnapshot = (variant: any) => {
  const serialized = serializeProductVariant(variant);
  if (!serialized) return null;

  return {
    id: serialized.id,
    sku: serialized.sku,
    label: serialized.label,
    presentation: serialized.presentation,
    size: serialized.size,
  };
};

const buildVariantIdentityKey = (variant: any): string => {
  if (!variant || !isObject(variant)) {
    return 'base';
  }

  const label = pickFirstNonEmpty([variant.label, variant.presentation, variant.size]);
  return JSON.stringify({
    id: normalizeVariantIdentity(variant.id || ''),
    sku: normalizeText(variant.sku).toLowerCase(),
    label: normalizeSearchText(label),
  });
};

const buildOrderItemNameSnapshot = (product: any, variant: any): string => {
  const productName = normalizeText(product?.name) || 'Producto';
  const variantLabel = normalizeText(variant?.label || variant?.presentation || variant?.size);
  return variantLabel ? `${productName} - ${variantLabel}` : productName;
};

const serializeCart = (cart: any, settings?: { freeShippingThreshold: number }) => ({
  id: cart.id,
  documentId: cart.documentId,
  sessionKey: cart.sessionKey || null,
  currency: cart.currency,
  subtotal: roundMoney(toNumber(cart.subtotal, 0)),
  discountTotal: roundMoney(toNumber(cart.discountTotal, 0)),
  shippingTotal: roundMoney(toNumber(cart.shippingTotal, 0)),
  grandTotal: roundMoney(toNumber(cart.grandTotal, 0)),
  membershipApplied: Boolean(cart.membershipApplied),
  statusCart: cart.statusCart,
  expiresAt: cart.expiresAt,
  shippingPolicy: buildShippingPolicy(
    roundMoney(toNumber(cart.subtotal, 0)),
    roundMoney(toNumber(cart.discountTotal, 0)),
    settings?.freeShippingThreshold
  ),
  coupon: cart.coupon
    ? {
        id: cart.coupon.id,
        code: cart.coupon.code,
        type: cart.coupon.type,
        value: roundMoney(toNumber(cart.coupon.value, 0)),
        ...serializeCouponTargets(cart.coupon),
      }
    : null,
  items: (cart.items || []).map((item: any) => ({
    id: item.id,
    documentId: item.documentId,
    qty: toInt(item.qty, 1),
    unitPrice: roundMoney(toNumber(item.unitPrice, 0)),
    lineTotal: roundMoney(toNumber(item.lineTotal, 0)),
    notes: item.notes || null,
    variant: buildVariantSnapshot(item.variant) || null,
    product: item.product
      ? (() => {
          const selectedVariant = resolveProductVariant(item.product, item.variant, false);
          const currentUnitPrice = roundMoney(
            toNumber(
              item.unitPrice,
              selectedVariant ? toNumber(selectedVariant.price, 0) : getEffectiveProductPrice(item.product)
            )
          );
          const selectedCompareAt = selectedVariant
            ? roundMoney(toNumber(selectedVariant.compareAtPrice, 0))
            : roundMoney(toNumber(getEffectiveProductCompareAtPrice(item.product), 0));
          const compareAtPrice = selectedCompareAt > currentUnitPrice ? selectedCompareAt : null;

          return {
            id: item.product.id,
            documentId: item.product.documentId,
            name: item.product.name,
            slug: item.product.slug,
            price: currentUnitPrice,
            compareAtPrice,
            badge: item.product.badge || null,
            stock: getEffectiveProductStock(item.product),
            category: item.product.category || null,
            subcategory: normalizeText(item.product.subcategory) || null,
            form: normalizeText(item.product.form) || null,
            proteinSource: normalizeText(item.product.proteinSource) || null,
            images: item.product.images || [],
            brand: serializeBrandSummary(item.product.brand || null),
            speciesSupported: item.product.speciesSupported || [],
            catalogAnimals: (item.product.catalogAnimals || []).map((entry: any) => ({
              id: entry.id,
              documentId: entry.documentId,
              key: entry.key,
              slug: entry.slug,
              label: entry.label,
            })),
            catalogCategory: item.product.catalogCategory
              ? {
                  id: item.product.catalogCategory.id,
                  documentId: item.product.catalogCategory.documentId,
                  key: item.product.catalogCategory.key,
                  slug: item.product.catalogCategory.slug,
                  label: item.product.catalogCategory.label,
                  level: item.product.catalogCategory.level,
                  legacyCategory: item.product.catalogCategory.legacyCategory || null,
                }
              : null,
            lifeStages: item.product.lifeStages || [],
            diet_tags: item.product.diet_tags || [],
            health_claims: item.product.health_claims || [],
            ingredients: item.product.ingredients || [],
          };
        })()
      : null,
  })),
});

const serializeOrder = (order: any) => {
  const couponScope = (order.couponScope ||
    (order.coupon ? resolveCouponScope(order.coupon) : null) ||
    (order.couponCode ? 'global' : null)) as 'global' | 'brand' | 'product' | 'mixed' | null;

  return {
    id: order.id,
    documentId: order.documentId,
    orderNumber: order.orderNumber || order.oderNumber,
    email: order.email,
    currency: order.currency,
    subtotal: roundMoney(toNumber(order.subtotal, 0)),
    discountTotal: roundMoney(toNumber(order.discountTotal, 0)),
    shippingTotal: roundMoney(toNumber(order.shippingTotal, 0)),
    taxTotal: roundMoney(toNumber(order.taxTotal, 0)),
    grandTotal: roundMoney(toNumber(order.grandTotal, 0)),
    membershipApplied: Boolean(order.membershipApplied),
    statusOrder: order.statusOrder,
    couponCode: order.couponCode || null,
    couponMeta: order.couponCode
      ? {
          scope: couponScope,
          eligibleSubtotal: roundMoney(toNumber(order.couponEligibleSubtotal, 0)),
          fundedByBrand: serializeBrandSummary(order.couponFundedByBrand || null),
          influencer: serializeInfluencerSummary(order.couponInfluencer || null),
        }
      : null,
    billingAddress: order.billingAddress,
    shippingAddress: order.shippingAddress,
    createdAt: order.createdAt,
    statusLogs: (order.statusLogs || []).map((log: any) => ({
      id: log.id,
      status: log.status,
      note: log.note || null,
      changedBy: log.changedBy || null,
      createdAt: log.createdAt,
    })),
    order_items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      qty: toInt(item.qty, 1),
      unitPrice: roundMoney(toNumber(item.unitPrice, 0)),
      lineTotal: roundMoney(toNumber(item.lineTotal, 0)),
      nameSnapshot: item.nameSnapshot,
      sku: item.sku || null,
      variant: buildVariantSnapshot(item.variant) || null,
      product: item.product
        ? {
            id: item.product.id,
            documentId: item.product.documentId,
            name: item.product.name,
            slug: item.product.slug,
            images: item.product.images || [],
          }
        : null,
    })),
  };
};

const serializeAddress = (address: any) => ({
  id: address.id,
  documentId: address.documentId,
  label: address.label || null,
  isDefault: Boolean(address.isDefault),
  fullName: address.fullName || null,
  phone: address.phone || null,
  country: address.country || null,
  state: address.state || null,
  city: address.city || null,
  postalCode: address.postalCode || null,
  addressLine1: address.addressLine1 || null,
  addressLine2: address.addressLine2 || null,
  reference: address.reference || null,
  createdAt: address.createdAt,
  updatedAt: address.updatedAt,
});

const serializePet = (pet: any) => ({
  id: pet.id,
  documentId: pet.documentId,
  name: pet.name,
  slug: pet.slug,
  breed: pet.breed || null,
  color: pet.color || null,
  avatarHex: pet.avatarHex || null,
  birthdate: pet.birthdate || null,
  weightKg: Number.isFinite(toNumber(pet.weightKg, Number.NaN)) ? toNumber(pet.weightKg, Number.NaN) : null,
  size: pet.size || null,
  sex: pet.sex || null,
  sterilized: typeof pet.sterilized === 'boolean' ? pet.sterilized : null,
  activity: pet.activity || null,
  allergies: Array.isArray(pet.allergies) ? pet.allergies : [],
  notes: pet.notes || null,
  avatar: pet.avatar || null,
  specie: pet.specie || null,
  lifeStage: pet.lifeStage || null,
  dietTags: pet.dietTags || [],
  healthConditions: pet.healthConditions || [],
  catalogAnimal: pet.catalogAnimal
    ? { id: pet.catalogAnimal.id, documentId: pet.catalogAnimal.documentId, key: pet.catalogAnimal.key, slug: pet.catalogAnimal.slug, label: pet.catalogAnimal.label }
    : null,
});

const serializeMembershipPlan = (plan: any) => ({
  id: plan.id,
  documentId: plan.documentId,
  name: plan.name,
  slug: plan.slug || null,
  price: roundMoney(toNumber(plan.price, 0)),
  description: plan.description || null,
  features: Array.isArray(plan.features) ? plan.features : [],
  isActive: plan.isActive !== false,
  publishedAt: plan.publishedAt || null,
});

const serializeUserPreferences = (user: any) => ({
  language: user.preferredLanguage || DEFAULT_LANGUAGE,
  currency: user.preferredCurrency || DEFAULT_CURRENCY,
  timeZone: user.timeZone || DEFAULT_TIME_ZONE,
  notifications: {
    orderUpdates: user.notifyOrderUpdates !== false,
    promotions: user.notifyPromotions !== false,
    newsletter: user.notifyNewsletter !== false,
  },
  twoFactorEnabled: Boolean(user.twoFactorEnabled),
});

const serializeUserProfile = (user: any, stats: { orders: number; pets: number; savedAmount: number }) => ({
  id: user.id,
  documentId: user.documentId,
  username: user.username,
  email: user.email,
  firstName: user.firstName || null,
  lastName: user.lastName || null,
  phone: user.phone || null,
  documentIdNumber: user.documentIdNumber || null,
  birthDate: user.birthDate || null,
  avatar: user.avatar || null,
  fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username,
  membershipTier: user.membershipTier || 'free',
  membershipStartedAt: user.membershipStartedAt || null,
  preferences: serializeUserPreferences(user),
  stats,
});

const evaluateCoupon = (coupon: any, subtotal: number, cartItems: any[] = []) => {
  if (!coupon) {
    return { valid: false, discount: 0, reason: 'Cupón no encontrado' };
  }

  const eligibility = getCouponEligibilityContext(coupon, cartItems, subtotal);
  const now = Date.now();
  if (!coupon.publishedAt) {
    return { valid: false, discount: 0, reason: 'El cupón no está publicado' };
  }

  if (!coupon.isActive) {
    return { valid: false, discount: 0, reason: 'El cupón está inactivo' };
  }

  if (coupon.activeFrom && new Date(coupon.activeFrom).getTime() > now) {
    return { valid: false, discount: 0, reason: 'El cupón todavía no está activo' };
  }

  if (coupon.activeTo && new Date(coupon.activeTo).getTime() < now) {
    return { valid: false, discount: 0, reason: 'El cupón ya venció' };
  }

  const usageLimit = toInt(coupon.usageLimit, 0);
  const usageCount = toInt(coupon.usageCount, 0);
  if (usageLimit > 0 && usageCount >= usageLimit) {
    return { valid: false, discount: 0, reason: 'El cupón alcanzó su límite de uso' };
  }

  if (eligibility.eligibleSubtotal <= 0) {
    return {
      valid: false,
      discount: 0,
      reason:
        eligibility.scope === 'global'
          ? 'El cupón no aplica a este carrito'
          : 'El cupón no aplica a los productos o marcas seleccionados en este carrito',
    };
  }

  const minSubtotal = toNumber(coupon.minSubtotal, 0);
  if (eligibility.eligibleSubtotal < minSubtotal) {
    return {
      valid: false,
      discount: 0,
      reason: `El subtotal mínimo elegible para este cupón es ${minSubtotal}`,
    };
  }

  let discount = 0;
  const value = toNumber(coupon.value, 0);

  if (coupon.type === 'percent') {
    discount = roundMoney((eligibility.eligibleSubtotal * value) / 100);
  } else {
    discount = roundMoney(value);
  }

  discount = Math.min(discount, eligibility.eligibleSubtotal);
  if (discount <= 0) {
    return { valid: false, discount: 0, reason: 'El cupón no aplica a este carrito' };
  }

  return {
    valid: true,
    discount,
    eligibleSubtotal: eligibility.eligibleSubtotal,
    scope: eligibility.scope,
    affiliateCommission: resolveAffiliateCommission(coupon, eligibility.eligibleSubtotal),
  };
};

export default ({ strapi }) => {
  const normalizeFreeShippingThreshold = (value: any): number => {
    const parsed = roundMoney(toNumber(value, FREE_SHIPPING_THRESHOLD));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : FREE_SHIPPING_THRESHOLD;
  };

  const getStorefrontSettings = async () => {
    const environment = await strapi.db.query(ENVIRONMENT_UID).findOne({});

    return {
      freeShippingThreshold: normalizeFreeShippingThreshold(environment?.freeShippingThreshold),
    };
  };

  const getStorefrontSettingsPayload = async () => ({
    data: await getStorefrontSettings(),
  });

  const productRecommendationPopulate = {
    images: true,
    variants: true,
    brand: {
      populate: {
        logo: true,
      },
    },
    speciesSupported: true,
    catalogAnimals: true,
    catalogCategory: true,
    lifeStages: true,
    diet_tags: true,
    health_claims: true,
    ingredients: true,
  };

  const cartPopulate = {
    coupon: {
      populate: couponPopulate,
    },
    items: {
      populate: {
        product: {
          populate: productRecommendationPopulate,
        },
      },
    },
  };

  const orderPopulate = {
    coupon: {
      populate: couponPopulate,
    },
    couponFundedByBrand: true,
    couponInfluencer: {
      populate: {
        avatar: true,
      },
    },
    order_items: {
      populate: {
        product: {
          populate: {
            images: true,
          },
        },
      },
    },
    statusLogs: {
      orderBy: { createdAt: 'asc' },
    },
  };

  const petPopulate = {
    avatar: true,
    specie: true,
    catalogAnimal: true,
    lifeStage: true,
    dietTags: true,
    healthConditions: true,
  };

  const toPetMutationData = (data: any) => {
    const next = { ...data };

    if (Array.isArray(next.dietTags)) {
      next.dietTags = { set: next.dietTags };
    }

    if (Array.isArray(next.healthConditions)) {
      next.healthConditions = { set: next.healthConditions };
    }

    return next;
  };

  const withTrx = (payload: any, trx: any) => (trx ? { ...payload, transacting: trx } : payload);

  const serializeCartWithSettings = async (cart: any) => serializeCart(cart, await getStorefrontSettings());

  const getUserFromAuthorization = async (authorizationHeader: string, required = false) => {
    const normalized = normalizeText(authorizationHeader);
    if (!normalized.toLowerCase().startsWith('bearer ')) {
      if (required) {
        throwHttpError(401, 'Authorization token required');
      }
      return null;
    }

    const token = normalized.slice(7).trim();
    if (!token) {
      if (required) {
        throwHttpError(401, 'Authorization token required');
      }
      return null;
    }

    try {
      const jwtService = strapi.service('plugin::users-permissions.jwt');
      const payload = await jwtService.verify(token);

      if (!payload?.id) {
        if (required) {
          throwHttpError(401, 'Invalid token');
        }
        return null;
      }

      const user = await strapi.db.query(USER_UID).findOne({
        where: { id: payload.id },
      });

      if (!user && required) {
        throwHttpError(401, 'Invalid token user');
      }

      return user;
    } catch (error) {
      if (required) {
        throwHttpError(401, 'Invalid or expired token');
      }
      return null;
    }
  };

  const getCartById = async (cartId: number) => {
    return strapi.db.query(CART_UID).findOne({
      where: { id: cartId },
      populate: cartPopulate,
    });
  };

  const findActiveUserCart = async (userId: number) => {
    return strapi.db.query(CART_UID).findOne({
      where: {
        user: { id: userId },
        statusCart: 'active',
      },
      populate: cartPopulate,
    });
  };

  const findActiveGuestCart = async (sessionKey: string) => {
    return strapi.db.query(CART_UID).findOne({
      where: {
        sessionKey,
        statusCart: 'active',
      },
      populate: cartPopulate,
    });
  };

  const createActiveCart = async ({ userId, sessionKey }: { userId?: number; sessionKey?: string }) => {
    const data: any = {
      currency: DEFAULT_CURRENCY,
      subtotal: 0,
      discountTotal: 0,
      shippingTotal: 0,
      grandTotal: 0,
      membershipApplied: false,
      statusCart: 'active',
    };

    if (userId) {
      data.user = userId;
    } else {
      data.sessionKey = sessionKey || crypto.randomUUID();
    }

    const created = await strapi.db.query(CART_UID).create({ data });
    return {
      ...created,
      user: userId ? { id: userId } : null,
      sessionKey: data.sessionKey || null,
      coupon: null,
      items: [],
    };
  };

  const ensureUserActiveCart = async (userId: number) => {
    let cart = await findActiveUserCart(userId);
    if (!cart) {
      cart = await createActiveCart({ userId });
    }
    return cart;
  };

  const collectCartRecommendationContext = (cart: any) => {
    const productIds = new Set<number>();
    const animalKeys = new Set<string>();
    const specieIds = new Set<number>();
    const categorySlugs = new Set<string>();
    const categories = new Set<string>();
    const subcategories = new Set<string>();
    const lifeStageIds = new Set<number>();
    const dietTagIds = new Set<number>();
    const healthConditionIds = new Set<number>();
    const brandIds = new Set<number>();
    const forms = new Set<string>();
    const proteinSources = new Set<string>();

    for (const item of cart?.items || []) {
      const product = item?.product;
      const productId = toInt(product?.id, 0);
      if (productId > 0) {
        productIds.add(productId);
      }

      for (const animal of product?.catalogAnimals || []) {
        const key = normalizeText(animal?.key);
        if (key) {
          animalKeys.add(key);
        }
      }

      for (const specie of product?.speciesSupported || []) {
        const id = toInt(specie?.id, 0);
        if (id > 0) {
          specieIds.add(id);
        }
      }

      const categorySlug = normalizeText(product?.catalogCategory?.slug);
      if (categorySlug) {
        categorySlugs.add(categorySlug);
      }

      const category = normalizeText(product?.category);
      if (category) {
        categories.add(category);
      }

      const subcategory = normalizeText(product?.subcategory);
      if (subcategory) {
        subcategories.add(subcategory);
      }

      for (const stage of product?.lifeStages || []) {
        const id = toInt(stage?.id, 0);
        if (id > 0) {
          lifeStageIds.add(id);
        }
      }

      for (const tag of product?.diet_tags || []) {
        const id = toInt(tag?.id, 0);
        if (id > 0) {
          dietTagIds.add(id);
        }
      }

      for (const claim of product?.health_claims || []) {
        const id = toInt(claim?.id, 0);
        if (id > 0) {
          healthConditionIds.add(id);
        }
      }

      const brandId = toInt(product?.brand?.id, 0);
      if (brandId > 0) {
        brandIds.add(brandId);
      }

      const form = normalizeText(product?.form);
      if (form) {
        forms.add(form);
      }

      const proteinSource = normalizeText(product?.proteinSource);
      if (proteinSource) {
        proteinSources.add(proteinSource);
      }
    }

    return {
      productIds: Array.from(productIds),
      animalKeys: Array.from(animalKeys),
      specieIds: Array.from(specieIds),
      categorySlugs: Array.from(categorySlugs),
      categories: Array.from(categories),
      subcategories: Array.from(subcategories),
      lifeStageIds: Array.from(lifeStageIds),
      dietTagIds: Array.from(dietTagIds),
      healthConditionIds: Array.from(healthConditionIds),
      brandIds: Array.from(brandIds),
      forms: Array.from(forms),
      proteinSources: Array.from(proteinSources),
      hasAnimalContext: animalKeys.size > 0 || specieIds.size > 0,
    };
  };

  const hasIntersection = (left: Array<string | number>, right: Array<string | number>) =>
    left.some((value) => right.includes(value));

  const matchesCartAnimalContext = (product: any, context: ReturnType<typeof collectCartRecommendationContext>) => {
    if (!context.hasAnimalContext) {
      return true;
    }

    const productAnimalKeys = (product?.catalogAnimals || [])
      .map((entry: any) => normalizeText(entry?.key))
      .filter(Boolean);
    const productSpecieIds = (product?.speciesSupported || [])
      .map((entry: any) => toInt(entry?.id, 0))
      .filter((value: number) => value > 0);

    if (!productAnimalKeys.length && !productSpecieIds.length) {
      return true;
    }

    return hasIntersection(productAnimalKeys, context.animalKeys) || hasIntersection(productSpecieIds, context.specieIds);
  };

  const scoreRecommendedProduct = (product: any, context: ReturnType<typeof collectCartRecommendationContext>) => {
    let score = 0;

    const productAnimalKeys = (product?.catalogAnimals || [])
      .map((entry: any) => normalizeText(entry?.key))
      .filter(Boolean);
    const productSpecieIds = (product?.speciesSupported || [])
      .map((entry: any) => toInt(entry?.id, 0))
      .filter((value: number) => value > 0);
    const productDietTagIds = (product?.diet_tags || [])
      .map((entry: any) => toInt(entry?.id, 0))
      .filter((value: number) => value > 0);
    const productHealthClaimIds = (product?.health_claims || [])
      .map((entry: any) => toInt(entry?.id, 0))
      .filter((value: number) => value > 0);
    const productLifeStageIds = (product?.lifeStages || [])
      .map((entry: any) => toInt(entry?.id, 0))
      .filter((value: number) => value > 0);

    const categorySlug = normalizeText(product?.catalogCategory?.slug);
    const category = normalizeText(product?.category);
    const subcategory = normalizeText(product?.subcategory);
    const form = normalizeText(product?.form);
    const proteinSource = normalizeText(product?.proteinSource);
    const brandId = toInt(product?.brand?.id, 0);

    score += productAnimalKeys.filter((value) => context.animalKeys.includes(value)).length * 90;
    score += productSpecieIds.filter((value) => context.specieIds.includes(value)).length * 80;

    if (categorySlug && context.categorySlugs.includes(categorySlug)) {
      score += 42;
    }

    if (category && context.categories.includes(category)) {
      score += 24;
    }

    if (subcategory && context.subcategories.includes(subcategory)) {
      score += 18;
    }

    score += productLifeStageIds.filter((value) => context.lifeStageIds.includes(value)).length * 12;
    score += productDietTagIds.filter((value) => context.dietTagIds.includes(value)).length * 8;
    score += productHealthClaimIds.filter((value) => context.healthConditionIds.includes(value)).length * 7;

    if (brandId > 0 && context.brandIds.includes(brandId)) {
      score += 10;
    }

    if (form && context.forms.includes(form)) {
      score += 9;
    }

    if (proteinSource && context.proteinSources.includes(proteinSource)) {
      score += 6;
    }

    if (parseBool(product?.isFeatured)) {
      score += 2;
    }

    return score;
  };

  const appendUniqueProducts = (bucket: any[], candidates: any[] = []) => {
    const seen = new Set(bucket.map((entry) => toInt(entry?.id, 0)));

    for (const product of candidates || []) {
      const id = toInt(product?.id, 0);
      if (id <= 0 || seen.has(id)) continue;
      bucket.push(product);
      seen.add(id);
    }
  };

  const listCartRecommendationsPayload = async (cart: any, query: any = {}) => {
    const limit = Math.min(12, Math.max(1, toInt(query?.limit, CART_RECOMMENDATION_LIMIT)));
    const context = collectCartRecommendationContext(cart);

    if (!context.productIds.length) {
      return { data: [] };
    }

    const baseConditions: any[] = [
      { publishedAt: { $notNull: true } },
      { stock: { $gt: 0 } },
      { id: { $notIn: context.productIds } },
    ];

    const relevanceFilters: any[] = [];

    if (context.animalKeys.length > 0) {
      relevanceFilters.push({ catalogAnimals: { key: { $in: context.animalKeys } } });
    }

    if (context.specieIds.length > 0) {
      relevanceFilters.push({ speciesSupported: { id: { $in: context.specieIds } } });
    }

    if (context.categorySlugs.length > 0) {
      relevanceFilters.push({ catalogCategory: { slug: { $in: context.categorySlugs } } });
    }

    if (context.categories.length > 0) {
      relevanceFilters.push({ category: { $in: context.categories } });
    }

    if (context.subcategories.length > 0) {
      relevanceFilters.push({ subcategory: { $in: context.subcategories } });
    }

    if (context.lifeStageIds.length > 0) {
      relevanceFilters.push({ lifeStages: { id: { $in: context.lifeStageIds } } });
    }

    if (context.dietTagIds.length > 0) {
      relevanceFilters.push({ diet_tags: { id: { $in: context.dietTagIds } } });
    }

    if (context.healthConditionIds.length > 0) {
      relevanceFilters.push({ health_claims: { id: { $in: context.healthConditionIds } } });
    }

    if (context.forms.length > 0) {
      relevanceFilters.push({ form: { $in: context.forms } });
    }

    if (context.proteinSources.length > 0) {
      relevanceFilters.push({ proteinSource: { $in: context.proteinSources } });
    }

    const selected: any[] = [];

    if (relevanceFilters.length > 0) {
      const candidates = await strapi.db.query(PRODUCT_UID).findMany({
        where: {
          $and: [...baseConditions, { $or: relevanceFilters }],
        },
        populate: productRecommendationPopulate,
        orderBy: [{ isFeatured: 'desc' }, { updatedAt: 'desc' }],
        limit: CART_RECOMMENDATION_CANDIDATE_LIMIT,
      });

      const ranked = (candidates || [])
        .filter((product: any) => matchesCartAnimalContext(product, context))
        .map((product: any) => ({
          product,
          score: scoreRecommendedProduct(product, context),
        }))
        .filter((entry: any) => entry.score > 0)
        .sort((left: any, right: any) => {
          if (right.score !== left.score) return right.score - left.score;
          return Date.parse(right.product?.updatedAt || right.product?.createdAt || '')
            - Date.parse(left.product?.updatedAt || left.product?.createdAt || '');
        })
        .map((entry: any) => entry.product);

      appendUniqueProducts(selected, ranked);
    }

    if (selected.length < limit) {
      const fallbackAnimalFilters: any[] = [];

      if (context.animalKeys.length > 0) {
        fallbackAnimalFilters.push({ catalogAnimals: { key: { $in: context.animalKeys } } });
      }

      if (context.specieIds.length > 0) {
        fallbackAnimalFilters.push({ speciesSupported: { id: { $in: context.specieIds } } });
      }

      const fallbackWhere =
        fallbackAnimalFilters.length > 0
          ? { $and: [...baseConditions, { $or: fallbackAnimalFilters }] }
          : { $and: baseConditions };

      const fallback = await strapi.db.query(PRODUCT_UID).findMany({
        where: fallbackWhere,
        populate: productRecommendationPopulate,
        orderBy: [{ isFeatured: 'desc' }, { updatedAt: 'desc' }],
        limit: CART_RECOMMENDATION_CANDIDATE_LIMIT,
      });

      appendUniqueProducts(
        selected,
        (fallback || []).filter((product: any) => matchesCartAnimalContext(product, context))
      );
    }

    if (selected.length < limit) {
      const generalFallback = await strapi.db.query(PRODUCT_UID).findMany({
        where: { $and: baseConditions },
        populate: productRecommendationPopulate,
        orderBy: [{ isFeatured: 'desc' }, { updatedAt: 'desc' }],
        limit: CART_RECOMMENDATION_CANDIDATE_LIMIT,
      });

      appendUniqueProducts(
        selected,
        (generalFallback || []).filter((product: any) => matchesCartAnimalContext(product, context))
      );
    }

    return {
      data: selected.slice(0, limit).map((product: any) => serializeProduct(product)),
      meta: {
        count: Math.min(limit, selected.length),
      },
    };
  };

  const ensureGuestActiveCart = async (sessionKeyInput: string) => {
    const sessionKey = normalizeSessionKey(sessionKeyInput) || crypto.randomUUID();
    let cart = await findActiveGuestCart(sessionKey);
    if (!cart) {
      cart = await createActiveCart({ sessionKey });
    }
    return cart;
  };

  const syncCartItemsAndGetSubtotal = async (cart: any) => {
    if (!cart) {
      throwHttpError(404, 'Carrito no encontrado');
    }

    let subtotal = 0;

    for (const item of cart.items || []) {
      const qty = Math.max(1, toInt(item.qty, 1));
      const resolvedVariant = item.product
        ? resolveProductVariant(item.product, item.variant, false)
        : null;
      const normalizedVariant = buildVariantSnapshot(resolvedVariant) || null;
      const productPrice = resolvedVariant
        ? toNumber(resolvedVariant.price, toNumber(item.unitPrice, 0))
        : item.product
          ? getEffectiveProductPrice(item.product)
          : toNumber(item.unitPrice, 0);
      const unitPrice = roundMoney(Math.max(0, productPrice));
      const lineTotal = roundMoney(unitPrice * qty);
      subtotal += lineTotal;

      const storedUnitPrice = roundMoney(toNumber(item.unitPrice, 0));
      const storedLineTotal = roundMoney(toNumber(item.lineTotal, 0));
      const storedVariantKey = buildVariantIdentityKey(item.variant);
      const nextVariantKey = buildVariantIdentityKey(normalizedVariant);

      if (
        storedUnitPrice !== unitPrice
        || storedLineTotal !== lineTotal
        || toInt(item.qty, 1) !== qty
        || storedVariantKey !== nextVariantKey
      ) {
        await strapi.db.query(CART_ITEM_UID).update({
          where: { id: item.id },
          data: {
            qty,
            unitPrice,
            lineTotal,
            variant: normalizedVariant,
          },
        });
      }

      item.qty = qty;
      item.unitPrice = unitPrice;
      item.lineTotal = lineTotal;
      item.variant = normalizedVariant;
    }

    return roundMoney(subtotal);
  };

  const recalculateCartFromState = async (cart: any) => {
    if (!cart) {
      throwHttpError(404, 'Carrito no encontrado');
    }

    const subtotal = await syncCartItemsAndGetSubtotal(cart);
    let discountTotal = 0;
    let couponId = getRelationId(cart.coupon);

    if (cart.coupon) {
      const couponCheck = evaluateCoupon(cart.coupon, subtotal, cart.items || []);
      if (couponCheck.valid) {
        discountTotal = roundMoney(couponCheck.discount);
      } else {
        couponId = null;
      }
    }

    const shippingTotal = 0;
    const grandTotal = roundMoney(Math.max(0, subtotal - discountTotal));
    const currentCouponId = getRelationId(cart.coupon);

    const updateData: any = {
      subtotal,
      discountTotal,
      shippingTotal,
      grandTotal,
    };

    if (couponId === null) {
      updateData.coupon = null;
      cart.coupon = null;
    }

    const shouldUpdateCart =
      roundMoney(toNumber(cart.subtotal, 0)) !== subtotal ||
      roundMoney(toNumber(cart.discountTotal, 0)) !== discountTotal ||
      roundMoney(toNumber(cart.shippingTotal, 0)) !== shippingTotal ||
      roundMoney(toNumber(cart.grandTotal, 0)) !== grandTotal ||
      (couponId === null && currentCouponId !== null);

    if (shouldUpdateCart) {
      await strapi.db.query(CART_UID).update({
        where: { id: cart.id },
        data: updateData,
      });
    }

    cart.subtotal = subtotal;
    cart.discountTotal = discountTotal;
    cart.shippingTotal = shippingTotal;
    cart.grandTotal = grandTotal;

    return serializeCartWithSettings(cart);
  };

  const recalculateCart = async (cartId: number) => {
    const cart = await getCartById(cartId);
    return recalculateCartFromState(cart);
  };

  const addItemToCart = async (cartId: number, payload: any, currentCart: any = null) => {
    const productId = toInt(payload?.productId, 0);
    if (productId <= 0) {
      throwHttpError(400, 'productId is required');
    }

    const qtyToAdd = Math.max(1, toInt(payload?.qty, 1));

    const product = await strapi.db.query(PRODUCT_UID).findOne({
      where: {
        id: productId,
        publishedAt: { $notNull: true },
      },
      populate: {
        ...productRecommendationPopulate,
      },
    });

    if (!product) {
      throwHttpError(404, 'Producto no encontrado o no publicado');
    }

    const cart = currentCart || (await getCartById(cartId));
    if (!cart || cart.statusCart !== 'active') {
      throwHttpError(404, 'Carrito activo no encontrado');
    }

    const requestedVariant = isObject(payload?.variant) ? payload.variant : null;
    const resolvedVariant = resolveProductVariant(product, requestedVariant, true);
    const variant = buildVariantSnapshot(resolvedVariant) || null;
    const notes = normalizeText(payload?.notes);
    const variantKey = buildVariantIdentityKey(variant);

    const existingItem = (cart.items || []).find((item: any) => {
      const itemProductId = getRelationId(item.product);
      return itemProductId === productId && buildVariantIdentityKey(item.variant) === variantKey;
    });

    const currentQty = existingItem ? toInt(existingItem.qty, 1) : 0;
    const targetQty = currentQty + qtyToAdd;
    const availableStock = resolvedVariant
      ? Math.max(0, toInt(resolvedVariant.stock, 0))
      : Math.max(0, toInt(product.stock, 0));

    if (availableStock < targetQty) {
      throwHttpError(400, 'No hay suficiente inventario para la cantidad solicitada');
    }

    const unitPrice = resolvedVariant
      ? roundMoney(toNumber(resolvedVariant.price, 0))
      : getEffectiveProductPrice(product);
    const lineTotal = roundMoney(unitPrice * targetQty);

    if (existingItem) {
      await strapi.db.query(CART_ITEM_UID).update({
        where: { id: existingItem.id },
        data: {
          qty: targetQty,
          unitPrice,
          lineTotal,
          variant,
          notes: notes || null,
        },
      });

      existingItem.qty = targetQty;
      existingItem.unitPrice = unitPrice;
      existingItem.lineTotal = lineTotal;
      existingItem.variant = variant;
      existingItem.notes = notes || null;
    } else {
      const createdItem = await strapi.db.query(CART_ITEM_UID).create({
        data: {
          cart: cart.id,
          product: product.id,
          qty: qtyToAdd,
          unitPrice,
          lineTotal: roundMoney(unitPrice * qtyToAdd),
          variant,
          notes: notes || null,
        },
      });

      cart.items = [
        ...(cart.items || []),
        {
          ...createdItem,
          qty: qtyToAdd,
          unitPrice,
          lineTotal: roundMoney(unitPrice * qtyToAdd),
          variant,
          notes: notes || null,
          product,
        },
      ];
    }

    return recalculateCartFromState(cart);
  };

  const updateCartItemQty = async (cartId: number, itemId: number, payload: any, currentCart: any = null) => {
    const qty = toInt(payload?.qty, 0);
    if (qty < 0) {
      throwHttpError(400, 'La cantidad debe ser mayor o igual a 0');
    }

    const cart = currentCart || (await getCartById(cartId));
    if (!cart || cart.statusCart !== 'active') {
      throwHttpError(404, 'Carrito activo no encontrado');
    }

    const item = (cart.items || []).find((entry: any) => entry.id === itemId);

    if (!item) {
      throwHttpError(404, 'Producto del carrito no encontrado');
    }

    if (qty === 0) {
      await strapi.db.query(CART_ITEM_UID).delete({ where: { id: item.id } });
      cart.items = (cart.items || []).filter((entry: any) => entry.id !== item.id);
      return recalculateCartFromState(cart);
    }

    if (!item.product) {
      throwHttpError(400, 'El producto del carrito ya no esta disponible');
    }

    const resolvedVariant = resolveProductVariant(item.product, item.variant, true);
    const normalizedVariant = buildVariantSnapshot(resolvedVariant) || null;
    const availableStock = resolvedVariant
      ? Math.max(0, toInt(resolvedVariant.stock, 0))
      : Math.max(0, getEffectiveProductStock(item.product));

    if (availableStock < qty) {
      throwHttpError(400, 'No hay suficiente inventario para la cantidad solicitada');
    }

    const unitPrice = resolvedVariant
      ? roundMoney(toNumber(resolvedVariant.price, toNumber(item.unitPrice, 0)))
      : getEffectiveProductPrice(item.product);
    const lineTotal = roundMoney(unitPrice * qty);

    await strapi.db.query(CART_ITEM_UID).update({
      where: { id: item.id },
      data: {
        qty,
        unitPrice,
        lineTotal,
        variant: normalizedVariant,
      },
    });

    item.qty = qty;
    item.unitPrice = unitPrice;
    item.lineTotal = lineTotal;
    item.variant = normalizedVariant;

    return recalculateCartFromState(cart);
  };

  const removeCartItem = async (cartId: number, itemId: number, currentCart: any = null) => {
    const cart = currentCart || (await getCartById(cartId));
    if (!cart || cart.statusCart !== 'active') {
      throwHttpError(404, 'Carrito activo no encontrado');
    }

    const item = (cart.items || []).find((entry: any) => entry.id === itemId);

    if (!item) {
      throwHttpError(404, 'Producto del carrito no encontrado');
    }

    await strapi.db.query(CART_ITEM_UID).delete({
      where: { id: item.id },
    });

    cart.items = (cart.items || []).filter((entry: any) => entry.id !== item.id);

    return recalculateCartFromState(cart);
  };

  const applyCouponToCart = async (cartId: number, codeInput: string, currentCart: any = null) => {
    const code = normalizeText(codeInput).toUpperCase();
    if (!code) {
      throwHttpError(400, 'Debes ingresar un código de cupón');
    }

    const coupon = await strapi.db.query(COUPON_UID).findOne({
      where: {
        code: { $eqi: code },
        publishedAt: { $notNull: true },
      },
      populate: couponPopulate,
    });

    if (!coupon) {
      throwHttpError(404, 'Cupón no encontrado');
    }

    const cart = currentCart || (await getCartById(cartId));
    if (!cart) {
      throwHttpError(404, 'Carrito no encontrado');
    }

    const subtotal = await syncCartItemsAndGetSubtotal(cart);
    cart.subtotal = subtotal;
    const evaluation = evaluateCoupon(coupon, subtotal, cart.items || []);
    if (!evaluation.valid) {
      throwHttpError(400, evaluation.reason || 'No se pudo aplicar el cupón');
    }

    const discountTotal = roundMoney(evaluation.discount);
    const grandTotal = roundMoney(Math.max(0, subtotal - discountTotal));

    await strapi.db.query(CART_UID).update({
      where: { id: cartId },
      data: {
        coupon: coupon.id,
        subtotal,
        discountTotal,
        shippingTotal: 0,
        grandTotal,
      },
    });

    cart.coupon = coupon;
    cart.discountTotal = discountTotal;
    cart.shippingTotal = 0;
    cart.grandTotal = grandTotal;

    return serializeCartWithSettings(cart);
  };

  const clearCouponFromCart = async (cartId: number, currentCart: any = null) => {
    const cart = currentCart || (await getCartById(cartId));
    if (!cart) {
      throwHttpError(404, 'Carrito no encontrado');
    }

    const subtotal = await syncCartItemsAndGetSubtotal(cart);
    const grandTotal = roundMoney(Math.max(0, subtotal));

    await strapi.db.query(CART_UID).update({
      where: { id: cartId },
      data: {
        coupon: null,
        subtotal,
        discountTotal: 0,
        shippingTotal: 0,
        grandTotal,
      },
    });

    cart.coupon = null;
    cart.subtotal = subtotal;
    cart.discountTotal = 0;
    cart.shippingTotal = 0;
    cart.grandTotal = grandTotal;

    return serializeCartWithSettings(cart);
  };

  const assertCheckoutAddress = (address: any, fieldName: 'billingAddress' | 'shippingAddress') => {
    if (!isObject(address)) {
      throwHttpError(400, `${fieldName} object is required`);
    }

    const requiredFields = ['fullName', 'phone', 'country', 'city', 'addressLine1'];
    for (const key of requiredFields) {
      if (!normalizeText(address[key])) {
        throwHttpError(400, `${fieldName}.${key} is required`);
      }
    }
  };

  const runCheckout = async (
    cartId: number,
    payload: any,
    userId: number | null,
    mode: 'guest' | 'user',
    trx: any = null
  ) => {
    const rawCart = await strapi.db
      .query(CART_UID)
      .findOne(
        withTrx(
          {
            where: { id: cartId, statusCart: 'active' },
            populate: cartPopulate,
          },
          trx
        )
      );

    if (!rawCart) {
      throwHttpError(404, 'Carrito activo no encontrado');
    }

    if (!rawCart.items || rawCart.items.length === 0) {
      throwHttpError(400, 'No puedes finalizar una compra con el carrito vacio');
    }

    let checkoutEmail = normalizeText(payload?.email);

    if (userId && !checkoutEmail) {
      const user = await strapi.db.query(USER_UID).findOne(withTrx({ where: { id: userId } }, trx));
      checkoutEmail = normalizeText(user?.email);
    }

    if (!checkoutEmail) {
      throwHttpError(400, 'El correo es obligatorio para finalizar la compra');
    }

    assertCheckoutAddress(payload?.billingAddress, 'billingAddress');
    assertCheckoutAddress(payload?.shippingAddress, 'shippingAddress');

    const shippingMethod = resolveShippingMethod(payload?.shippingMethod ?? payload?.shippingMethodId);
    const paymentKind = resolvePaymentKind(payload?.paymentKind ?? payload?.paymentMethod);

    const unavailableItems: Array<{ name: string; qty: number; unitPrice: number; lineTotal: number }> = [];

    for (const item of rawCart.items) {
      const productId = getRelationId(item.product);
      if (!productId) {
        unavailableItems.push({
          name: item.nameSnapshot || 'Producto',
          qty: toInt(item.qty, 1),
          unitPrice: roundMoney(toNumber(item.unitPrice, 0)),
          lineTotal: roundMoney(toNumber(item.lineTotal, 0)),
        });
        continue;
      }

      const latestProduct = await strapi.db
        .query(PRODUCT_UID)
        .findOne(withTrx({ where: { id: productId, publishedAt: { $notNull: true } } }, trx));

      if (!latestProduct) {
        unavailableItems.push({
          name: item.nameSnapshot || `Producto #${productId}`,
          qty: toInt(item.qty, 1),
          unitPrice: roundMoney(toNumber(item.unitPrice, 0)),
          lineTotal: roundMoney(toNumber(item.lineTotal, 0)),
        });
        continue;
      }

      const resolvedVariant = resolveProductVariant(latestProduct, item.variant, true);
      const rawStock = resolvedVariant ? resolvedVariant.stock : latestProduct.stock;
      const stockTracked = rawStock !== null && rawStock !== undefined;
      const availableStock = stockTracked
        ? (resolvedVariant
            ? Math.max(0, toInt(resolvedVariant.stock, 0))
            : Math.max(0, getEffectiveProductStock(latestProduct)))
        : Infinity;

      if (availableStock < toInt(item.qty, 1)) {
        unavailableItems.push({
          name: latestProduct.name,
          qty: toInt(item.qty, 1),
          unitPrice: roundMoney(toNumber(item.unitPrice, 0)),
          lineTotal: roundMoney(toNumber(item.lineTotal, 0)),
        });
      }
    }

    if (unavailableItems.length > 0) {
      throwHttpError(400, 'Algunos productos no tienen stock disponible', { unavailable: unavailableItems });
    }

    const subtotal = roundMoney(toNumber(rawCart.subtotal, 0));
    const couponEvaluation = rawCart.coupon ? evaluateCoupon(rawCart.coupon, subtotal, rawCart.items || []) : null;
    if (rawCart.coupon && !couponEvaluation?.valid) {
      throwHttpError(400, couponEvaluation?.reason || 'El cupon ya no se puede aplicar');
    }

    const discountTotal = couponEvaluation?.valid
      ? roundMoney(couponEvaluation.discount)
      : roundMoney(toNumber(rawCart.discountTotal, 0));
    const settings = await getStorefrontSettings();
    const shippingTotal = resolveShippingTotal(
      subtotal,
      discountTotal,
      shippingMethod,
      settings.freeShippingThreshold,
      normalizeText(payload?.shippingAddress?.department).toLowerCase() || undefined
    );
    const taxTotal = 0;
    const grandTotal = roundMoney(Math.max(0, subtotal - discountTotal + shippingTotal + taxTotal));
    const affiliateCommission = couponEvaluation?.affiliateCommission || {
      type: null,
      value: 0,
      amount: 0,
    };

    const orderNumber = `ORD-${Date.now()}-${crypto.randomInt(1000, 9999)}`;

    const createdOrder = await strapi.db.query(ORDER_UID).create(
      withTrx(
        {
          data: {
            oderNumber: orderNumber,
            orderNumber,
            user: userId || null,
            email: checkoutEmail,
            billingAddress: payload.billingAddress,
            shippingAddress: {
              ...payload.shippingAddress,
              shippingMethod,
              ...(paymentKind ? { paymentKind } : {}),
            },
            currency: rawCart.currency || DEFAULT_CURRENCY,
            subtotal,
            discountTotal,
            shippingTotal,
            taxTotal,
            grandTotal,
            membershipApplied: Boolean(rawCart.membershipApplied),
            statusOrder: 'pending',
            coupon: getRelationId(rawCart.coupon),
            couponCode: rawCart.coupon?.code || null,
            couponScope: couponEvaluation?.valid ? couponEvaluation.scope : null,
            couponEligibleSubtotal: couponEvaluation?.valid
              ? roundMoney(toNumber(couponEvaluation.eligibleSubtotal, 0))
              : 0,
            couponFundedByBrand: getRelationId(rawCart.coupon?.fundedByBrand),
            couponInfluencer: getRelationId(rawCart.coupon?.influencer),
            affiliateCommissionType: affiliateCommission.type,
            affiliateCommissionValue: roundMoney(toNumber(affiliateCommission.value, 0)),
            affiliateCommissionAmount: roundMoney(toNumber(affiliateCommission.amount, 0)),
          },
        },
        trx
      )
    );

    for (const item of rawCart.items) {
      const productId = getRelationId(item.product);
      const latestProduct = await strapi.db
        .query(PRODUCT_UID)
        .findOne(withTrx({ where: { id: productId } }, trx));

      const qty = Math.max(1, toInt(item.qty, 1));
      const resolvedVariant = resolveProductVariant(latestProduct, item.variant, true);
      const normalizedVariant = buildVariantSnapshot(resolvedVariant) || null;
      const unitPrice = resolvedVariant
        ? roundMoney(toNumber(resolvedVariant.price, toNumber(item.unitPrice, 0)))
        : getEffectiveProductPrice(latestProduct);
      const lineTotal = roundMoney(unitPrice * qty);

      await strapi.db.query(ORDER_ITEM_UID).create(
        withTrx(
          {
            data: {
              order: createdOrder.id,
              product: productId,
              nameSnapshot: buildOrderItemNameSnapshot(latestProduct, normalizedVariant),
              qty,
              unitPrice,
              lineTotal,
              sku: normalizedVariant?.sku || normalizeText(latestProduct?.sku) || latestProduct?.slug || null,
              variant: normalizedVariant,
            },
          },
          trx
        )
      );

      // Si stock es null en BD el producto no tiene tracking de stock — saltarse deducción
      const rawStock = latestProduct?.stock;
      const stockTracked = rawStock !== null && rawStock !== undefined;

      if (stockTracked) {
        const currentStock = Math.max(0, getEffectiveProductStock(latestProduct));
        const currentVariants = normalizeProductVariants(latestProduct);
        const activeVariant = resolvedVariant
          ? currentVariants.find((variant) => variant.id === resolvedVariant.id) || resolvedVariant
          : null;

        if (activeVariant) {
          const currentVariantStock = Math.max(0, toInt(activeVariant.stock, 0));
          if (currentVariantStock < qty) {
            throwHttpError(409, `Stock insuficiente para ${latestProduct?.name || `producto ${productId}`}`);
          }

          const nextVariants = currentVariants.map((variant) =>
            variant.id === activeVariant.id
              ? { ...variant, stock: Math.max(0, toInt(variant.stock, 0) - qty) }
              : variant
          );
          const nextStock = nextVariants.reduce(
            (sum, variant) => sum + Math.max(0, toInt(variant.stock, 0)),
            0
          );

          const updatedProduct = await strapi.db.query(PRODUCT_UID).update(
            withTrx(
              {
                where: { id: productId, stock: { $eq: currentStock } },
                data: { stock: nextStock, variants: nextVariants },
              },
              trx
            )
          );

          if (!updatedProduct) {
            throwHttpError(409, `Stock cambió mientras se procesaba ${latestProduct?.name || `producto ${productId}`}`);
          }
        } else {
          if (currentStock < qty) {
            throwHttpError(409, `Stock insuficiente para ${latestProduct?.name || `producto ${productId}`}`);
          }
          const nextStock = Math.max(0, currentStock - qty);

          const updatedProduct = await strapi.db.query(PRODUCT_UID).update(
            withTrx(
              {
                where: { id: productId, stock: { $eq: currentStock } },
                data: { stock: nextStock },
              },
              trx
            )
          );

          if (!updatedProduct) {
            throwHttpError(409, `Stock cambió mientras se procesaba ${latestProduct?.name || `producto ${productId}`}`);
          }
        }
      }
    }

    if (rawCart.coupon?.id) {
      const nextUsage = toInt(rawCart.coupon.usageCount, 0) + 1;
      await strapi.db.query(COUPON_UID).update(
        withTrx(
          {
            where: { id: rawCart.coupon.id },
            data: {
              usageCount: nextUsage,
            },
          },
          trx
        )
      );
    }

    await strapi.db.query(CART_UID).update(
      withTrx(
        {
          where: { id: rawCart.id },
          data: {
            statusCart: 'converted',
            expiresAt: toIsoNow(),
          },
        },
        trx
      )
    );

    const order = await strapi.db
      .query(ORDER_UID)
      .findOne(withTrx({ where: { id: createdOrder.id }, populate: orderPopulate }, trx));

    const nextCart =
      mode === 'guest'
        ? await createActiveCart({ sessionKey: rawCart.sessionKey || crypto.randomUUID() })
        : await createActiveCart({ userId: userId || undefined });

    return {
      order: serializeOrder(order),
      nextCart: serializeCart(nextCart, settings),
    };
  };

  const checkoutCart = async (
    cartId: number,
    payload: any,
    userId: number | null,
    mode: 'guest' | 'user'
  ) => {
    const dbConnection = strapi.db?.connection;

    if (dbConnection?.transaction) {
      return dbConnection.transaction(async (trx: any) => runCheckout(cartId, payload, userId, mode, trx));
    }

    return runCheckout(cartId, payload, userId, mode);
  };

  const buildProductWhere = async (query: any, userId?: number) => {
    const conditions: any[] = [{ publishedAt: { $notNull: true } }];

    const search = normalizeText(query?.search);
    if (search) {
      const searchGroups = tokenizeSearch(search)
        .map((token) => expandSearchToken(token))
        .filter((group) => group.length > 0);

      if (searchGroups.length) {
        for (const group of searchGroups) {
          conditions.push({
            $or: group.flatMap((term) => buildSearchFieldConditions(term)),
          });
        }
      } else {
        conditions.push({
          $or: buildSearchFieldConditions(search),
        });
      }
    }

    const excludeId = toInt(query?.excludeId, 0);
    if (excludeId > 0) {
      conditions.push({ id: { $ne: excludeId } });
    }

    const category = normalizeText(query?.category);
    const subcategory = normalizeText(query?.subcategory);
    const animalKey = normalizeText(query?.animalKey ?? query?.animal);
    const categorySlug = normalizeText(query?.categorySlug);
    const specieIds = parseIdList(query?.specieIds ?? query?.specieId);

    let categoryHandledByTaxonomyFallback = false;
    let subcategoryHandledByTaxonomyFallback = false;
    let speciesHandledByTaxonomyFallback = false;

    if (subcategory && categorySlug) {
      conditions.push({
        $or: [
          { catalogCategory: { slug: { $eq: categorySlug } } },
          { subcategory: { $eqi: subcategory } },
        ],
      });
      subcategoryHandledByTaxonomyFallback = true;
    } else if (categorySlug) {
      if (category) {
        conditions.push({
          $or: [
            { catalogCategory: { slug: { $eq: categorySlug } } },
            { category: { $eq: category } },
          ],
        });
        categoryHandledByTaxonomyFallback = true;
      } else {
        conditions.push({ catalogCategory: { slug: { $eq: categorySlug } } });
      }
    }

    if (category && !categoryHandledByTaxonomyFallback) {
      conditions.push({ category: { $eq: category } });
    }

    if (subcategory && !subcategoryHandledByTaxonomyFallback) {
      conditions.push({ subcategory: { $eqi: subcategory } });
    }

    // New taxonomy filters: animal key and category slug
    if (animalKey) {
      if (specieIds.length > 0) {
        conditions.push({
          $or: [
            { catalogAnimals: { key: { $eq: animalKey } } },
            { speciesSupported: { id: { $in: specieIds } } },
          ],
        });
        speciesHandledByTaxonomyFallback = true;
      } else {
        conditions.push({ catalogAnimals: { key: { $eq: animalKey } } });
      }
    }

    if (parseBool(query?.featured)) {
      conditions.push({ isFeatured: { $eq: true } });
    }

    const forms = parseTextList(query?.forms ?? query?.form);
    if (forms.length > 0) {
      conditions.push({ form: { $in: forms } });
    }

    const proteinSources = parseTextList(query?.proteinSources ?? query?.proteinSource);
    if (proteinSources.length > 0) {
      conditions.push({ proteinSource: { $in: proteinSources } });
    }

    const brandIds = parseIdList(query?.brandIds ?? query?.brandId);
    if (brandIds.length > 0) {
      conditions.push({ brand: { id: { $in: brandIds } } });
    }

    if (specieIds.length > 0 && !speciesHandledByTaxonomyFallback) {
      conditions.push({ speciesSupported: { id: { $in: specieIds } } });
    }

    const lifeStageIds = parseIdList(query?.lifeStageIds ?? query?.lifeStageId);
    if (lifeStageIds.length > 0) {
      conditions.push({ lifeStages: { id: { $in: lifeStageIds } } });
    }

    const dietTagIds = parseIdList(query?.dietTagIds);
    if (dietTagIds.length > 0) {
      conditions.push({ diet_tags: { id: { $in: dietTagIds } } });
    }

    const healthConditionIds = parseIdList(query?.healthConditionIds);
    if (healthConditionIds.length > 0) {
      conditions.push({ health_claims: { id: { $in: healthConditionIds } } });
    }

    const ingredientIds = parseIdList(query?.ingredientIds);
    if (ingredientIds.length > 0) {
      conditions.push({ ingredients: { id: { $in: ingredientIds } } });
    }

    const minPrice = toNumber(query?.minPrice, Number.NaN);
    if (Number.isFinite(minPrice)) {
      conditions.push({ price: { $gte: minPrice } });
    }

    const maxPrice = toNumber(query?.maxPrice, Number.NaN);
    if (Number.isFinite(maxPrice)) {
      conditions.push({ price: { $lte: maxPrice } });
    }

    if (parseBool(query?.inStock)) {
      conditions.push({ stock: { $gt: 0 } });
    }

    const petProfileId = toInt(query?.petProfileId, 0);
    if (petProfileId > 0) {
      if (!userId) {
        throwHttpError(401, 'Authentication is required to use pet-based filtering');
      }

      const pet = await strapi.db.query(PET_PROFILE_UID).findOne({
        where: {
          id: petProfileId,
          owner: { id: userId },
        },
        populate: {
          specie: true,
          lifeStage: true,
          dietTags: true,
          healthConditions: true,
          catalogAnimal: true,
        },
      });

      if (!pet) {
        throwHttpError(404, 'Pet profile not found for this user');
      }

      // Prefer new taxonomy, but keep legacy species as fallback while products migrate.
      if (pet.catalogAnimal?.key && pet.specie?.id) {
        conditions.push({
          $or: [
            { catalogAnimals: { key: { $eq: pet.catalogAnimal.key } } },
            { speciesSupported: { id: { $eq: pet.specie.id } } },
          ],
        });
      } else if (pet.catalogAnimal?.key) {
        conditions.push({ catalogAnimals: { key: { $eq: pet.catalogAnimal.key } } });
      } else if (pet.specie?.id) {
        conditions.push({ speciesSupported: { id: { $eq: pet.specie.id } } });
      }

      // With a pet template we only hard-filter by species. Stage, weight, diet
      // tags and health claims are handled as compatibility hints elsewhere,
      // because many products still have partial metadata and strict gating
      // hides valid results from the catalog.
    }

    return conditions.length > 0 ? { $and: conditions } : {};
  };

  const getUserProfilePayload = async (userId: number) => {
    const user = await strapi.db.query(USER_UID).findOne({
      where: { id: userId },
      populate: {
        avatar: true,
      },
    });

    if (!user) {
      throwHttpError(404, 'User not found');
    }

    const [orders, pets, userOrders] = await Promise.all([
      strapi.db.query(ORDER_UID).count({ where: { user: { id: userId } } }),
      strapi.db.query(PET_PROFILE_UID).count({ where: { owner: { id: userId } } }),
      strapi.db.query(ORDER_UID).findMany({
        where: { user: { id: userId } },
        select: ['discountTotal'],
      }),
    ]);

    const savedAmount = userOrders.reduce(
      (sum: number, o: any) => sum + toNumber(o.discountTotal, 0),
      0
    );

    return {
      data: serializeUserProfile(user, { orders, pets, savedAmount: roundMoney(savedAmount) }),
    };
  };

  const extractFirstValue = (payload: any, fields: string[]): string => {
    return pickFirstNonEmpty(fields.map((field) => payload?.[field]));
  };

  const sanitizeAddressPayload = (payload: any, forCreate = false) => {
    if (!isObject(payload)) {
      throwHttpError(400, 'Address payload must be an object');
    }

    const data: any = {};

    const mapping: Array<{ key: string; aliases: string[] }> = [
      { key: 'label', aliases: ['label', 'etiqueta'] },
      { key: 'fullName', aliases: ['fullName', 'nombreCompleto', 'name'] },
      { key: 'phone', aliases: ['phone', 'telefono'] },
      { key: 'country', aliases: ['country', 'pais'] },
      { key: 'state', aliases: ['state', 'departamento', 'region'] },
      { key: 'city', aliases: ['city', 'ciudad'] },
      { key: 'postalCode', aliases: ['postalCode', 'zip', 'codigoPostal'] },
      { key: 'addressLine1', aliases: ['addressLine1', 'line1', 'direccion1'] },
      { key: 'addressLine2', aliases: ['addressLine2', 'line2', 'direccion2'] },
      { key: 'reference', aliases: ['reference', 'referencia'] },
    ];

    for (const field of mapping) {
      if (hasOwnField(payload, field.aliases)) {
        const value = extractFirstValue(payload, field.aliases);
        data[field.key] = value || null;
      }
    }

    if (forCreate && !normalizeText(data.addressLine1)) {
      throwHttpError(400, 'addressLine1 is required');
    }

    if (hasOwnField(payload, ['isDefault', 'predeterminada', 'default'])) {
      const normalized = normalizeBooleanInput(payload.isDefault ?? payload.predeterminada ?? payload.default);
      if (normalized === null) {
        throwHttpError(400, 'isDefault must be a boolean');
      }
      data.isDefault = normalized;
    }

    return data;
  };

  const sanitizePetPayload = (payload: any, forCreate = false) => {
    if (!isObject(payload)) {
      throwHttpError(400, 'Pet payload must be an object');
    }

    const data: any = {};

    if (hasOwnField(payload, ['name', 'nombre'])) {
      const name = extractFirstValue(payload, ['name', 'nombre']);
      if (!name) {
        throwHttpError(400, 'name cannot be empty');
      }
      data.name = name;
    } else if (forCreate) {
      throwHttpError(400, 'name is required');
    }

    if (hasOwnField(payload, ['birthdate', 'birthDate', 'fechaNacimiento'])) {
      data.birthdate = normalizeDateInput(
        pickFirstPresentValue([payload.birthdate, payload.birthDate, payload.fechaNacimiento])
      );
    }

    if (hasOwnField(payload, ['breed', 'raza'])) {
      data.breed = extractFirstValue(payload, ['breed', 'raza']) || null;
    }

    if (hasOwnField(payload, ['color'])) {
      data.color = extractFirstValue(payload, ['color']) || null;
    }

    if (hasOwnField(payload, ['avatarHex', 'favoriteColor', 'colorFavorito'])) {
      data.avatarHex = extractFirstValue(payload, ['avatarHex', 'favoriteColor', 'colorFavorito']) || null;
    }

    if (hasOwnField(payload, ['weightKg', 'weight', 'pesoKg'])) {
      const weightValue = toNumber(
        pickFirstPresentValue([payload.weightKg, payload.weight, payload.pesoKg]),
        Number.NaN
      );
      data.weightKg = Number.isFinite(weightValue) ? weightValue : null;
    }

    if (hasOwnField(payload, ['size', 'tamano'])) {
      data.size = extractFirstValue(payload, ['size', 'tamano']) || null;
    }

    if (hasOwnField(payload, ['sex', 'sexo'])) {
      data.sex = extractFirstValue(payload, ['sex', 'sexo']) || null;
    }

    if (hasOwnField(payload, ['sterilized', 'esterilizado'])) {
      const sterilized = normalizeBooleanInput(payload.sterilized ?? payload.esterilizado);
      data.sterilized = sterilized === null ? null : sterilized;
    }

    if (hasOwnField(payload, ['activity', 'actividad'])) {
      const activity = extractFirstValue(payload, ['activity', 'actividad']);
      data.activity = activity || null;
    }

    if (hasOwnField(payload, ['allergies', 'alergias'])) {
      const rawAllergies = payload.allergies ?? payload.alergias;
      if (Array.isArray(rawAllergies)) {
        data.allergies = rawAllergies.map((item) => normalizeText(item)).filter(Boolean);
      } else if (typeof rawAllergies === 'string') {
        data.allergies = rawAllergies
          .split(',')
          .map((item) => normalizeText(item))
          .filter(Boolean);
      } else {
        data.allergies = [];
      }
    }

    if (hasOwnField(payload, ['notes', 'notas'])) {
      data.notes = extractFirstValue(payload, ['notes', 'notas']) || null;
    }

    const specieId = toInt(
      pickFirstPresentValue([payload.specieId, payload.speciesId, payload.specie, payload.species]),
      0
    );
    if (specieId > 0) {
      data.specie = specieId;
    } else if (hasOwnField(payload, ['specieId', 'speciesId', 'specie', 'species'])) {
      data.specie = null;
    }

    // New taxonomy: catalogAnimalId links to catalog-animal
    const catalogAnimalId = toInt(
      pickFirstPresentValue([payload.catalogAnimalId, payload.catalogAnimal]),
      0
    );
    if (catalogAnimalId > 0) {
      data.catalogAnimal = catalogAnimalId;
    } else if (hasOwnField(payload, ['catalogAnimalId', 'catalogAnimal'])) {
      data.catalogAnimal = null;
    }

    const lifeStageId = toInt(
      pickFirstPresentValue([payload.lifeStageId, payload.lifeStage, payload.etapaVida]),
      0
    );
    if (lifeStageId > 0) {
      data.lifeStage = lifeStageId;
    } else if (hasOwnField(payload, ['lifeStageId', 'lifeStage', 'etapaVida'])) {
      data.lifeStage = null;
    }

    if (hasOwnField(payload, ['dietTagIds', 'dietTags', 'diet_tags'])) {
      data.dietTags = parseIdList(payload.dietTagIds ?? payload.dietTags ?? payload.diet_tags);
    }

    if (hasOwnField(payload, ['healthConditionIds', 'healthConditions', 'health_conditions'])) {
      data.healthConditions = parseIdList(
        payload.healthConditionIds ?? payload.healthConditions ?? payload.health_conditions
      );
    }

    return data;
  };

  const getUserPreferencesPayload = async (userId: number) => {
    const user = await strapi.db.query(USER_UID).findOne({ where: { id: userId } });
    if (!user) {
      throwHttpError(404, 'User not found');
    }

    return {
      data: serializeUserPreferences(user),
    };
  };

  const CATALOG_ANIMAL_UID = 'api::catalog-animal.catalog-animal';

  const listPetTaxonomyPayload = async () => {
    const [catalogAnimals, species, lifeStages, dietTags, healthConditions] = await Promise.all([
      strapi.db.query(CATALOG_ANIMAL_UID).findMany({
        where: { isActive: { $ne: false }, publishedAt: { $notNull: true } },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      }),
      strapi.db.query(SPECIE_UID).findMany({
        where: { publishedAt: { $notNull: true } },
        orderBy: [{ name: 'asc' }],
      }),
      strapi.db.query(LIFE_STAGE_UID).findMany({
        where: { publishedAt: { $notNull: true } },
        orderBy: [{ name: 'asc' }],
      }),
      strapi.db.query(DIET_TAG_UID).findMany({
        where: { publishedAt: { $notNull: true } },
        orderBy: [{ name: 'asc' }],
      }),
      strapi.db.query(HEALTH_CONDITION_UID).findMany({
        where: { publishedAt: { $notNull: true } },
        orderBy: [{ name: 'asc' }],
      }),
    ]);

    const normalizeTaxonomy = (items: any[]) =>
      (items || []).map((item: any) => ({
        id: item.id,
        documentId: item.documentId,
        name: item.name,
        slug: item.slug || null,
      }));

    return {
      data: {
        // catalogAnimals is the new authoritative species list for pet forms
        catalogAnimals: (catalogAnimals || []).map((a: any) => ({
          id: a.id,
          documentId: a.documentId,
          key: a.key,
          slug: a.slug,
          label: a.label,
          sortOrder: a.sortOrder,
        })),
        // Legacy species taxonomy used by product filters and pet matching.
        species: normalizeTaxonomy(species),
        lifeStages: normalizeTaxonomy(lifeStages),
        dietTags: normalizeTaxonomy(dietTags),
        healthConditions: normalizeTaxonomy(healthConditions),
      },
    };
  };

  const FILTER_SCOPE_UID = 'api::filter-scope.filter-scope';

  const listFilterScopesPayload = async (animalSlug?: string, categoryCode?: string) => {
    const allScopes = await strapi.db.query(FILTER_SCOPE_UID).findMany({
      where: { isVisible: true },
      populate: {
        catalogFilter: { select: ['key'] },
        animals: { select: ['slug', 'key'] },
        categories: { select: ['slug', 'code'] },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const applicable = allScopes.filter((scope: any) => {
      const animalMatch =
        !scope.animals?.length ||
        !animalSlug ||
        scope.animals.some((a: any) => a.slug === animalSlug || a.key === animalSlug);
      const categoryMatch =
        !scope.categories?.length ||
        !categoryCode ||
        scope.categories.some((c: any) => c.slug === categoryCode || c.code === categoryCode);
      return animalMatch && categoryMatch;
    });

    // Dedup by filterKey, keeping lowest sortOrder (already sorted)
    const seen = new Set<string>();
    const filterKeys: string[] = [];
    const filters: Array<{ filterKey: string; sortOrder: number }> = [];
    for (const scope of applicable) {
      const resolvedFilterKey = resolveFilterScopeKeyFromScopeRecord(scope);
      if (!resolvedFilterKey || seen.has(resolvedFilterKey)) continue;
      seen.add(resolvedFilterKey);
      filterKeys.push(resolvedFilterKey);
      filters.push({ filterKey: resolvedFilterKey, sortOrder: scope.sortOrder ?? 50 });
    }

    return { data: { filterKeys, filters } };
  };

  const listCatalogTaxonomyPayload = async () => {
    const databasePayload = await getCatalogTaxonomyPayloadFromDatabase(strapi);
    if (databasePayload) {
      return databasePayload;
    }

    return {
      data: {
        version: toIsoNow().slice(0, 10),
        generatedFrom: 'database-empty',
        filterLibrary: [],
        animals: [],
      },
    };
  };

  const listProductFacetsPayload = async (query: any = {}, userId?: number) => {
    const where = await buildProductWhere(query, userId);
    let products: any[] = [];

    try {
      products = await runWithTimeout(
        strapi.db.query(PRODUCT_UID).findMany({
          where,
          select: ['price', 'variants', 'category', 'subcategory', 'form', 'proteinSource'],
          populate: {
            brand: {
              select: ['id', 'documentId', 'name', 'slug'],
              populate: {
                logo: true,
              },
            },
            speciesSupported: {
              select: ['id', 'documentId', 'name', 'slug'],
            },
            catalogAnimals: {
              select: ['id', 'documentId', 'key', 'slug', 'label'],
            },
            catalogCategory: {
              select: ['id', 'documentId', 'key', 'slug', 'label', 'level', 'legacyCategory'],
            },
            lifeStages: {
              select: ['id', 'documentId', 'name', 'slug'],
            },
            diet_tags: {
              select: ['id', 'documentId', 'name', 'slug'],
            },
            health_claims: {
              select: ['id', 'documentId', 'name', 'slug'],
            },
            ingredients: {
              select: ['id', 'documentId', 'name', 'slug'],
            },
          },
          orderBy: [{ createdAt: 'desc' }],
          limit: MAX_PAGE_SIZE,
        }),
        PRODUCT_QUERY_TIMEOUT_MS,
        'loading product facets'
      );
    } catch (error) {
      if (isQueryTimeoutError(error)) {
        throwHttpError(504, 'La consulta de filtros tardo demasiado. Intenta de nuevo.');
      }

      throw error;
    }

    // Use the effective price per product (default variant price for variant
    // products, root price for simple products). Exclude Q0 and non-finite.
    const priceValues = (products || [])
      .map((product: any) => roundMoney(getEffectiveProductPrice(product)))
      .filter((price: number) => Number.isFinite(price) && price > 0);

    return {
      data: {
        categories: collectNamedFacet((products || []).map((product: any) => product.category), CATEGORY_LABELS),
        subcategories: collectNamedFacet((products || []).map((product: any) => product.subcategory)),
        brands: collectBrandFacet((products || []).map((product: any) => product.brand).filter(Boolean)),
        forms: collectNamedFacet((products || []).map((product: any) => product.form), FORM_LABELS),
        proteinSources: collectNamedFacet(
          (products || []).map((product: any) => product.proteinSource),
          PROTEIN_SOURCE_LABELS
        ),
        species: collectTaxonomyFacet((products || []).flatMap((product: any) => (product.catalogAnimals || []).map((a: any) => ({ id: a.id, documentId: a.documentId, name: a.label, slug: a.slug })))),
        lifeStages: collectTaxonomyFacet((products || []).flatMap((product: any) => product.lifeStages || [])),
        dietTags: collectTaxonomyFacet((products || []).flatMap((product: any) => product.diet_tags || [])),
        healthConditions: collectTaxonomyFacet((products || []).flatMap((product: any) => product.health_claims || [])),
        ingredients: collectTaxonomyFacet((products || []).flatMap((product: any) => product.ingredients || [])),
        priceRange: {
          min: priceValues.length ? Math.min(...priceValues) : 0,
          max: priceValues.length ? Math.max(...priceValues) : 0,
        },
        totalProducts: (products || []).length,
      },
    };
  };

  const listMembershipPlansPayload = async () => {
    const plans = await strapi.db.query(MEMBERSHIP_UID).findMany({
      where: { publishedAt: { $notNull: true } },
      orderBy: [{ price: 'asc' }, { name: 'asc' }],
    });

    return {
      data: (plans || []).map(serializeMembershipPlan),
    };
  };

  const listPublicCouponsPayload = async () => {
    const now = Date.now();
    const coupons = await strapi.db.query(COUPON_UID).findMany({
      where: {
        publishedAt: { $notNull: true },
      },
      populate: couponPopulate,
      orderBy: [{ activeTo: 'asc' }, { createdAt: 'desc' }],
    });

    return {
      data: (coupons || [])
        .filter((coupon: any) => isCouponCurrentlyAvailable(coupon, now))
        .map((coupon: any) => serializePublicCoupon(coupon)),
    };
  };

  const listHeaderAnnouncementsPayload = async () => {
    const now = Date.now();
    const announcementConfig = await strapi.db.query(HEADER_ANNOUNCEMENT_UID).findOne({
      where: {
        publishedAt: { $notNull: true },
      },
      populate: {
        items: true,
      },
    });

    if (announcementConfig && announcementConfig.isEnabled === false) {
      return { data: [] };
    }

    const configuredItems = (announcementConfig?.items || [])
      .filter((announcement: any) => isHeaderAnnouncementCurrentlyAvailable(announcement, now))
      .map((announcement: any) => serializeHeaderAnnouncement(announcement));

    if (configuredItems.length > 0) {
      return {
        data: configuredItems,
      };
    }

    const couponsPayload = await listPublicCouponsPayload();

    return {
      data: (couponsPayload.data || [])
        .filter((coupon: any) => coupon.showInHeaderMarquee !== false)
        .map((coupon: any) => ({
          id: coupon.id,
          documentId: null,
          title: coupon.code || 'Cupon',
          message: coupon.displayMessage || '',
          startsAt: coupon.activeFrom || null,
          endsAt: coupon.activeTo || null,
        })),
    };
  };

  const getFooterNewsletterPromoPayload = async () => {
    const announcementConfig = await strapi.db.query(HEADER_ANNOUNCEMENT_UID).findOne({
      where: {
        publishedAt: { $notNull: true },
      },
      populate: {
        footerNewsletterPromoImage: true,
      },
    });

    return {
      data: serializeMedia(announcementConfig?.footerNewsletterPromoImage || null),
    };
  };

  const resolveMembershipTierFromName = (name: string): 'free' | 'premium' => {
    const normalized = normalizeText(name).toLowerCase();
    if (normalized.includes('premium')) return 'premium';
    return 'free';
  };

  const getUserMembershipPayload = async (userId: number) => {
    const [user, plansResult] = await Promise.all([
      strapi.db.query(USER_UID).findOne({
        where: { id: userId },
      }),
      listMembershipPlansPayload(),
    ]);

    if (!user) {
      throwHttpError(404, 'User not found');
    }

    const tier = (user.membershipTier || 'free') as 'free' | 'premium';
    const activePlan =
      plansResult.data.find((plan: any) => resolveMembershipTierFromName(plan.name) === tier) || null;

    return {
      data: {
        tier,
        membershipStartedAt: user.membershipStartedAt || null,
        activePlan,
        availablePlans: plansResult.data,
      },
    };
  };

  const clearUserDefaultAddresses = async (userId: number, exceptAddressId?: number) => {
    const addresses = await strapi.db.query(ADDRESS_UID).findMany({
      where: { owner: { id: userId } },
    });

    for (const address of addresses || []) {
      if (!address?.isDefault) continue;
      if (exceptAddressId && address.id === exceptAddressId) continue;

      await strapi.db.query(ADDRESS_UID).update({
        where: { id: address.id },
        data: { isDefault: false },
      });
    }
  };

  const ensureUserHasDefaultAddress = async (userId: number) => {
    const addresses = await strapi.db.query(ADDRESS_UID).findMany({
      where: { owner: { id: userId } },
      orderBy: { createdAt: 'asc' },
    });

    if (!addresses.length) return;
    if (addresses.some((address: any) => Boolean(address?.isDefault))) return;

    await strapi.db.query(ADDRESS_UID).update({
      where: { id: addresses[0].id },
      data: { isDefault: true },
    });
  };

  const getBackendPublicUrl = (): string =>
    normalizePublicUrl(strapi.config.get('server.url', '') || process.env.PUBLIC_URL || '');

  const getStorefrontPublicUrl = (): string => {
    const configuredOrigin = normalizePublicUrl(
      process.env.FRONTEND_PUBLIC_URL
      || process.env.STOREFRONT_PUBLIC_URL
      || resolveOrigin(process.env.UP_RESET_PASSWORD_URL)
      || normalizeText(process.env.CORS_ORIGIN).split(',')[0]
      || getBackendPublicUrl()
    );

    return configuredOrigin || getBackendPublicUrl();
  };

  const getMediaPublicUrl = (path?: string | null): string =>
    joinPublicUrl(getBackendPublicUrl() || getStorefrontPublicUrl(), path || '');

  const getStorefrontUrl = (path = ''): string =>
    joinPublicUrl(getStorefrontPublicUrl(), path);

  const getDiscoveryProducts = async () =>
    strapi.db.query(PRODUCT_UID).findMany({
      where: { publishedAt: { $notNull: true } },
      populate: {
        images: true,
        brand: true,
        speciesSupported: true,
      },
      orderBy: { updatedAt: 'desc' },
      limit: MAX_DISCOVERY_PRODUCTS,
    });

  const getSitemapEntries = async () => {
    const taxonomy = await listCatalogTaxonomyPayload();
    const products = await getDiscoveryProducts();
    const fallbackLastmod = normalizeText(taxonomy?.data?.version) || toIsoNow().slice(0, 10);
    const urls = new Map<string, { loc: string; lastmod: string; changefreq: string; priority: string }>();

    const register = (loc: string, lastmod: unknown, changefreq: string, priority: string) => {
      const normalizedLoc = normalizeText(loc);
      if (!normalizedLoc || urls.has(normalizedLoc)) return;

      urls.set(normalizedLoc, {
        loc: normalizedLoc,
        lastmod: toIsoDate(lastmod) || fallbackLastmod,
        changefreq,
        priority,
      });
    };

    register(getStorefrontUrl('/'), fallbackLastmod, 'daily', '1.0');
    register(getStorefrontUrl('/home'), fallbackLastmod, 'daily', '0.9');
    register(getStorefrontUrl('/catalog'), fallbackLastmod, 'daily', '0.9');
    register(getStorefrontUrl('/catalog?tag=new'), fallbackLastmod, 'daily', '0.8');
    register(getStorefrontUrl('/catalog?tag=clearance'), fallbackLastmod, 'daily', '0.8');
    register(getStorefrontUrl('/memberships/plans'), fallbackLastmod, 'weekly', '0.8');
    register(getStorefrontUrl('/about'), fallbackLastmod, 'monthly', '0.6');
    register(getStorefrontUrl('/terms'), fallbackLastmod, 'monthly', '0.4');

    for (const animal of taxonomy?.data?.animals || []) {
      const petType = normalizeText(animal?.key || animal?.slug);
      if (!petType) continue;

      register(getStorefrontUrl(`/catalog?petType=${encodeURIComponent(petType)}`), fallbackLastmod, 'daily', '0.8');

      for (const category of animal.categories || []) {
        const categoryParam = normalizeText(category.legacyCategory || category.slug);
        if (!categoryParam) continue;

        register(
          getStorefrontUrl(`/catalog?petType=${encodeURIComponent(petType)}&cat=${encodeURIComponent(categoryParam)}`),
          fallbackLastmod,
          'weekly',
          '0.7'
        );

        for (const subcategory of category.subcategories || []) {
          const subcategoryParam = normalizeText(subcategory.slug);
          if (!subcategoryParam) continue;

          register(
            getStorefrontUrl(
              `/catalog?petType=${encodeURIComponent(petType)}&cat=${encodeURIComponent(categoryParam)}&sub=${encodeURIComponent(subcategoryParam)}`
            ),
            fallbackLastmod,
            'weekly',
            '0.6'
          );
        }
      }
    }

    for (const product of products || []) {
      const slug = normalizeText(product?.slug);
      if (!slug) continue;

      register(
        getStorefrontUrl(`/catalog/product/${encodeURIComponent(slug)}`),
        product?.updatedAt || product?.publishedAt || fallbackLastmod,
        'weekly',
        '0.7'
      );
    }

    return Array.from(urls.values());
  };

  const getSitemapXmlPayload = async (): Promise<string> => {
    const cacheKey = 'sitemap-xml';
    const cached = getQueryCache(discoveryCache, cacheKey);
    if (cached) {
      return cached;
    }

    const entries = await getSitemapEntries();
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries.map(
        (entry) =>
          `  <url>${xmlTag('loc', entry.loc)}${entry.lastmod ? xmlTag('lastmod', entry.lastmod) : ''}${xmlTag('changefreq', entry.changefreq)}${xmlTag('priority', entry.priority)}</url>`
      ),
      '</urlset>',
    ].join('\n');

    setQueryCache(discoveryCache, cacheKey, xml);
    return xml;
  };

  const buildMerchantProductType = (product: any): string => {
    // Prefer new taxonomy (catalogAnimals + catalogCategory)
    const speciesLabel = normalizeText(product?.catalogAnimals?.[0]?.label || product?.speciesSupported?.[0]?.name);
    const categoryLabel = normalizeText(product?.catalogCategory?.label)
      || CATEGORY_LABELS[normalizeText(product?.category)]
      || normalizeText(product?.category);
    const subcategoryLabel = normalizeText(product?.subcategory);

    return [speciesLabel, categoryLabel, subcategoryLabel].filter(Boolean).join(' > ');
  };

  const getMerchantFeedXmlPayload = async (): Promise<string> => {
    const cacheKey = 'merchant-feed-xml';
    const cached = getQueryCache(discoveryCache, cacheKey);
    if (cached) {
      return cached;
    }

    const products = await getDiscoveryProducts();
    const items = (products || [])
      .filter(
        (product: any) =>
          normalizeText(product?.slug)
          && Number(toNumber(product?.price, 0)) > 0
          && Boolean(normalizeText(product?.images?.[0]?.url))
      )
      .map((product: any) => {
        const slug = normalizeText(product.slug);
        const currentPrice = getEffectiveProductPrice(product);
        const compareAtPrice = getEffectiveProductCompareAtPrice(product) || 0;
        const hasSalePrice = compareAtPrice > currentPrice;
        const productLink = getStorefrontUrl(`/catalog/product/${encodeURIComponent(slug)}`);
        const mainImage = getMediaPublicUrl(product?.images?.[0]?.url || '');
        const additionalImages = (product?.images || [])
          .slice(1, 10)
          .map((image: any) => getMediaPublicUrl(image?.url || ''))
          .filter(Boolean);
        const description = extractRichTextPlainText(product?.description) || normalizeText(product?.name);
        const brandName = normalizeText(product?.brand?.name);
        const productType = buildMerchantProductType(product);
        const availability = getEffectiveProductStock(product) > 0 ? 'in_stock' : 'out_of_stock';

        const xmlLines = [
          '    <item>',
          `      ${xmlTag('g:id', product?.documentId || product?.id || slug)}`,
          `      ${xmlTag('title', normalizeText(product?.name))}`,
          `      ${xmlTag('description', description)}`,
          `      ${xmlTag('link', productLink)}`,
          mainImage ? `      ${xmlTag('g:image_link', mainImage)}` : '',
          ...additionalImages.map((url) => `      ${xmlTag('g:additional_image_link', url)}`),
          `      ${xmlTag('g:availability', availability)}`,
          `      ${xmlTag('g:condition', 'new')}`,
          `      ${xmlTag('g:price', formatFeedPrice(hasSalePrice ? compareAtPrice : currentPrice))}`,
          hasSalePrice ? `      ${xmlTag('g:sale_price', formatFeedPrice(currentPrice))}` : '',
          brandName ? `      ${xmlTag('g:brand', brandName)}` : `      ${xmlTag('g:identifier_exists', 'no')}`,
          productType ? `      ${xmlTag('g:product_type', productType)}` : '',
        ].filter(Boolean);

        xmlLines.push('    </item>');
        return xmlLines.join('\n');
      });

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
      '  <channel>',
      `    ${xmlTag('title', 'Aumakki - Catalogo de productos para mascotas')}`,
      `    ${xmlTag('link', getStorefrontUrl('/catalog'))}`,
      `    ${xmlTag('description', 'Feed publico de productos para Merchant Center y otras superficies de descubrimiento.')}`,
      ...items,
      '  </channel>',
      '</rss>',
    ].join('\n');

    setQueryCache(discoveryCache, cacheKey, xml);
    return xml;
  };

  return {
    async resolveUserFromAuthorization(authorizationHeader: string, required = false) {
      return getUserFromAuthorization(authorizationHeader, required);
    },

    async listProducts(query: any = {}, userId?: number) {
      const cacheKey = buildQueryCacheKey('products', query, userId);
      const cached = getQueryCache(productsQueryCache, cacheKey);
      if (cached) {
        return cached;
      }

      const page = Math.max(1, toInt(query.page, 1));
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, toInt(query.pageSize, 25)));
      const offset = (page - 1) * pageSize;
      const where = await buildProductWhere(query, userId);
      const orderBy = parseSort(query.sort);
      const compact = parseBool(query.compact);
      const populate = compact
        ? {
            images: true,
            brand: {
              populate: {
                logo: true,
              },
            },
          }
        : {
            images: true,
            brand: {
              populate: {
                logo: true,
              },
            },
            speciesSupported: true,
            catalogAnimals: true,
            catalogCategory: true,
            lifeStages: true,
            diet_tags: true,
            health_claims: true,
            ingredients: true,
          };

      let products: any[] = [];
      try {
        products = await runWithTimeout(
          strapi.db.query(PRODUCT_UID).findMany({
            where,
            populate,
            orderBy,
            offset,
            // Ask one extra record to know if there is a next page without a heavy count().
            limit: pageSize + 1,
          }),
          PRODUCT_QUERY_TIMEOUT_MS,
          'loading products list'
        );
      } catch (error) {
        if (isQueryTimeoutError(error)) {
          throwHttpError(504, 'La consulta de productos tardo demasiado. Intenta de nuevo.');
        }

        throw error;
      }

      const hasNextPage = (products || []).length > pageSize;
      const pageItems = hasNextPage ? (products || []).slice(0, pageSize) : (products || []);
      const total = hasNextPage
        ? offset + pageSize + 1
        : offset + pageItems.length;

      const payload = {
        data: pageItems.map(compact ? serializeProductCompact : serializeProduct),
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount: Math.ceil(total / pageSize) || 1,
            total,
          },
        },
      };

      setQueryCache(productsQueryCache, cacheKey, payload);
      return payload;
    },

    async listProductFacets(query: any = {}, userId?: number) {
      const cacheKey = buildQueryCacheKey('facets', query, userId);
      const cached = getQueryCache(facetsQueryCache, cacheKey);
      if (cached) {
        return cached;
      }

      const payload = await listProductFacetsPayload(query, userId);
      setQueryCache(facetsQueryCache, cacheKey, payload);
      return payload;
    },

    async getProduct(idOrSlug: string) {
      const numericId = toInt(idOrSlug, 0);
      const where =
        numericId > 0
          ? { id: numericId, publishedAt: { $notNull: true } }
          : { slug: idOrSlug, publishedAt: { $notNull: true } };

      const product = await strapi.db.query(PRODUCT_UID).findOne({
        where,
        populate: {
          images: true,
          brand: {
            populate: {
              logo: true,
            },
          },
          speciesSupported: true,
          catalogAnimals: true,
          catalogCategory: true,
          lifeStages: true,
          diet_tags: true,
          health_claims: true,
          ingredients: true,
        },
      });

      if (!product) {
        throwHttpError(404, 'Producto no encontrado');
      }

      return {
        data: serializeProduct(product),
      };
    },

    async listMembershipPlans() {
      return listMembershipPlansPayload();
    },

    async listPublicCoupons() {
      return listPublicCouponsPayload();
    },

    async listHeaderAnnouncements() {
      return listHeaderAnnouncementsPayload();
    },

    async getStorefrontSettings() {
      return getStorefrontSettingsPayload();
    },

    async getFooterNewsletterPromo() {
      return getFooterNewsletterPromoPayload();
    },

    async listPetTaxonomy() {
      return listPetTaxonomyPayload();
    },

    async listCatalogTaxonomy() {
      return listCatalogTaxonomyPayload();
    },

    async listFilterScopesPayload(animalSlug?: string, categoryCode?: string) {
      return listFilterScopesPayload(animalSlug, categoryCode);
    },

    async getSitemapXml() {
      return getSitemapXmlPayload();
    },

    async getMerchantFeedXml() {
      return getMerchantFeedXmlPayload();
    },

    async getOrCreateGuestCart(sessionKeyInput: string) {
      const cart = await ensureGuestActiveCart(sessionKeyInput);
      const normalized = await recalculateCartFromState(cart);
      return { data: normalized };
    },

    async listGuestCartRecommendations(sessionKeyInput: string, query: any = {}) {
      const cart = await ensureGuestActiveCart(sessionKeyInput);
      return listCartRecommendationsPayload(cart, query);
    },

    async addGuestCartItem(sessionKeyInput: string, payload: any) {
      const cart = await ensureGuestActiveCart(sessionKeyInput);
      const normalized = await addItemToCart(cart.id, payload, cart);
      return { data: normalized };
    },

    async updateGuestCartItem(sessionKeyInput: string, itemId: number, payload: any) {
      const cart = await ensureGuestActiveCart(sessionKeyInput);
      const normalized = await updateCartItemQty(cart.id, itemId, payload, cart);
      return { data: normalized };
    },

    async removeGuestCartItem(sessionKeyInput: string, itemId: number) {
      const cart = await ensureGuestActiveCart(sessionKeyInput);
      const normalized = await removeCartItem(cart.id, itemId, cart);
      return { data: normalized };
    },

    async applyGuestCoupon(sessionKeyInput: string, payload: any) {
      const cart = await ensureGuestActiveCart(sessionKeyInput);
      const normalized = await applyCouponToCart(cart.id, payload?.code, cart);
      return { data: normalized };
    },

    async clearGuestCoupon(sessionKeyInput: string) {
      const cart = await ensureGuestActiveCart(sessionKeyInput);
      const normalized = await clearCouponFromCart(cart.id, cart);
      return { data: normalized };
    },

    async checkoutGuest(sessionKeyInput: string, payload: any) {
      const cart = await ensureGuestActiveCart(sessionKeyInput);
      const result = await checkoutCart(cart.id, payload, null, 'guest');
      return {
        data: result,
      };
    },

    async getOrCreateUserCart(userId: number) {
      const cart = await ensureUserActiveCart(userId);
      const normalized = await recalculateCartFromState(cart);
      return { data: normalized };
    },

    async listUserCartRecommendations(userId: number, query: any = {}) {
      const cart = await ensureUserActiveCart(userId);
      return listCartRecommendationsPayload(cart, query);
    },

    async adoptGuestCart(userId: number, sessionKeyInput: string) {
      const sessionKey = normalizeSessionKey(sessionKeyInput);
      if (!sessionKey) {
        return this.getOrCreateUserCart(userId);
      }

      const guestCart = await findActiveGuestCart(sessionKey);
      const guestItems: any[] = guestCart?.items || [];

      if (!guestCart || guestItems.length === 0) {
        return this.getOrCreateUserCart(userId);
      }

      const userCart = await ensureUserActiveCart(userId);
      const userItems: any[] = userCart.items || [];

      for (const gi of guestItems) {
        const guestVariantKey = buildVariantIdentityKey(gi.variant);
        const productId = gi.product?.id;
        if (!productId) continue;

        const existing = userItems.find(
          (ui: any) =>
            ui.product?.id === productId &&
            buildVariantIdentityKey(ui.variant) === guestVariantKey
        );

        if (existing) {
          const newQty = toInt(existing.qty, 1) + toInt(gi.qty, 1);
          const unitPrice = roundMoney(toNumber(existing.unitPrice, 0) || toNumber(gi.unitPrice, 0));
          await strapi.db.query(CART_ITEM_UID).update({
            where: { id: existing.id },
            data: { qty: newQty, lineTotal: roundMoney(unitPrice * newQty) },
          });
        } else {
          const unitPrice = roundMoney(toNumber(gi.unitPrice, 0));
          await strapi.db.query(CART_ITEM_UID).create({
            data: {
              cart: userCart.id,
              product: productId,
              qty: toInt(gi.qty, 1),
              unitPrice,
              lineTotal: roundMoney(unitPrice * toInt(gi.qty, 1)),
              variant: gi.variant || null,
              notes: gi.notes || null,
            },
          });
        }
      }

      // Mark guest cart as converted so it won't be picked up again
      await strapi.db.query(CART_UID).update({
        where: { id: guestCart.id },
        data: { statusCart: 'converted' },
      });

      return this.getOrCreateUserCart(userId);
    },

    async addUserCartItem(userId: number, payload: any) {
      const cart = await ensureUserActiveCart(userId);
      const normalized = await addItemToCart(cart.id, payload, cart);
      return { data: normalized };
    },

    async getUserProfile(userId: number) {
      return getUserProfilePayload(userId);
    },

    async updateUserProfile(userId: number, payload: any) {
      if (!isObject(payload)) {
        throwHttpError(400, 'Profile payload must be an object');
      }

      const firstNameFields = ['firstName', 'nombre', 'name', 'givenName'];
      const lastNameFields = ['lastName', 'apellido', 'surname', 'familyName'];
      const phoneFields = ['phone', 'telefono', 'mobile', 'cellphone'];
      const documentFields = ['documentIdNumber', 'document', 'documento'];
      const birthDateFields = ['birthDate', 'birthdate', 'fechaNacimiento'];

      const data: any = {};

      if (hasOwnField(payload, firstNameFields)) {
        const firstName = pickFirstNonEmpty(firstNameFields.map((field) => payload?.[field]));
        if (!firstName) {
          throwHttpError(400, 'firstName cannot be empty');
        }
        data.firstName = firstName;
      }

      if (hasOwnField(payload, lastNameFields)) {
        const lastName = pickFirstNonEmpty(lastNameFields.map((field) => payload?.[field]));
        if (!lastName) {
          throwHttpError(400, 'lastName cannot be empty');
        }
        data.lastName = lastName;
      }

      if (hasOwnField(payload, phoneFields)) {
        const phone = pickFirstNonEmpty(phoneFields.map((field) => payload?.[field]));
        data.phone = phone || null;
      }

      if (hasOwnField(payload, documentFields)) {
        const documentValue = pickFirstNonEmpty(documentFields.map((field) => payload?.[field]));
        data.documentIdNumber = documentValue || null;
      }

      if (hasOwnField(payload, birthDateFields)) {
        data.birthDate = normalizeDateInput(pickFirstNonEmpty(birthDateFields.map((field) => payload?.[field])));
      }

      if (Object.keys(data).length > 0) {
        await strapi.db.query(USER_UID).update({
          where: { id: userId },
          data,
        });
      }

      return getUserProfilePayload(userId);
    },

    async getUserMembership(userId: number) {
      return getUserMembershipPayload(userId);
    },

    async updateUserMembership(userId: number, payload: any) {
      if (!isObject(payload)) {
        throwHttpError(400, 'Membership payload must be an object');
      }

      let targetTier: 'free' | 'premium' | null = null;

      if (hasOwnField(payload, ['tier', 'plan'])) {
        const value = normalizeText(payload.tier ?? payload.plan).toLowerCase();
        if (value === 'free' || value === 'premium') {
          targetTier = value;
        } else {
          throwHttpError(400, 'tier must be free or premium');
        }
      }

      if (hasOwnField(payload, ['membershipId', 'planId'])) {
        const membershipId = toInt(payload.membershipId ?? payload.planId, 0);
        if (membershipId <= 0) {
          throwHttpError(400, 'membershipId must be a valid id');
        }

        const membership = await strapi.db.query(MEMBERSHIP_UID).findOne({
          where: { id: membershipId, publishedAt: { $notNull: true } },
        });
        if (!membership) {
          throwHttpError(404, 'Membership plan not found');
        }

        targetTier = resolveMembershipTierFromName(membership.name);
      }

      if (!targetTier) {
        throwHttpError(400, 'tier or membershipId is required');
      }

      const now = new Date().toISOString();
      const updateData: any = {
        membershipTier: targetTier,
      };

      if (targetTier === 'premium') {
        updateData.membershipStartedAt = normalizeDateTimeInput(payload.membershipStartedAt) || now;
      } else {
        updateData.membershipStartedAt = null;
      }

      const currentUser = await strapi.db.query(USER_UID).findOne({
        where: { id: userId },
        select: ['membershipTier'],
      });
      const fromTier: 'free' | 'premium' = currentUser?.membershipTier === 'premium' ? 'premium' : 'free';

      await strapi.db.query(USER_UID).update({
        where: { id: userId },
        data: updateData,
      });

      let event: 'subscribed' | 'cancelled' | 'renewed' = 'subscribed';
      if (targetTier === 'free') {
        event = 'cancelled';
      } else if (fromTier === 'premium') {
        event = 'renewed';
      }

      try {
        await strapi.db.query(MEMBERSHIP_LOG_UID).create({
          data: {
            user: userId,
            event,
            fromTier,
            toTier: targetTier,
            amount: targetTier === 'premium' ? 75 : 0,
            notes: payload?.notes || null,
          },
        });
      } catch (_logErr) {
        strapi.log.warn('[membership] could not create membership-log entry');
      }

      return getUserMembershipPayload(userId);
    },

    async getUserPreferences(userId: number) {
      return getUserPreferencesPayload(userId);
    },

    async updateUserPreferences(userId: number, payload: any) {
      if (!isObject(payload)) {
        throwHttpError(400, 'Preferences payload must be an object');
      }

      const data: any = {};

      if (hasOwnField(payload, ['language', 'idioma'])) {
        const language = normalizeText(payload.language ?? payload.idioma).toLowerCase();
        if (!['es', 'en'].includes(language)) {
          throwHttpError(400, 'language must be es or en');
        }
        data.preferredLanguage = language;
      }

      if (hasOwnField(payload, ['currency', 'moneda'])) {
        const currency = normalizeText(payload.currency ?? payload.moneda).toUpperCase();
        if (!['GTQ', 'USD'].includes(currency)) {
          throwHttpError(400, 'currency must be GTQ or USD');
        }
        data.preferredCurrency = currency;
      }

      if (hasOwnField(payload, ['timeZone', 'timezone', 'zonaHoraria'])) {
        const timeZone = normalizeText(payload.timeZone ?? payload.timezone ?? payload.zonaHoraria);
        if (!timeZone) {
          throwHttpError(400, 'timeZone cannot be empty');
        }
        data.timeZone = timeZone;
      }

      const notifications = isObject(payload.notifications) ? payload.notifications : {};
      const orderUpdatesValue = payload.orderUpdates ?? payload.notificacionesPedidos ?? notifications.orderUpdates;
      const promotionsValue = payload.promotions ?? payload.promociones ?? notifications.promotions;
      const newsletterValue = payload.newsletter ?? payload.boletin ?? notifications.newsletter;
      const twoFactorValue = payload.twoFactorEnabled ?? payload.twoFactor ?? payload.dosFactores;

      if (orderUpdatesValue !== undefined) {
        const parsed = normalizeBooleanInput(orderUpdatesValue);
        if (parsed === null) {
          throwHttpError(400, 'orderUpdates must be a boolean');
        }
        data.notifyOrderUpdates = parsed;
      }

      if (promotionsValue !== undefined) {
        const parsed = normalizeBooleanInput(promotionsValue);
        if (parsed === null) {
          throwHttpError(400, 'promotions must be a boolean');
        }
        data.notifyPromotions = parsed;
      }

      if (newsletterValue !== undefined) {
        const parsed = normalizeBooleanInput(newsletterValue);
        if (parsed === null) {
          throwHttpError(400, 'newsletter must be a boolean');
        }
        data.notifyNewsletter = parsed;
      }

      if (twoFactorValue !== undefined) {
        const parsed = normalizeBooleanInput(twoFactorValue);
        if (parsed === null) {
          throwHttpError(400, 'twoFactorEnabled must be a boolean');
        }
        data.twoFactorEnabled = parsed;
      }

      if (Object.keys(data).length > 0) {
        await strapi.db.query(USER_UID).update({
          where: { id: userId },
          data,
        });
      }

      return getUserPreferencesPayload(userId);
    },

    async listUserAddresses(userId: number) {
      const addresses = await strapi.db.query(ADDRESS_UID).findMany({
        where: { owner: { id: userId } },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      return {
        data: (addresses || []).map(serializeAddress),
      };
    },

    async createUserAddress(userId: number, payload: any) {
      const data = sanitizeAddressPayload(payload, true);
      const existing = await strapi.db.query(ADDRESS_UID).findMany({
        where: { owner: { id: userId } },
      });
      const shouldSetDefault = data.isDefault === true || existing.length === 0;

      if (shouldSetDefault) {
        await clearUserDefaultAddresses(userId);
      }

      const created = await strapi.db.query(ADDRESS_UID).create({
        data: {
          ...data,
          isDefault: shouldSetDefault,
          owner: userId,
        },
      });

      const address = await strapi.db.query(ADDRESS_UID).findOne({ where: { id: created.id } });
      return {
        data: serializeAddress(address),
      };
    },

    async updateUserAddress(userId: number, addressId: number, payload: any) {
      const address = await strapi.db.query(ADDRESS_UID).findOne({
        where: {
          id: addressId,
          owner: { id: userId },
        },
      });

      if (!address) {
        throwHttpError(404, 'Address not found');
      }

      const data = sanitizeAddressPayload(payload, false);
      if (data.isDefault === true) {
        await clearUserDefaultAddresses(userId, address.id);
      }

      await strapi.db.query(ADDRESS_UID).update({
        where: { id: address.id },
        data,
      });

      await ensureUserHasDefaultAddress(userId);

      const updated = await strapi.db.query(ADDRESS_UID).findOne({ where: { id: address.id } });
      return {
        data: serializeAddress(updated),
      };
    },

    async deleteUserAddress(userId: number, addressId: number) {
      const address = await strapi.db.query(ADDRESS_UID).findOne({
        where: {
          id: addressId,
          owner: { id: userId },
        },
      });

      if (!address) {
        throwHttpError(404, 'Address not found');
      }

      await strapi.db.query(ADDRESS_UID).delete({
        where: { id: address.id },
      });

      await ensureUserHasDefaultAddress(userId);

      return {
        data: { removed: true, id: address.id },
      };
    },

    async listUserPets(userId: number) {
      const pets = await strapi.db.query(PET_PROFILE_UID).findMany({
        where: { owner: { id: userId } },
        populate: petPopulate,
        orderBy: { createdAt: 'desc' },
      });

      return {
        data: (pets || []).map((pet: any) => {
          const normalizedWeight = toNumber(pet.weightKg, Number.NaN);
          return {
            ...serializePet(pet),
            weightKg: Number.isFinite(normalizedWeight) ? normalizedWeight : null,
          };
        }),
      };
    },

    async createUserPet(userId: number, payload: any) {
      const data = sanitizePetPayload(payload, true);
      const created = await strapi.entityService.create(PET_PROFILE_UID, {
        data: {
          ...toPetMutationData(data),
          owner: userId,
        },
      });

      const pet = await strapi.db.query(PET_PROFILE_UID).findOne({
        where: { id: created.id },
        populate: petPopulate,
      });

      return {
        data: serializePet(pet),
      };
    },

    async updateUserPet(userId: number, petId: number, payload: any) {
      const existing = await strapi.db.query(PET_PROFILE_UID).findOne({
        where: {
          id: petId,
          owner: { id: userId },
        },
      });

      if (!existing) {
        throwHttpError(404, 'Pet not found');
      }

      const data = sanitizePetPayload(payload, false);
      await strapi.entityService.update(PET_PROFILE_UID, existing.id, {
        data: toPetMutationData(data),
      });

      const pet = await strapi.db.query(PET_PROFILE_UID).findOne({
        where: { id: existing.id },
        populate: petPopulate,
      });

      return {
        data: serializePet(pet),
      };
    },

    async linkUserPetAvatar(userId: number, petId: number, fileId: number) {
      if (!fileId) {
        throwHttpError(400, 'Se requiere el ID del archivo subido');
      }

      const existing = await strapi.db.query(PET_PROFILE_UID).findOne({
        where: {
          id: petId,
          owner: { id: userId },
        },
      });

      if (!existing) {
        throwHttpError(404, 'Pet not found');
      }

      await strapi.entityService.update(PET_PROFILE_UID, existing.id, {
        data: toPetMutationData({
          avatar: fileId,
        }),
      });

      const pet = await strapi.db.query(PET_PROFILE_UID).findOne({
        where: { id: existing.id },
        populate: petPopulate,
      });

      return {
        data: serializePet(pet),
      };
    },

    async deleteUserPetAvatar(userId: number, petId: number) {
      const existing = await strapi.db.query(PET_PROFILE_UID).findOne({
        where: {
          id: petId,
          owner: { id: userId },
        },
      });

      if (!existing) {
        throwHttpError(404, 'Pet not found');
      }

      await strapi.entityService.update(PET_PROFILE_UID, existing.id, {
        data: toPetMutationData({
          avatar: null,
        }),
      });

      const pet = await strapi.db.query(PET_PROFILE_UID).findOne({
        where: { id: existing.id },
        populate: petPopulate,
      });

      return {
        data: serializePet(pet),
      };
    },

    async deleteUserPet(userId: number, petId: number) {
      const existing = await strapi.db.query(PET_PROFILE_UID).findOne({
        where: {
          id: petId,
          owner: { id: userId },
        },
      });

      if (!existing) {
        throwHttpError(404, 'Pet not found');
      }

      await strapi.db.query(PET_PROFILE_UID).delete({
        where: { id: existing.id },
      });

      return {
        data: { removed: true, id: existing.id },
      };
    },

    async deleteUserAccount(userId: number) {
      const user = await strapi.db.query(USER_UID).findOne({ where: { id: userId } });
      if (!user) {
        throwHttpError(404, 'User not found');
      }

      const suffix = `${userId}_${Date.now()}`;
      const activeCarts = await strapi.db.query(CART_UID).findMany({
        where: {
          user: { id: userId },
          statusCart: 'active',
        },
      });

      await strapi.db.query(USER_UID).update({
        where: { id: userId },
        data: {
          blocked: true,
          confirmed: false,
          email: `deleted_${suffix}@deleted.local`,
          username: `deleted_${suffix}`,
          firstName: null,
          lastName: null,
          phone: null,
          documentIdNumber: null,
          birthDate: null,
        },
      });

      await Promise.all(
        (activeCarts || []).map((cart: any) =>
          strapi.db.query(CART_UID).update({
            where: { id: cart.id },
            data: {
              statusCart: 'locked',
              expiresAt: toIsoNow(),
            },
          })
        )
      );

      return {
        data: {
          deleted: true,
          blocked: true,
        },
      };
    },

    async updateUserCartItem(userId: number, itemId: number, payload: any) {
      const cart = await ensureUserActiveCart(userId);
      const normalized = await updateCartItemQty(cart.id, itemId, payload, cart);
      return { data: normalized };
    },

    async removeUserCartItem(userId: number, itemId: number) {
      const cart = await ensureUserActiveCart(userId);
      const normalized = await removeCartItem(cart.id, itemId, cart);
      return { data: normalized };
    },

    async applyUserCoupon(userId: number, payload: any) {
      const cart = await ensureUserActiveCart(userId);
      const normalized = await applyCouponToCart(cart.id, payload?.code, cart);
      return { data: normalized };
    },

    async clearUserCoupon(userId: number) {
      const cart = await ensureUserActiveCart(userId);
      const normalized = await clearCouponFromCart(cart.id, cart);
      return { data: normalized };
    },

    async checkoutUser(userId: number, payload: any) {
      const cart = await ensureUserActiveCart(userId);
      const result = await checkoutCart(cart.id, payload, userId, 'user');
      return {
        data: result,
      };
    },

    async listUserOrders(userId: number, query: any = {}) {
      const page = Math.max(1, toInt(query.page, 1));
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, toInt(query.pageSize, 20)));
      const offset = (page - 1) * pageSize;

      const where = {
        user: { id: userId },
      };

      const [orders, total] = await Promise.all([
        strapi.db.query(ORDER_UID).findMany({
          where,
          populate: orderPopulate,
          orderBy: { createdAt: 'desc' },
          offset,
          limit: pageSize,
        }),
        strapi.db.query(ORDER_UID).count({ where }),
      ]);

      return {
        data: (orders || []).map(serializeOrder),
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount: Math.ceil(total / pageSize) || 1,
            total,
          },
        },
      };
    },

    async getUserOrderById(userId: number, orderId: number) {
      const order = await strapi.db.query(ORDER_UID).findOne({
        where: {
          id: orderId,
          user: { id: userId },
        },
        populate: orderPopulate,
      });

      if (!order) {
        throwHttpError(404, 'Order not found');
      }

      return {
        data: serializeOrder(order),
      };
    },

    // ── Portal Operativo ────────────────────────────────────────────────
    async getOpsMetrics() {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const [totalOrders, pendingOrders, ordersToday, revenueAgg, recentRaw] = await Promise.all([
        strapi.db.query('api::order.order').count({}),
        strapi.db.query('api::order.order').count({ where: { statusOrder: { $in: ['pending', 'processing'] } } }),
        strapi.db.query('api::order.order').count({ where: { createdAt: { $gte: startOfDay } } }),
        strapi.db.query('api::order.order').findMany({
          where: { createdAt: { $gte: startOfMonth } },
          select: ['grandTotal'],
        }),
        strapi.db.query('api::order.order').findMany({
          orderBy: { createdAt: 'desc' },
          limit: 10,
          populate: { customer: { select: ['username', 'email'] } },
        }),
      ]);

      const revenueMonth = (revenueAgg as any[]).reduce((sum: number, o: any) => sum + toNumber(o.grandTotal, 0), 0);

      const recentOrders = (recentRaw as any[]).map((o: any) => ({
        id: o.id,
        orderNumber: o.orderNumber || o.oderNumber,
        email: o.email,
        grandTotal: roundMoney(toNumber(o.grandTotal, 0)),
        statusOrder: o.statusOrder,
        createdAt: o.createdAt,
        customerName: o.customer ? (o.customer.username || o.customer.email) : undefined,
      }));

      return {
        data: {
          totalOrders,
          revenueMonth: roundMoney(revenueMonth),
          pendingOrders,
          ordersToday,
          recentOrders,
        },
      };
    },

    async listOpsOrders(page: number, pageSize: number, status?: string) {
      const where: any = {};
      if (status) where.statusOrder = status;

      const [orders, total] = await Promise.all([
        strapi.db.query('api::order.order').findMany({
          where,
          orderBy: { createdAt: 'desc' },
          limit: pageSize,
          offset: (page - 1) * pageSize,
          populate: {
            customer: { select: ['username', 'email'] },
            order_items: { select: ['nameSnapshot', 'qty', 'unitPrice', 'lineTotal'] },
          },
        }),
        strapi.db.query('api::order.order').count({ where }),
      ]);

      return {
        data: (orders as any[]).map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber || o.oderNumber,
          email: o.email,
          grandTotal: roundMoney(toNumber(o.grandTotal, 0)),
          statusOrder: o.statusOrder,
          createdAt: o.createdAt,
          customerName: o.customer ? (o.customer.username || o.customer.email) : undefined,
          paymentKind: o.paymentKind,
          shippingAddress: o.shippingAddress ? {
            line1: o.shippingAddress.line1,
            city: o.shippingAddress.municipality || o.shippingAddress.city,
            country: o.shippingAddress.country,
          } : undefined,
          items: (o.order_items || []).map((item: any) => ({
            nameSnapshot: item.nameSnapshot,
            qty: item.qty,
            unitPrice: roundMoney(toNumber(item.unitPrice, 0)),
            lineTotal: roundMoney(toNumber(item.lineTotal, 0)),
          })),
        })),
        meta: {
          pagination: {
            page,
            pageSize,
            total,
            pageCount: Math.ceil(total / pageSize),
          },
        },
      };
    },

    async getOpsOrderById(id: number) {
      const order = await strapi.db.query('api::order.order').findOne({
        where: { id },
        populate: {
          customer: { select: ['username', 'email'] },
          order_items: { select: ['nameSnapshot', 'qty', 'unitPrice', 'lineTotal', 'sku'] },
          statusLogs: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!order) throwHttpError(404, 'Order not found');

      const o = order as any;
      return {
        data: {
          id: o.id,
          orderNumber: o.orderNumber || o.oderNumber,
          email: o.email,
          subtotal: roundMoney(toNumber(o.subtotal, 0)),
          shippingTotal: roundMoney(toNumber(o.shippingTotal, 0)),
          discountTotal: roundMoney(toNumber(o.discountTotal, 0)),
          grandTotal: roundMoney(toNumber(o.grandTotal, 0)),
          statusOrder: o.statusOrder,
          createdAt: o.createdAt,
          customerName: o.customer ? (o.customer.username || o.customer.email) : undefined,
          paymentKind: o.paymentKind,
          shippingAddress: o.shippingAddress ? {
            fullName: o.shippingAddress.fullName || o.shippingAddress.firstName || undefined,
            line1: o.shippingAddress.line1,
            line2: o.shippingAddress.line2 || undefined,
            municipality: o.shippingAddress.municipality || undefined,
            department: o.shippingAddress.department || undefined,
            zipCode: o.shippingAddress.zipCode || undefined,
            country: o.shippingAddress.country,
          } : undefined,
          items: (o.order_items || []).map((item: any) => ({
            nameSnapshot: item.nameSnapshot,
            sku: item.sku || null,
            qty: item.qty,
            unitPrice: roundMoney(toNumber(item.unitPrice, 0)),
            lineTotal: roundMoney(toNumber(item.lineTotal, 0)),
          })),
          statusLogs: (o.statusLogs || []).map((log: any) => ({
            id: log.id,
            status: log.status,
            note: log.note || null,
            changedBy: log.changedBy || null,
            createdAt: log.createdAt,
          })),
        },
      };
    },

    async updateOpsOrderStatus(id: number, status: string, note?: string, changedBy?: string) {
      const VALID = ['pending', 'processing', 'confirmed', 'shipped', 'delivered', 'cancelled'];
      if (!VALID.includes(status)) throwHttpError(400, 'Invalid status');

      // Map 'confirmed' → 'paid' for the schema enum (ops uses 'confirmed', schema has 'paid')
      const schemaStatus = status === 'confirmed' ? 'paid' : status;
      await strapi.db.query('api::order.order').update({ where: { id }, data: { statusOrder: schemaStatus } });

      // Crear log del cambio de status
      try {
        await strapi.db.query(ORDER_STATUS_LOG_UID).create({
          data: {
            order: id,
            status: schemaStatus,
            note: note || null,
            changedBy: changedBy || 'ops',
          },
        });
      } catch (err) {
        strapi.log.warn('Error creando log de status:', err);
      }

      const updated = await strapi.db.query('api::order.order').findOne({ where: { id } });
      const o = updated as any;
      return { data: { id: o.id, orderNumber: o.orderNumber || o.oderNumber, statusOrder: o.statusOrder } };
    },

    async getOpsMetricsEnhanced(period: 'today' | 'week' | 'month' = 'month') {
      const now = new Date();
      const ACTIVE = { statusOrder: { $notIn: ['cancelled', 'refunded'] } };

      // Determine period start and previous period bounds
      let periodStart: Date, prevStart: Date, prevEnd: Date;
      if (period === 'today') {
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        prevStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        prevEnd     = periodStart;
      } else if (period === 'week') {
        // Monday as first day of week
        const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
        prevStart   = new Date(periodStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        prevEnd     = periodStart;
      } else {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        prevStart   = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEnd     = periodStart;
      }

      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const periodStartISO = periodStart.toISOString();
      const prevStartISO   = prevStart.toISOString();
      const prevEndISO     = prevEnd.toISOString();

      const [
        totalOrders, pendingOrders, processingOrders, shippedOrders, ordersToday,
        cancelledCount, currentOrders, prevOrders, membershipCount, recentRaw,
      ] = await Promise.all([
        strapi.db.query('api::order.order').count({}),
        strapi.db.query('api::order.order').count({ where: { statusOrder: 'pending' } }),
        strapi.db.query('api::order.order').count({ where: { statusOrder: 'processing' } }),
        strapi.db.query('api::order.order').count({ where: { statusOrder: 'shipped' } }),
        strapi.db.query('api::order.order').count({ where: { createdAt: { $gte: startOfDay } } }),
        strapi.db.query('api::order.order').count({ where: { statusOrder: 'cancelled' } }),
        strapi.db.query('api::order.order').findMany({ where: { createdAt: { $gte: periodStartISO }, ...ACTIVE }, select: ['grandTotal'] }),
        strapi.db.query('api::order.order').findMany({ where: { createdAt: { $gte: prevStartISO, $lt: prevEndISO }, ...ACTIVE }, select: ['grandTotal'] }),
        strapi.db.query('api::order.order').count({ where: { membershipApplied: true, createdAt: { $gte: periodStartISO } } }),
        strapi.db.query('api::order.order').findMany({ orderBy: { createdAt: 'desc' }, limit: 10, populate: { customer: { select: ['username', 'email'] } } }),
      ]);

      const sum = (rows: any[]) => rows.reduce((s, o) => s + toNumber(o.grandTotal, 0), 0);
      const revenuePeriod = roundMoney(sum(currentOrders as any[]));
      const revenuePrev   = roundMoney(sum(prevOrders as any[]));
      const avgOrderValue = (currentOrders as any[]).length > 0
        ? roundMoney(revenuePeriod / (currentOrders as any[]).length)
        : 0;
      const cancellationRate = (totalOrders as number) > 0
        ? Math.round(((cancelledCount as number) / (totalOrders as number)) * 100 * 10) / 10
        : 0;

      const recentOrders = (recentRaw as any[]).map((o: any) => ({
        id: o.id,
        orderNumber: o.orderNumber || o.oderNumber,
        email: o.email,
        grandTotal: roundMoney(toNumber(o.grandTotal, 0)),
        statusOrder: o.statusOrder,
        createdAt: o.createdAt,
        customerName: o.customer ? (o.customer.username || o.customer.email) : undefined,
      }));

      return {
        data: {
          period,
          totalOrders,
          revenueMonth: revenuePeriod,    // kept for backwards compat
          revenueLastMonth: revenuePrev,  // kept for backwards compat
          revenuePeriod,
          revenuePrev,
          avgOrderValue,
          pendingOrders, processingOrders, shippedOrders, ordersToday,
          cancellationRate, membershipOrdersCount: membershipCount, recentOrders,
          revenueToday: revenuePeriod,    // kept for backwards compat
          revenueYesterday: revenuePrev,  // kept for backwards compat
        },
      };
    },

    async getOpsSalesReport(from: string, to: string) {
      const ACTIVE = { statusOrder: { $notIn: ['cancelled', 'refunded'] } };
      const where: any = { ...ACTIVE };
      if (from) where.createdAt = { ...where.createdAt, $gte: from };
      if (to) where.createdAt = { ...where.createdAt, $lte: to };

      const orders = await strapi.db.query('api::order.order').findMany({
        where,
        select: ['grandTotal', 'subtotal', 'shippingTotal', 'discountTotal', 'createdAt', 'membershipApplied'],
        orderBy: { createdAt: 'asc' },
        limit: 10000,
      }) as any[];

      // Group by day
      const byDay: Record<string, { ordersCount: number; grossRevenue: number; shippingRevenue: number; totalDiscounts: number; netRevenue: number }> = {};
      let totals = { ordersCount: 0, grossRevenue: 0, shippingRevenue: 0, totalDiscounts: 0, netRevenue: 0 };
      const byPayment: Record<string, { count: number; revenue: number }> = {};
      let membershipOrdersCount = 0;

      for (const o of orders) {
        const day = String(o.createdAt || '').slice(0, 10);
        const gross = toNumber(o.grandTotal, 0);
        const shipping = toNumber(o.shippingTotal, 0);
        const discount = toNumber(o.discountTotal, 0);
        const net = gross - discount;

        if (!byDay[day]) byDay[day] = { ordersCount: 0, grossRevenue: 0, shippingRevenue: 0, totalDiscounts: 0, netRevenue: 0 };
        byDay[day].ordersCount++;
        byDay[day].grossRevenue += gross;
        byDay[day].shippingRevenue += shipping;
        byDay[day].totalDiscounts += discount;
        byDay[day].netRevenue += net;

        totals.ordersCount++;
        totals.grossRevenue += gross;
        totals.shippingRevenue += shipping;
        totals.totalDiscounts += discount;
        totals.netRevenue += net;

        const kind = String(o.paymentKind || 'other');
        if (!byPayment[kind]) byPayment[kind] = { count: 0, revenue: 0 };
        byPayment[kind].count++;
        byPayment[kind].revenue += gross;

        if (o.membershipApplied) membershipOrdersCount++;
      }

      const periods = Object.entries(byDay).map(([period, vals]) => ({
        period,
        ordersCount: vals.ordersCount,
        grossRevenue: roundMoney(vals.grossRevenue),
        shippingRevenue: roundMoney(vals.shippingRevenue),
        totalDiscounts: roundMoney(vals.totalDiscounts),
        netRevenue: roundMoney(vals.netRevenue),
        avgOrderValue: vals.ordersCount > 0 ? roundMoney(vals.grossRevenue / vals.ordersCount) : 0,
      }));

      return {
        data: {
          periods,
          totals: {
            ordersCount: totals.ordersCount,
            grossRevenue: roundMoney(totals.grossRevenue),
            shippingRevenue: roundMoney(totals.shippingRevenue),
            totalDiscounts: roundMoney(totals.totalDiscounts),
            netRevenue: roundMoney(totals.netRevenue),
            avgOrderValue: totals.ordersCount > 0 ? roundMoney(totals.grossRevenue / totals.ordersCount) : 0,
          },
          byPaymentKind: Object.entries(byPayment).map(([kind, v]) => ({
            kind, count: v.count, revenue: roundMoney(v.revenue),
          })),
          membershipOrdersCount,
        },
      };
    },

    async getOpsTopProducts(from: string, to: string, limit = 20) {
      const ACTIVE = { statusOrder: { $notIn: ['cancelled', 'refunded'] } };
      const where: any = { order: { ...ACTIVE } };
      if (from || to) {
        where.order.createdAt = {};
        if (from) where.order.createdAt.$gte = from;
        if (to) where.order.createdAt.$lte = to;
      }

      const items = await strapi.db.query('api::order-item.order-item').findMany({
        where,
        select: ['nameSnapshot', 'sku', 'qty', 'lineTotal'],
        limit: 50000,
      }) as any[];

      const byProduct: Record<string, { totalQty: number; totalRevenue: number; ordersCount: number }> = {};
      for (const item of items) {
        const key = `${item.nameSnapshot}|${item.sku || ''}`;
        if (!byProduct[key]) byProduct[key] = { totalQty: 0, totalRevenue: 0, ordersCount: 0 };
        byProduct[key].totalQty += toInt(item.qty, 0);
        byProduct[key].totalRevenue += toNumber(item.lineTotal, 0);
        byProduct[key].ordersCount++;
      }

      const products = Object.entries(byProduct)
        .map(([key, vals]) => {
          const [name, sku] = key.split('|');
          return { name, sku: sku || undefined, totalQty: vals.totalQty, totalRevenue: roundMoney(vals.totalRevenue), ordersCount: vals.ordersCount };
        })
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit);

      return { data: products };
    },

    async getOpsTopCustomers(from: string, to: string, limit = 20) {
      const ACTIVE = { statusOrder: { $notIn: ['cancelled', 'refunded'] } };
      const where: any = { ...ACTIVE };
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.$gte = from;
        if (to) where.createdAt.$lte = to;
      }

      const orders = await strapi.db.query('api::order.order').findMany({
        where,
        select: ['email', 'grandTotal', 'createdAt'],
        populate: { customer: { select: ['username'] } },
        limit: 50000,
      }) as any[];

      const byCustomer: Record<string, { customerName?: string; ordersCount: number; totalSpent: number; lastOrderAt: string }> = {};
      for (const o of orders) {
        const email = String(o.email || '');
        if (!byCustomer[email]) {
          byCustomer[email] = {
            customerName: o.customer?.username || undefined,
            ordersCount: 0, totalSpent: 0, lastOrderAt: o.createdAt,
          };
        }
        byCustomer[email].ordersCount++;
        byCustomer[email].totalSpent += toNumber(o.grandTotal, 0);
        if (o.createdAt > byCustomer[email].lastOrderAt) byCustomer[email].lastOrderAt = o.createdAt;
      }

      const customers = Object.entries(byCustomer)
        .map(([email, vals]) => ({
          email, customerName: vals.customerName, ordersCount: vals.ordersCount,
          totalSpent: roundMoney(vals.totalSpent), lastOrderAt: vals.lastOrderAt,
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, limit);

      return { data: customers };
    },

    async getOpsInventory() {
      const products = await strapi.db.query('api::product.product').findMany({
        select: ['id', 'name', 'sku', 'price', 'stock', 'variants', 'publishedAt'],
        populate: { brand: { select: ['name'] } },
        limit: 5000,
        orderBy: { name: 'asc' },
      }) as any[];

      let outOfStock = 0, lowStock = 0, noTracking = 0;

      const stockStatus = (stock: number | null | undefined) => {
        const tracked = stock !== null && stock !== undefined;
        return { tracked, out: tracked && stock === 0, low: tracked && (stock as number) > 0 && (stock as number) <= 5 };
      };

      const mapped = products.map((p: any) => {
        const normalizedVariants = normalizeProductVariants(p);
        const hasVariants = normalizedVariants.length > 0;

        const variants = normalizedVariants.map((v: any) => {
          const s = stockStatus(v.stock);
          if (!s.tracked) noTracking++;
          else if (s.out) outOfStock++;
          else if (s.low) lowStock++;
          return {
            id: v.id,
            label: v.label,
            sku: v.sku || undefined,
            price: roundMoney(toNumber(v.price, 0)),
            stock: v.stock as number,
            lowStockAlert: s.out || s.low,
          };
        });

        let productStock: number | null = null;
        if (!hasVariants) {
          const raw = p.stock;
          const tracked = raw !== null && raw !== undefined;
          productStock = tracked ? raw : null;
          const s = stockStatus(productStock);
          if (!tracked) noTracking++;
          else if (s.out) outOfStock++;
          else if (s.low) lowStock++;
        }

        return {
          id: p.id,
          name: p.name,
          sku: p.sku || undefined,
          price: roundMoney(toNumber(p.price, 0)),
          stock: hasVariants ? null : productStock,
          hasVariants,
          variants: hasVariants ? variants : [],
          brand: p.brand ? { name: p.brand.name } : undefined,
          lowStockAlert: hasVariants
            ? variants.some((v: any) => v.lowStockAlert)
            : (productStock === 0 || (productStock !== null && productStock <= 5)),
          isActive: Boolean(p.publishedAt),
        };
      });

      return {
        data: {
          summary: { totalProducts: products.length, outOfStock, lowStock, noTracking },
          products: mapped,
        },
      };
    },

    async bulkUpdateInventory(updates: Array<{ sku: string; stock: number }>) {
      if (!Array.isArray(updates) || updates.length === 0) {
        return { data: { updated: 0, notFound: [], errors: [] } };
      }

      const skuSet = new Set(updates.map(u => u.sku.trim()).filter(Boolean));
      const updateMap: Record<string, number> = {};
      for (const u of updates) {
        const sku = u.sku.trim();
        if (sku) updateMap[sku] = Math.floor(Math.max(0, Number(u.stock)));
      }

      // Validate quantities up front
      const errors: string[] = [];
      for (const u of updates) {
        const stock = Number(u.stock);
        if (isNaN(stock) || stock < 0) {
          errors.push(`${u.sku}: cantidad inválida`);
          skuSet.delete(u.sku.trim());
        }
      }

      // Fetch all products (product-level SKU match + variant JSON scan)
      const allProducts = await strapi.db.query('api::product.product').findMany({
        select: ['id', 'sku', 'stock', 'variants'],
        limit: 10000,
      }) as any[];

      const notFound = new Set<string>(skuSet);
      let updated = 0;

      for (const product of allProducts) {
        const productSku = (product.sku || '').trim();
        const rawVariants: any[] = Array.isArray(product.variants) ? product.variants : [];
        const hasVariants = rawVariants.length > 0;

        // --- Product-level SKU match ---
        if (!hasVariants && productSku && skuSet.has(productSku)) {
          try {
            await strapi.db.query('api::product.product').update({
              where: { id: product.id },
              data: { stock: updateMap[productSku] },
            });
            notFound.delete(productSku);
            updated++;
          } catch {
            errors.push(`${productSku}: error al actualizar`);
          }
          continue;
        }

        // --- Variant-level SKU match ---
        if (hasVariants) {
          let variantsChanged = false;
          const updatedVariants = rawVariants.map((v: any) => {
            const vSku = (v.sku || '').trim();
            if (vSku && skuSet.has(vSku)) {
              notFound.delete(vSku);
              variantsChanged = true;
              updated++;
              return { ...v, stock: updateMap[vSku] };
            }
            return v;
          });

          if (variantsChanged) {
            try {
              await strapi.db.query('api::product.product').update({
                where: { id: product.id },
                data: { variants: updatedVariants },
              });
            } catch {
              // Revert count on failure
              const failedSkus = rawVariants
                .filter((v: any) => (v.sku || '').trim() && skuSet.has((v.sku || '').trim()))
                .map((v: any) => (v.sku || '').trim());
              for (const s of failedSkus) {
                errors.push(`${s}: error al actualizar`);
                updated--;
              }
            }
          }
        }
      }

      return { data: { updated, notFound: [...notFound], errors } };
    },

    async getOpsFinances(year: number, month: number) {
      // month is 1-based (1=Jan)
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 1).toISOString();
      const ACTIVE = { statusOrder: { $notIn: ['cancelled', 'refunded'] } };

      const [orders, commissionOrders] = await Promise.all([
        strapi.db.query('api::order.order').findMany({
          where: { ...ACTIVE, createdAt: { $gte: startDate, $lt: endDate } },
          select: ['grandTotal', 'subtotal', 'shippingTotal', 'discountTotal', 'membershipApplied'],
          limit: 10000,
        }),
        strapi.db.query('api::order.order').findMany({
          where: { createdAt: { $gte: startDate, $lt: endDate }, affiliateCommissionAmount: { $gt: 0 } },
          select: ['affiliateCommissionAmount', 'affiliateCommissionType', 'affiliateCommissionValue', 'couponCode', 'grandTotal'],
          populate: { couponInfluencer: { select: ['username', 'email'] } },
          limit: 10000,
        }),
      ]) as [any[], any[]];

      let grossRevenue = 0, netRevenue = 0, totalDiscounts = 0, shippingRevenue = 0, membershipOrders = 0;
      const byPayment: Record<string, { count: number; revenue: number }> = {};

      for (const o of orders) {
        const gross = toNumber(o.grandTotal, 0);
        const discount = toNumber(o.discountTotal, 0);
        grossRevenue += gross;
        totalDiscounts += discount;
        netRevenue += gross - discount;
        shippingRevenue += toNumber(o.shippingTotal, 0);
        if (o.membershipApplied) membershipOrders++;
        const k = String(o.paymentKind || 'other');
        if (!byPayment[k]) byPayment[k] = { count: 0, revenue: 0 };
        byPayment[k].count++;
        byPayment[k].revenue += gross;
      }

      const commissions: Record<string, { influencerName: string; couponCode: string; ordersCount: number; totalCommission: number }> = {};
      for (const o of commissionOrders) {
        const name = o.couponInfluencer?.username || o.couponInfluencer?.email || 'Desconocido';
        const key = `${name}|${o.couponCode || ''}`;
        if (!commissions[key]) commissions[key] = { influencerName: name, couponCode: o.couponCode || '', ordersCount: 0, totalCommission: 0 };
        commissions[key].ordersCount++;
        commissions[key].totalCommission += toNumber(o.affiliateCommissionAmount, 0);
      }

      return {
        data: {
          year, month,
          grossRevenue: roundMoney(grossRevenue),
          netRevenue: roundMoney(netRevenue),
          totalDiscounts: roundMoney(totalDiscounts),
          shippingRevenue: roundMoney(shippingRevenue),
          ordersCount: orders.length,
          avgOrderValue: orders.length > 0 ? roundMoney(grossRevenue / orders.length) : 0,
          membershipOrdersCount: membershipOrders,
          byPaymentKind: Object.entries(byPayment).map(([kind, v]) => ({ kind, count: v.count, revenue: roundMoney(v.revenue) })),
          commissions: Object.values(commissions).map(c => ({ ...c, totalCommission: roundMoney(c.totalCommission) })),
        },
      };
    },
  };
};
