import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::membership-log.membership-log', {
  config: {
    find: { middlewares: [] },
    findOne: { middlewares: [] },
    create: { middlewares: [] },
    update: { middlewares: [] },
    delete: { middlewares: [] },
  },
});
