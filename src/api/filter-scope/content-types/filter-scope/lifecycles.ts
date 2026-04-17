import type { Core } from '@strapi/strapi';
import {
  findCatalogFilterFromRelationInput,
  resolveFilterScopeKeyFromCatalogFilterKey,
} from '../../utils/catalog-filter-key-map';

declare const strapi: Core.Strapi;

const syncLegacyFilterKeyFromRelation = async (event: any) => {
  const data = event?.params?.data;
  if (!data || typeof data !== 'object' || !data.catalogFilter) return;

  const catalogFilter = await findCatalogFilterFromRelationInput(strapi, data.catalogFilter);
  if (!catalogFilter?.key) return;

  data.filterKey = resolveFilterScopeKeyFromCatalogFilterKey(catalogFilter.key);
};

export default {
  async beforeCreate(event: any) {
    await syncLegacyFilterKeyFromRelation(event);
  },

  async beforeUpdate(event: any) {
    await syncLegacyFilterKeyFromRelation(event);
  },
};
