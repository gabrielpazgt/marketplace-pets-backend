import crypto from 'crypto';
import { getCatalogTaxonomyPayloadFromDatabase } from '../utils/catalog-taxonomy-db';
import { getCatalogTaxonomyPayload } from '../utils/catalog-taxonomy';

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
const CART_UID = 'api::cart.cart';
const CART_ITEM_UID = 'api::cart-item.cart-item';
const COUPON_UID = 'api::coupon.coupon';
const ORDER_UID = 'api::order.order';
const ORDER_ITEM_UID = 'api::order-item.order-item';

const DEFAULT_CURRENCY = 'GTQ';
const MAX_PAGE_SIZE = 100;
const PRODUCT_QUERY_TIMEOUT_MS = 8000;
const QUERY_CACHE_TTL_MS = 5000;
const QUERY_CACHE_MAX_ENTRIES = 300;
const DEFAULT_LANGUAGE = 'es';
const DEFAULT_TIME_ZONE = 'America/Guatemala';
const FREE_SHIPPING_THRESHOLD = 500;
const STANDARD_SHIPPING_PRICE = 25;
const EXPRESS_SHIPPING_PRICE = 45;
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
type PaymentKind = 'card' | 'bank';

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

const serializeProduct = (product: any) => ({
  id: product.id,
  documentId: product.documentId,
  name: product.name,
  slug: product.slug,
  description: product.description,
  price: roundMoney(toNumber(product.price, 0)),
  compareAtPrice: roundMoney(toNumber(product.compareAtPrice, 0)) || null,
  stock: toInt(product.stock, 0),
  isFeatured: Boolean(product.isFeatured),
  category: product.category,
  subcategory: normalizeText(product.subcategory) || null,
  form: product.form,
  proteinSource: product.proteinSource,
  weightMinKg: toNumber(product.weightMinKg, 0),
  weightMaxKg: toNumber(product.weightMaxKg, 999),
  publishedAt: product.publishedAt,
  images: product.images || [],
  brand: product.brand || null,
  speciesSupported: product.speciesSupported || [],
  lifeStages: product.lifeStages || [],
  diet_tags: product.diet_tags || [],
  health_claims: product.health_claims || [],
  ingredients: product.ingredients || [],
});

const serializeProductCompact = (product: any) => ({
  id: product.id,
  documentId: product.documentId,
  name: product.name,
  slug: product.slug,
  price: roundMoney(toNumber(product.price, 0)),
  compareAtPrice: roundMoney(toNumber(product.compareAtPrice, 0)) || null,
  stock: toInt(product.stock, 0),
  category: product.category,
  subcategory: normalizeText(product.subcategory) || null,
  publishedAt: product.publishedAt,
  images: product.images || [],
  brand: product.brand || null,
});

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
  const bucket = new Map<number, { id: number; documentId?: string; name: string; slug?: string | null; count: number }>();

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
      count: 1,
    });
  }

  return buildFacetEntries(Array.from(bucket.values()), 'name');
};

