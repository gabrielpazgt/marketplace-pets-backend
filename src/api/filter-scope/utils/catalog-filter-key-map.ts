import type { Core } from '@strapi/strapi';

export const CATALOG_FILTER_UID = 'api::catalog-filter.catalog-filter';
export const FILTER_SCOPE_UID = 'api::filter-scope.filter-scope';

const CATALOG_TO_SCOPE_KEY_MAP: Record<string, string> = {
  brand: 'brand',
  price: 'price',
  form: 'form',
  'protein-source': 'proteinSource',
  species: 'species',
  'life-stage': 'lifeStage',
  'diet-tags': 'dietTag',
  'health-goal': 'healthCondition',
  ingredients: 'ingredient',
};

const SCOPE_TO_CATALOG_KEY_MAP = Object.entries(CATALOG_TO_SCOPE_KEY_MAP).reduce<Record<string, string>>(
  (acc, [catalogKey, scopeKey]) => {
    acc[scopeKey] = catalogKey;
    return acc;
  },
  {}
);

type RelationRef = {
  id?: number;
  documentId?: string;
};

export const normalizeFilterKey = (value: unknown): string => String(value || '').trim();

export const resolveFilterScopeKeyFromCatalogFilterKey = (catalogFilterKey: unknown): string => {
  const normalized = normalizeFilterKey(catalogFilterKey);
  return normalized ? CATALOG_TO_SCOPE_KEY_MAP[normalized] || normalized : '';
};

export const resolveCatalogFilterKeyFromScopeKey = (scopeKey: unknown): string => {
  const normalized = normalizeFilterKey(scopeKey);
  return normalized ? SCOPE_TO_CATALOG_KEY_MAP[normalized] || normalized : '';
};

export const extractSingleRelationRef = (value: any): RelationRef | null => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? { id: value } : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) return { id: Number(trimmed) };
    return { documentId: trimmed };
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = extractSingleRelationRef(item);
      if (resolved) return resolved;
    }
    return null;
  }

  if (typeof value !== 'object') return null;

  if ('id' in value || 'documentId' in value) {
    const id = Number((value as any).id || 0);
    const documentId = normalizeFilterKey((value as any).documentId);
    if (id > 0) return { id };
    if (documentId) return { documentId };
  }

  if ('connect' in value) {
    return extractSingleRelationRef((value as any).connect);
  }

  if ('set' in value) {
    return extractSingleRelationRef((value as any).set);
  }

  return null;
};

export const findCatalogFilterFromRelationInput = async (strapi: Core.Strapi, relationInput: any) => {
  const ref = extractSingleRelationRef(relationInput);
  if (!ref) return null;

  if (ref.id) {
    return strapi.db.query(CATALOG_FILTER_UID).findOne({
      where: { id: ref.id },
      select: ['id', 'documentId', 'key'],
    });
  }

  if (ref.documentId) {
    return strapi.db.query(CATALOG_FILTER_UID).findOne({
      where: { documentId: ref.documentId },
      select: ['id', 'documentId', 'key'],
    });
  }

  return null;
};

export const resolveFilterScopeKeyFromScopeRecord = (scope: any): string => {
  const fromRelation = resolveFilterScopeKeyFromCatalogFilterKey(scope?.catalogFilter?.key);
  if (fromRelation) return fromRelation;
  return normalizeFilterKey(scope?.filterKey);
};
