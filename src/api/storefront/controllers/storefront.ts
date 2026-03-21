const toInt = (value: any, fallback = 0): number => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: any): string => (typeof value === 'string' ? value.trim() : '');

const getSessionKey = (ctx: any): string => {
  const headerValue = ctx.request.header['x-cart-session'];
  const fromHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return normalizeText(fromHeader || ctx.request.body?.sessionKey || ctx.query?.sessionKey);
};

const getAuthorizationHeader = (ctx: any): string => {
  const headerValue = ctx.request.header.authorization;
  return normalizeText(Array.isArray(headerValue) ? headerValue[0] : headerValue);
};

export default ({ strapi }) => {
  const service = strapi.service('api::storefront.storefront');

  const handleError = (ctx: any, error: any) => {
    const status = error?.status || error?.statusCode || 500;
    const message = error?.message || 'Unexpected error';

    if (status === 400) return ctx.badRequest(message, error?.details);
    if (status === 401) return ctx.unauthorized(message);
    if (status === 403) return ctx.forbidden(message);
    if (status === 404) return ctx.notFound(message);
    if (status === 409) return ctx.conflict(message);
    if (status === 504) {
      ctx.status = 504;
      ctx.body = {
        data: null,
        error: {
          status: 504,
          name: 'GatewayTimeoutError',
          message,
          details: error?.details || null,
        },
      };
      return;
    }

    strapi.log.error(error);
    return ctx.internalServerError(message);
  };

  const execute = async (ctx: any, callback: () => Promise<any>) => {
    try {
      ctx.body = await callback();
    } catch (error) {
      return handleError(ctx, error);
    }
  };

  const resolveUser = async (ctx: any, required = true) => {
    return service.resolveUserFromAuthorization(getAuthorizationHeader(ctx), required);
  };

  return {
    async listProducts(ctx: any) {
      return execute(ctx, async () => service.listProducts(ctx.query));
    },

    async listProductFacets(ctx: any) {
      return execute(ctx, async () => service.listProductFacets(ctx.query));
    },

    async listMyProducts(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.listProducts(ctx.query, user.id);
      });
    },

    async listMyProductFacets(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.listProductFacets(ctx.query, user.id);
      });
    },

    async getProduct(ctx: any) {
      return execute(ctx, async () => service.getProduct(ctx.params.id));
    },

    async listMembershipPlans(ctx: any) {
      return execute(ctx, async () => service.listMembershipPlans());
    },

    async listPublicCoupons(ctx: any) {
      return execute(ctx, async () => service.listPublicCoupons());
    },

    async listHeaderAnnouncements(ctx: any) {
      return execute(ctx, async () => service.listHeaderAnnouncements());
    },

    async getFooterNewsletterPromo(ctx: any) {
      return execute(ctx, async () => service.getFooterNewsletterPromo());
    },

    async listPetTaxonomy(ctx: any) {
      return execute(ctx, async () => service.listPetTaxonomy());
    },

    async listCatalogTaxonomy(ctx: any) {
      return execute(ctx, async () => service.listCatalogTaxonomy());
    },

    async getGuestCart(ctx: any) {
      return execute(ctx, async () => service.getOrCreateGuestCart(getSessionKey(ctx)));
    },

    async addGuestCartItem(ctx: any) {
      return execute(ctx, async () => service.addGuestCartItem(getSessionKey(ctx), ctx.request.body));
    },

    async updateGuestCartItem(ctx: any) {
      return execute(ctx, async () =>
        service.updateGuestCartItem(getSessionKey(ctx), toInt(ctx.params.itemId, 0), ctx.request.body)
      );
    },

    async removeGuestCartItem(ctx: any) {
      return execute(ctx, async () => service.removeGuestCartItem(getSessionKey(ctx), toInt(ctx.params.itemId, 0)));
    },

    async applyGuestCoupon(ctx: any) {
      return execute(ctx, async () => service.applyGuestCoupon(getSessionKey(ctx), ctx.request.body));
    },

    async clearGuestCoupon(ctx: any) {
      return execute(ctx, async () => service.clearGuestCoupon(getSessionKey(ctx)));
    },

    async checkoutGuest(ctx: any) {
      return execute(ctx, async () => service.checkoutGuest(getSessionKey(ctx), ctx.request.body));
    },

    async getMyCart(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.getOrCreateUserCart(user.id);
      });
    },

    async addMyCartItem(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.addUserCartItem(user.id, ctx.request.body);
      });
    },

    async getMyProfile(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.getUserProfile(user.id);
      });
    },

    async updateMyProfile(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.updateUserProfile(user.id, ctx.request.body);
      });
    },

    async getMyPreferences(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.getUserPreferences(user.id);
      });
    },

    async updateMyPreferences(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.updateUserPreferences(user.id, ctx.request.body);
      });
    },

    async getMyMembership(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.getUserMembership(user.id);
      });
    },

    async updateMyMembership(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.updateUserMembership(user.id, ctx.request.body);
      });
    },

    async listMyAddresses(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.listUserAddresses(user.id);
      });
    },

    async createMyAddress(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.createUserAddress(user.id, ctx.request.body);
      });
    },

    async updateMyAddress(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.updateUserAddress(user.id, toInt(ctx.params.id, 0), ctx.request.body);
      });
    },

    async deleteMyAddress(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.deleteUserAddress(user.id, toInt(ctx.params.id, 0));
      });
    },

    async listMyPets(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.listUserPets(user.id);
      });
    },

    async createMyPet(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.createUserPet(user.id, ctx.request.body);
      });
    },

    async updateMyPet(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.updateUserPet(user.id, toInt(ctx.params.id, 0), ctx.request.body);
      });
    },

    async deleteMyPet(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.deleteUserPet(user.id, toInt(ctx.params.id, 0));
      });
    },

    async deleteMyAccount(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.deleteUserAccount(user.id);
      });
    },

    async updateMyCartItem(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.updateUserCartItem(user.id, toInt(ctx.params.itemId, 0), ctx.request.body);
      });
    },

    async removeMyCartItem(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.removeUserCartItem(user.id, toInt(ctx.params.itemId, 0));
      });
    },

    async applyMyCoupon(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.applyUserCoupon(user.id, ctx.request.body);
      });
    },

    async clearMyCoupon(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.clearUserCoupon(user.id);
      });
    },

    async checkoutMy(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.checkoutUser(user.id, ctx.request.body);
      });
    },

    async listMyOrders(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.listUserOrders(user.id, ctx.query);
      });
    },

    async getMyOrder(ctx: any) {
      return execute(ctx, async () => {
        const user = await resolveUser(ctx, true);
        return service.getUserOrderById(user.id, toInt(ctx.params.id, 0));
      });
    },
  };
};