const buildShippingPolicy = (subtotal: number, discountTotal: number) => {
  const effectiveSubtotal = roundMoney(Math.max(0, subtotal - discountTotal));
  const amountToFreeShipping = roundMoney(Math.max(0, FREE_SHIPPING_THRESHOLD - effectiveSubtotal));
  const qualifiesForFreeShipping = amountToFreeShipping <= 0;
  const progressPct = Math.min(100, Math.round((effectiveSubtotal / FREE_SHIPPING_THRESHOLD) * 100));

  return {
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
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
  if (normalized === 'cod') {
    throwHttpError(400, 'paymentKind cod is not supported');
  }
  throwHttpError(400, 'paymentKind must be card or bank');
};

const resolveShippingTotal = (subtotal: number, discountTotal: number, method: ShippingMethod): number => {
  const effectiveSubtotal = roundMoney(Math.max(0, subtotal - discountTotal));
  if (effectiveSubtotal <= 0) return 0;
  if (method === 'express') return EXPRESS_SHIPPING_PRICE;
  return effectiveSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_PRICE;
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
  const productPrice = item?.product
    ? toNumber(item.product.price, toNumber(item?.unitPrice, 0))
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

const serializeCart = (cart: any) => ({
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
    roundMoney(toNumber(cart.discountTotal, 0))
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
    variant: item.variant || null,
    product: item.product
      ? {
          id: item.product.id,
          documentId: item.product.documentId,
          name: item.product.name,
          slug: item.product.slug,
          price: roundMoney(toNumber(item.product.price, 0)),
          stock: toInt(item.product.stock, 0),
          images: item.product.images || [],
          brand: serializeBrandSummary(item.product.brand || null),
        }
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
    order_items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      qty: toInt(item.qty, 1),
      unitPrice: roundMoney(toNumber(item.unitPrice, 0)),
      lineTotal: roundMoney(toNumber(item.lineTotal, 0)),
      nameSnapshot: item.nameSnapshot,
      sku: item.sku || null,
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

const serializeUserProfile = (user: any, stats: { orders: number; pets: number }) => ({
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
  const cartPopulate = {
    coupon: {
      populate: couponPopulate,
    },
    items: {
      populate: {
        product: {
          populate: {
            images: true,
            brand: true,
          },
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
  };

  const withTrx = (payload: any, trx: any) => (trx ? { ...payload, transacting: trx } : payload);

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
      const productPrice = item.product
        ? toNumber(item.product.price, toNumber(item.unitPrice, 0))
        : toNumber(item.unitPrice, 0);
      const unitPrice = roundMoney(Math.max(0, productPrice));
      const lineTotal = roundMoney(unitPrice * qty);
      subtotal += lineTotal;

      const storedUnitPrice = roundMoney(toNumber(item.unitPrice, 0));
      const storedLineTotal = roundMoney(toNumber(item.lineTotal, 0));

      if (storedUnitPrice !== unitPrice || storedLineTotal !== lineTotal || toInt(item.qty, 1) !== qty) {
        await strapi.db.query(CART_ITEM_UID).update({
          where: { id: item.id },
          data: {
            qty,
            unitPrice,
            lineTotal,
          },
        });
      }

      item.qty = qty;
      item.unitPrice = unitPrice;
      item.lineTotal = lineTotal;
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

    return serializeCart(cart);
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
        images: true,
        brand: true,
      },
    });

    if (!product) {
      throwHttpError(404, 'Producto no encontrado o no publicado');
    }

    const cart = currentCart || (await getCartById(cartId));
    if (!cart || cart.statusCart !== 'active') {
      throwHttpError(404, 'Carrito activo no encontrado');
    }

    const variant = isObject(payload?.variant) ? payload.variant : null;
    const notes = normalizeText(payload?.notes);
    const variantKey = JSON.stringify(variant || null);

    const existingItem = (cart.items || []).find((item: any) => {
      const itemProductId = getRelationId(item.product);
      return itemProductId === productId && JSON.stringify(item.variant || null) === variantKey;
    });

    const currentQty = existingItem ? toInt(existingItem.qty, 1) : 0;
    const targetQty = currentQty + qtyToAdd;

    if (toInt(product.stock, 0) < targetQty) {
      throwHttpError(400, 'No hay suficiente inventario para la cantidad solicitada');
    }

    const unitPrice = roundMoney(toNumber(product.price, 0));
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
      throwHttpError(400, 'El producto del carrito ya no está disponible');
    }

    if (toInt(item.product.stock, 0) < qty) {
      throwHttpError(400, 'No hay suficiente inventario para la cantidad solicitada');
    }

    const unitPrice = roundMoney(toNumber(item.product.price, toNumber(item.unitPrice, 0)));
    const lineTotal = roundMoney(unitPrice * qty);

    await strapi.db.query(CART_ITEM_UID).update({
      where: { id: item.id },
      data: {
        qty,
        unitPrice,
        lineTotal,
      },
    });

    item.qty = qty;
    item.unitPrice = unitPrice;
    item.lineTotal = lineTotal;

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

    return serializeCart(cart);
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

    return serializeCart(cart);
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
      throwHttpError(400, 'No puedes finalizar una compra con el carrito vacío');
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

    for (const item of rawCart.items) {
      const productId = getRelationId(item.product);
      if (!productId) {
        throwHttpError(400, 'El producto del carrito ya no está disponible');
      }

      const latestProduct = await strapi.db
        .query(PRODUCT_UID)
        .findOne(withTrx({ where: { id: productId, publishedAt: { $notNull: true } } }, trx));

      if (!latestProduct) {
        throwHttpError(400, `El producto ${productId} ya no está disponible`);
      }

      if (toInt(latestProduct.stock, 0) < toInt(item.qty, 1)) {
        throwHttpError(400, `No hay suficiente inventario para ${latestProduct.name}`);
      }
    }

    const subtotal = roundMoney(toNumber(rawCart.subtotal, 0));
    const couponEvaluation = rawCart.coupon ? evaluateCoupon(rawCart.coupon, subtotal, rawCart.items || []) : null;
    if (rawCart.coupon && !couponEvaluation?.valid) {
      throwHttpError(400, couponEvaluation?.reason || 'El cupón ya no se puede aplicar');
    }

    const discountTotal = couponEvaluation?.valid
      ? roundMoney(couponEvaluation.discount)
      : roundMoney(toNumber(rawCart.discountTotal, 0));
    const shippingTotal = resolveShippingTotal(subtotal, discountTotal, shippingMethod);
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
      const unitPrice = roundMoney(toNumber(latestProduct?.price, toNumber(item.unitPrice, 0)));
      const lineTotal = roundMoney(unitPrice * qty);

      await strapi.db.query(ORDER_ITEM_UID).create(
        withTrx(
          {
            data: {
              order: createdOrder.id,
              product: productId,
              nameSnapshot: latestProduct?.name || 'Unknown Product',
              qty,
              unitPrice,
              lineTotal,
              sku: latestProduct?.slug || null,
            },
          },
          trx
        )
      );

      const currentStock = Math.max(0, toInt(latestProduct?.stock, 0));
      if (currentStock < qty) {
        throwHttpError(409, `Stock changed while processing ${latestProduct?.name || `product ${productId}`}`);
      }
      const nextStock = Math.max(0, currentStock - qty);

      const updatedProduct = await strapi.db.query(PRODUCT_UID).update(
        withTrx(
          {
            where: { id: productId, stock: { $eq: currentStock } },
            data: {
              stock: nextStock,
            },
          },
          trx
        )
      );

      if (!updatedProduct) {
        throwHttpError(409, `Stock changed while processing ${latestProduct?.name || `product ${productId}`}`);
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
      nextCart: serializeCart(nextCart),
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
    if (category) {
      conditions.push({ category: { $eq: category } });
    }

    const subcategory = normalizeText(query?.subcategory);
    if (subcategory) {
      conditions.push({ subcategory: { $eqi: subcategory } });
    }

    if (parseBool(query?.featured)) {
      conditions.push({ isFeatured: { $eq: true } });
    }

    const form = normalizeText(query?.form);
    if (form) {
      conditions.push({ form: { $eq: form } });
    }

    const proteinSource = normalizeText(query?.proteinSource);
    if (proteinSource) {
      conditions.push({ proteinSource: { $eq: proteinSource } });
    }

    const brandId = toInt(query?.brandId, 0);
    if (brandId > 0) {
      conditions.push({ brand: { id: { $eq: brandId } } });
    }

    const specieId = toInt(query?.specieId, 0);
    if (specieId > 0) {
      conditions.push({ speciesSupported: { id: { $eq: specieId } } });
    }

    const lifeStageId = toInt(query?.lifeStageId, 0);
    if (lifeStageId > 0) {
      conditions.push({ lifeStages: { id: { $eq: lifeStageId } } });
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
        },
      });

      if (!pet) {
        throwHttpError(404, 'Pet profile not found for this user');
      }

      if (pet.specie?.id) {
        conditions.push({ speciesSupported: { id: { $eq: pet.specie.id } } });
      }

      if (pet.lifeStage?.id) {
        conditions.push({ lifeStages: { id: { $eq: pet.lifeStage.id } } });
      }

      const weightKg = toNumber(pet.weightKg, Number.NaN);
      if (Number.isFinite(weightKg)) {
        conditions.push({ weightMinKg: { $lte: weightKg } });
        conditions.push({ weightMaxKg: { $gte: weightKg } });
      }

      const strictPet = parseBool(query?.strictPet);

      const petDietIds = (pet.dietTags || []).map((tag: any) => tag.id).filter(Boolean);
      if (petDietIds.length > 0) {
        if (strictPet) {
          for (const dietId of petDietIds) {
            conditions.push({ diet_tags: { id: { $eq: dietId } } });
          }
        } else {
          conditions.push({ diet_tags: { id: { $in: petDietIds } } });
        }
      }

      const petHealthIds = (pet.healthConditions || []).map((condition: any) => condition.id).filter(Boolean);
      if (petHealthIds.length > 0) {
        if (strictPet) {
          for (const conditionId of petHealthIds) {
            conditions.push({ health_claims: { id: { $eq: conditionId } } });
          }
        } else {
          conditions.push({ health_claims: { id: { $in: petHealthIds } } });
        }
      }
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

    const [orders, pets] = await Promise.all([
      strapi.db.query(ORDER_UID).count({ where: { user: { id: userId } } }),
      strapi.db.query(PET_PROFILE_UID).count({ where: { owner: { id: userId } } }),
    ]);

    return {
      data: serializeUserProfile(user, { orders, pets }),
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
      data.birthdate = normalizeDateInput(extractFirstValue(payload, ['birthdate', 'birthDate', 'fechaNacimiento']));
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
      const weightValue = toNumber(extractFirstValue(payload, ['weightKg', 'weight', 'pesoKg']), Number.NaN);
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
      pickFirstNonEmpty([payload.specieId, payload.speciesId, payload.specie, payload.species]),
      0
    );
    if (specieId > 0) {
      data.specie = specieId;
    } else if (hasOwnField(payload, ['specieId', 'speciesId', 'specie', 'species'])) {
      data.specie = null;
    }

    const lifeStageId = toInt(
      pickFirstNonEmpty([payload.lifeStageId, payload.lifeStage, payload.etapaVida]),
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

  const listPetTaxonomyPayload = async () => {
    const [species, lifeStages, dietTags, healthConditions] = await Promise.all([
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
        species: normalizeTaxonomy(species),
        lifeStages: normalizeTaxonomy(lifeStages),
        dietTags: normalizeTaxonomy(dietTags),
        healthConditions: normalizeTaxonomy(healthConditions),
      },
    };
  };

  const listCatalogTaxonomyPayload = async () => {
    const databasePayload = await getCatalogTaxonomyPayloadFromDatabase(strapi);
    return databasePayload || getCatalogTaxonomyPayload();
  };

  const listProductFacetsPayload = async (query: any = {}, userId?: number) => {
    const where = await buildProductWhere(query, userId);
    let products: any[] = [];

    try {
      products = await runWithTimeout(
        strapi.db.query(PRODUCT_UID).findMany({
          where,
          select: ['price', 'category', 'subcategory', 'form', 'proteinSource'],
          populate: {
            brand: {
              select: ['id', 'documentId', 'name', 'slug'],
            },
            speciesSupported: {
              select: ['id', 'documentId', 'name', 'slug'],
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

    const priceValues = (products || [])
      .map((product: any) => roundMoney(toNumber(product.price, Number.NaN)))
      .filter((price: number) => Number.isFinite(price));

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
        species: collectTaxonomyFacet((products || []).flatMap((product: any) => product.speciesSupported || [])),
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
            brand: true,
          }
        : {
            images: true,
            brand: true,
            speciesSupported: true,
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
          brand: true,
          speciesSupported: true,
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

    async getFooterNewsletterPromo() {
      return getFooterNewsletterPromoPayload();
    },

    async listPetTaxonomy() {
      return listPetTaxonomyPayload();
    },

    async listCatalogTaxonomy() {
      return listCatalogTaxonomyPayload();
    },

    async getOrCreateGuestCart(sessionKeyInput: string) {
      const cart = await ensureGuestActiveCart(sessionKeyInput);
      const normalized = await recalculateCartFromState(cart);
      return { data: normalized };
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

      await strapi.db.query(USER_UID).update({
        where: { id: userId },
        data: updateData,
      });

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
        populate: {
          avatar: true,
          specie: true,
          lifeStage: true,
          dietTags: true,
          healthConditions: true,
        },
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
      const created = await strapi.db.query(PET_PROFILE_UID).create({
        data: {
          ...data,
          owner: userId,
        },
      });

      const pet = await strapi.db.query(PET_PROFILE_UID).findOne({
        where: { id: created.id },
        populate: {
          avatar: true,
          specie: true,
          lifeStage: true,
          dietTags: true,
          healthConditions: true,
        },
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
      await strapi.db.query(PET_PROFILE_UID).update({
        where: { id: existing.id },
        data,
      });

      const pet = await strapi.db.query(PET_PROFILE_UID).findOne({
        where: { id: existing.id },
        populate: {
          avatar: true,
          specie: true,
          lifeStage: true,
          dietTags: true,
          healthConditions: true,
        },
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
  };
};
