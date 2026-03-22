import type { Core } from '@strapi/strapi';
import { getCatalogTaxonomyPayload } from './catalog-taxonomy';

const CATALOG_ANIMAL_UID = 'api::catalog-animal.catalog-animal';
const CATALOG_CATEGORY_UID = 'api::catalog-category.catalog-category';
const CATALOG_FILTER_UID = 'api::catalog-filter.catalog-filter';

type CategoryLevel = 'category' | 'subcategory' | 'detail';

type CatalogFilterRecord = {
  id: number;
  key?: string;
  label?: string;
  rationale?: string | null;
  availability?: 'available' | 'planned';
  control?: string | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

type CatalogMediaRecord = Record<string, unknown>;

type CatalogFilterRef = {
  key?: string;
};

type CatalogDetailSeed = {
  key?: string;
  slug?: string;
  label?: string;
};

type CatalogSubcategorySeed = {
  key?: string;
  slug?: string;
  label?: string;
  description?: string | null;
  recommendedFilters?: CatalogFilterRef[];
  level4?: CatalogDetailSeed[];
};

type CatalogRootCategorySeed = {
  key?: string;
  slug?: string;
  label?: string;
  description?: string | null;
  legacyCategory?: string | null;
  recommendedFilters?: CatalogFilterRef[];
  subcategories?: CatalogSubcategorySeed[];
};

type CatalogAnimalRecord = {
  id: number;
  key?: string;
  slug?: string;
  label?: string;
  description?: string | null;
  headline?: string | null;
  subtitle?: string | null;
  searchHint?: string | null;
  navigationImage?: CatalogMediaRecord;
  legacySpeciesHints?: unknown;
  sortOrder?: number | null;
  isActive?: boolean | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

type CatalogCategoryRecord = {
  id: number;
  code?: string;
  key?: string | null;
  slug?: string;
  label?: string;
  description?: string | null;
  navigationImage?: CatalogMediaRecord;
  level?: CategoryLevel;
  legacyCategory?: string | null;
  matchTerms?: unknown;
  sortOrder?: number | null;
  isActive?: boolean | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  animal?: { id?: number } | number | null;
  parent?: { id?: number } | number | null;
  recommendedFilters?: CatalogFilterRecord[];
};

const ANIMAL_EDITORIAL_COPY: Record<
  string,
  { headline: string; subtitle: string; searchHint: string }
> = {
  dog: {
    headline: 'Todo para perros',
    subtitle: 'Compra alimento, salud, paseo, premios y accesorios con filtros pensados para perros.',
    searchHint: 'Buscar alimento, premios, higiene o accesorios para perros',
  },
  cat: {
    headline: 'Todo para gatos',
    subtitle: 'Explora arena, alimento, salud, rascadores y soluciones para el bienestar de tu gato.',
    searchHint: 'Buscar alimento, arena, premios o salud para gatos',
  },
  bird: {
    headline: 'Todo para aves',
    subtitle: 'Encuentra alimento, jaulas, perchas, juguetes y cuidado diario para aves de compañía.',
    searchHint: 'Buscar alimento, jaulas o accesorios para aves',
  },
  fish: {
    headline: 'Todo para peces y acuario',
    subtitle: 'Compra alimento, filtros, agua, decoración y equipo para acuarios de agua dulce o marinos.',
    searchHint: 'Buscar alimento, filtros o cuidado del agua',
  },
  reptile: {
    headline: 'Todo para reptiles y anfibios',
    subtitle: 'Terrarios, UVB, sustratos, feeders y accesorios para reptiles y anfibios.',
    searchHint: 'Buscar terrarios, UVB, alimento o sustratos',
  },
  'small-pet': {
    headline: 'Todo para roedores y pequeñas mascotas',
    subtitle: 'Conejos, hámsters, cobayos y más con alimento, hábitat, sustrato y enriquecimiento.',
    searchHint: 'Buscar alimento, hábitat o cama para pequeñas mascotas',
  },
  horse: {
    headline: 'Todo para caballos',
    subtitle: 'Concentrado, suplementos, cuidado diario y equipo con filtros pensados para equinos.',
    searchHint: 'Buscar concentrado, suplementos o equipo para caballo',
  },
};

const nowIso = () => new Date().toISOString();

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toSlug = (value: unknown): string =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const toSortValue = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getRelationId = (value: unknown): number | null => {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const parsed = Number((value as { id?: unknown }).id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
};

const normalizeStringList = (value: unknown): string[] => {
  const source = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      source
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )
  );
};

const compareBySortOrder = (
  a: { sortOrder?: number | null; label?: string | null },
  b: { sortOrder?: number | null; label?: string | null }
) => {
  const sortDiff = toSortValue(a.sortOrder, 0) - toSortValue(b.sortOrder, 0);
  if (sortDiff !== 0) return sortDiff;
  return normalizeText(a.label).localeCompare(normalizeText(b.label), 'es');
};

const serializeFilter = (filter: CatalogFilterRecord) => ({
  key: normalizeText(filter.key),
  label: normalizeText(filter.label),
  rationale: normalizeText(filter.rationale),
  availability: filter.availability === 'planned' ? 'planned' : 'available',
  control: normalizeText(filter.control) || null,
});

const serializeLeaf = (item: CatalogCategoryRecord) => {
  const matchTerms = normalizeStringList(item.matchTerms);

  return {
    key: normalizeText(item.key) || normalizeText(item.slug) || toSlug(item.label),
    slug: normalizeText(item.slug) || toSlug(item.label),
    label: normalizeText(item.label),
    ...(matchTerms.length ? { matchTerms } : {}),
  };
};

const buildVersion = (
  filters: CatalogFilterRecord[],
  animals: CatalogAnimalRecord[],
  categories: CatalogCategoryRecord[]
) => {
  const latest = [...filters, ...animals, ...categories]
    .map((entry) => normalizeText(entry.updatedAt))
    .filter(Boolean)
    .sort()
    .pop();

  return latest ? latest.slice(0, 10) : nowIso().slice(0, 10);
};

const buildDatabasePayload = (
  filters: CatalogFilterRecord[],
  animals: CatalogAnimalRecord[],
  categories: CatalogCategoryRecord[]
) => {
  if (!animals.length || !categories.length) {
    return null;
  }

  const categoryChildren = new Map<number, CatalogCategoryRecord[]>();

  for (const item of categories) {
    const parentId = getRelationId(item.parent);
    if (parentId === null) continue;

    const bucket = categoryChildren.get(parentId) || [];
    bucket.push(item);
    categoryChildren.set(parentId, bucket);
  }

  const orderedChildren = (parentId: number) =>
    [...(categoryChildren.get(parentId) || [])].sort(compareBySortOrder);

  const orderedAnimals = [...animals].sort(compareBySortOrder);

  return {
    data: {
      version: buildVersion(filters, animals, categories),
      generatedFrom: 'database',
      filterLibrary: [...filters].sort(compareBySortOrder).map(serializeFilter),
      animals: orderedAnimals.map((animal) => {
        const rootCategories = categories
          .filter(
            (category) =>
              getRelationId(category.animal) === animal.id
              && getRelationId(category.parent) === null
              && category.level === 'category'
          )
          .sort(compareBySortOrder);

        return {
          key: normalizeText(animal.key) || normalizeText(animal.slug),
          slug: normalizeText(animal.slug) || toSlug(animal.label),
          label: normalizeText(animal.label),
          description: normalizeText(animal.description),
          legacySpeciesHints: normalizeStringList(animal.legacySpeciesHints),
          ...(animal.navigationImage ? { image: animal.navigationImage } : {}),
          ...(normalizeText(animal.headline) ? { headline: normalizeText(animal.headline) } : {}),
          ...(normalizeText(animal.subtitle) ? { subtitle: normalizeText(animal.subtitle) } : {}),
          ...(normalizeText(animal.searchHint) ? { searchHint: normalizeText(animal.searchHint) } : {}),
          categories: rootCategories.map((category) => ({
            ...serializeLeaf(category),
            legacyCategory: normalizeText(category.legacyCategory) || null,
            description: normalizeText(category.description),
            ...(category.navigationImage ? { image: category.navigationImage } : {}),
            recommendedFilters: (category.recommendedFilters || [])
              .sort(compareBySortOrder)
              .map(serializeFilter),
            subcategories: orderedChildren(category.id)
              .filter((item) => item.level === 'subcategory')
              .map((subcategory) => ({
                ...serializeLeaf(subcategory),
                description: normalizeText(subcategory.description),
                recommendedFilters: (subcategory.recommendedFilters || [])
                  .sort(compareBySortOrder)
                  .map(serializeFilter),
                level4: orderedChildren(subcategory.id)
                  .filter((item) => item.level === 'detail')
                  .map(serializeLeaf),
              })),
          })),
        };
      }),
    },
  };
};

const buildSubcategoryMatchTerms = (
  subcategory: {
    label?: string;
    level4?: Array<{ label?: string }>;
  }
) =>
  Array.from(
    new Set(
      [normalizeText(subcategory.label), ...((subcategory.level4 || []).map((item) => normalizeText(item.label)))]
        .filter(Boolean)
    )
  );

const createCategoryBranch = async (
  strapi: Core.Strapi,
  animalId: number,
  animalKey: string,
  rootCategory: CatalogRootCategorySeed,
  rootCategoryIndex: number,
  filterMap: Map<string, number>,
  publishedAt: string
) => {
  const rootCode = `${animalKey}:category:${normalizeText(rootCategory.slug)}`;
  const rootCategoryId = (
    await strapi.db.query(CATALOG_CATEGORY_UID).create({
      data: {
        code: rootCode,
        key: normalizeText(rootCategory.key) || normalizeText(rootCategory.slug),
        slug: normalizeText(rootCategory.slug) || toSlug(rootCategory.label),
        label: normalizeText(rootCategory.label),
        description: normalizeText(rootCategory.description),
        level: 'category',
        legacyCategory: normalizeText(rootCategory.legacyCategory) || null,
        matchTerms: (rootCategory.subcategories || []).flatMap((subcategory) => buildSubcategoryMatchTerms(subcategory)),
        sortOrder: (rootCategoryIndex + 1) * 10,
        isActive: true,
        animal: animalId,
        recommendedFilters: (rootCategory.recommendedFilters || [])
          .map((filter: { key?: string }) => filterMap.get(normalizeText(filter.key)))
          .filter(Boolean),
        publishedAt,
      },
    })
  ).id;

  for (const [subcategoryIndex, subcategory] of (rootCategory.subcategories || []).entries()) {
    const subcategoryCode = `${rootCode}:subcategory:${normalizeText(subcategory.slug)}`;
    const subcategoryId = (
      await strapi.db.query(CATALOG_CATEGORY_UID).create({
        data: {
          code: subcategoryCode,
          key: normalizeText(subcategory.key) || normalizeText(subcategory.slug),
          slug: normalizeText(subcategory.slug) || toSlug(subcategory.label),
          label: normalizeText(subcategory.label),
          description: normalizeText(subcategory.description),
          level: 'subcategory',
          matchTerms: buildSubcategoryMatchTerms(subcategory),
          sortOrder: (subcategoryIndex + 1) * 10,
          isActive: true,
          animal: animalId,
          parent: rootCategoryId,
          recommendedFilters: (subcategory.recommendedFilters || [])
            .map((filter: { key?: string }) => filterMap.get(normalizeText(filter.key)))
            .filter(Boolean),
          publishedAt,
        },
      })
    ).id;

    for (const [detailIndex, detail] of (subcategory.level4 || []).entries()) {
      await strapi.db.query(CATALOG_CATEGORY_UID).create({
        data: {
          code: `${subcategoryCode}:detail:${normalizeText(detail.slug)}`,
          key: normalizeText(detail.key) || normalizeText(detail.slug),
          slug: normalizeText(detail.slug) || toSlug(detail.label),
          label: normalizeText(detail.label),
          level: 'detail',
          matchTerms: [normalizeText(detail.label)].filter(Boolean),
          sortOrder: (detailIndex + 1) * 10,
          isActive: true,
          animal: animalId,
          parent: subcategoryId,
          publishedAt,
        },
      });
    }
  }
};

export const seedCatalogTaxonomy = async (strapi: Core.Strapi): Promise<boolean> => {
  const [animalCount, categoryCount, filterCount] = await Promise.all([
    strapi.db.query(CATALOG_ANIMAL_UID).count(),
    strapi.db.query(CATALOG_CATEGORY_UID).count(),
    strapi.db.query(CATALOG_FILTER_UID).count(),
  ]);

  if (animalCount > 0 || categoryCount > 0 || filterCount > 0) {
    return false;
  }

  const legacyPayload = getCatalogTaxonomyPayload().data;
  const publishedAt = nowIso();
  const filterMap = new Map<string, number>();

  for (const [index, filter] of (legacyPayload.filterLibrary || []).entries()) {
    const created = await strapi.db.query(CATALOG_FILTER_UID).create({
      data: {
        key: normalizeText(filter.key),
        label: normalizeText(filter.label),
        rationale: normalizeText(filter.rationale),
        availability: filter.availability === 'planned' ? 'planned' : 'available',
        control: normalizeText(filter.control) || null,
        sortOrder: (index + 1) * 10,
        isActive: true,
        publishedAt,
      },
    });

    filterMap.set(normalizeText(filter.key), created.id);
  }

  for (const [animalIndex, animal] of (legacyPayload.animals || []).entries()) {
    const editorialCopy = ANIMAL_EDITORIAL_COPY[normalizeText(animal.key)] || {
      headline: `Todo para ${normalizeText(animal.label).toLowerCase()}`,
      subtitle: normalizeText(animal.description),
      searchHint: `Buscar productos para ${normalizeText(animal.label).toLowerCase()}`,
    };

    const createdAnimal = await strapi.db.query(CATALOG_ANIMAL_UID).create({
      data: {
        key: normalizeText(animal.key),
        slug: normalizeText(animal.slug) || toSlug(animal.label),
        label: normalizeText(animal.label),
        description: normalizeText(animal.description),
        headline: editorialCopy.headline,
        subtitle: editorialCopy.subtitle,
        searchHint: editorialCopy.searchHint,
        legacySpeciesHints: normalizeStringList(animal.legacySpeciesHints),
        sortOrder: (animalIndex + 1) * 10,
        isActive: true,
        publishedAt,
      },
    });

    for (const [categoryIndex, category] of (animal.categories || []).entries()) {
      await createCategoryBranch(
        strapi,
        createdAnimal.id,
        normalizeText(animal.key),
        category,
        categoryIndex,
        filterMap,
        publishedAt
      );
    }
  }

  return true;
};

export const getCatalogTaxonomyPayloadFromDatabase = async (strapi: Core.Strapi) => {
  const [filters, animals, categories] = await Promise.all([
    strapi.db.query(CATALOG_FILTER_UID).findMany({
      where: {
        isActive: { $ne: false },
        publishedAt: { $notNull: true },
      },
    }),
    strapi.db.query(CATALOG_ANIMAL_UID).findMany({
      where: {
        isActive: { $ne: false },
        publishedAt: { $notNull: true },
      },
      populate: {
        navigationImage: true,
      },
    }),
    strapi.db.query(CATALOG_CATEGORY_UID).findMany({
      where: {
        isActive: { $ne: false },
        publishedAt: { $notNull: true },
      },
      populate: {
        animal: true,
        parent: true,
        navigationImage: true,
        recommendedFilters: true,
      },
    }),
  ]);

  return buildDatabasePayload(
    (filters || []) as CatalogFilterRecord[],
    (animals || []) as CatalogAnimalRecord[],
    (categories || []) as CatalogCategoryRecord[]
  );
};
