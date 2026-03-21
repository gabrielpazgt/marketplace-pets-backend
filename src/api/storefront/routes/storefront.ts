const requireUserPolicies = ['global::require-storefront-user'];

export default {
  routes: [
    {
      method: 'GET',
      path: '/storefront/products',
      handler: 'storefront.listProducts',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/products/facets',
      handler: 'storefront.listProductFacets',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/me/products',
      handler: 'storefront.listMyProducts',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/me/products/facets',
      handler: 'storefront.listMyProductFacets',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/products/:id',
      handler: 'storefront.getProduct',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/memberships/plans',
      handler: 'storefront.listMembershipPlans',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/coupons/public',
      handler: 'storefront.listPublicCoupons',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/header-announcements',
      handler: 'storefront.listHeaderAnnouncements',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/footer-newsletter-promo',
      handler: 'storefront.getFooterNewsletterPromo',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/taxonomy/pets',
      handler: 'storefront.listPetTaxonomy',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/taxonomy/catalog',
      handler: 'storefront.listCatalogTaxonomy',
      config: { auth: false },
    },

    {
      method: 'GET',
      path: '/storefront/guest/cart',
      handler: 'storefront.getGuestCart',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/storefront/guest/cart/items',
      handler: 'storefront.addGuestCartItem',
      config: { auth: false },
    },
    {
      method: 'PATCH',
      path: '/storefront/guest/cart/items/:itemId',
      handler: 'storefront.updateGuestCartItem',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/storefront/guest/cart/items/:itemId',
      handler: 'storefront.removeGuestCartItem',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/storefront/guest/cart/coupon',
      handler: 'storefront.applyGuestCoupon',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/storefront/guest/cart/coupon',
      handler: 'storefront.clearGuestCoupon',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/storefront/guest/checkout',
      handler: 'storefront.checkoutGuest',
      config: { auth: false },
    },

    {
      method: 'GET',
      path: '/storefront/me/cart',
      handler: 'storefront.getMyCart',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/me/profile',
      handler: 'storefront.getMyProfile',
      config: { auth: false },
    },
    {
      method: 'PATCH',
      path: '/storefront/me/profile',
      handler: 'storefront.updateMyProfile',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/me/preferences',
      handler: 'storefront.getMyPreferences',
      config: { auth: false },
    },
    {
      method: 'PATCH',
      path: '/storefront/me/preferences',
      handler: 'storefront.updateMyPreferences',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/me/membership',
      handler: 'storefront.getMyMembership',
      config: { auth: false },
    },
    {
      method: 'PATCH',
      path: '/storefront/me/membership',
      handler: 'storefront.updateMyMembership',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/me/addresses',
      handler: 'storefront.listMyAddresses',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/storefront/me/addresses',
      handler: 'storefront.createMyAddress',
      config: { auth: false },
    },
    {
      method: 'PATCH',
      path: '/storefront/me/addresses/:id',
      handler: 'storefront.updateMyAddress',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/storefront/me/addresses/:id',
      handler: 'storefront.deleteMyAddress',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/me/pets',
      handler: 'storefront.listMyPets',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/storefront/me/pets',
      handler: 'storefront.createMyPet',
      config: { auth: false },
    },
    {
      method: 'PATCH',
      path: '/storefront/me/pets/:id',
      handler: 'storefront.updateMyPet',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/storefront/me/pets/:id',
      handler: 'storefront.deleteMyPet',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/storefront/me/account',
      handler: 'storefront.deleteMyAccount',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/storefront/me/cart/items',
      handler: 'storefront.addMyCartItem',
      config: { auth: false },
    },
    {
      method: 'PATCH',
      path: '/storefront/me/cart/items/:itemId',
      handler: 'storefront.updateMyCartItem',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/storefront/me/cart/items/:itemId',
      handler: 'storefront.removeMyCartItem',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/storefront/me/cart/coupon',
      handler: 'storefront.applyMyCoupon',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/storefront/me/cart/coupon',
      handler: 'storefront.clearMyCoupon',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/storefront/me/checkout',
      handler: 'storefront.checkoutMy',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/me/orders',
      handler: 'storefront.listMyOrders',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/storefront/me/orders/:id',
      handler: 'storefront.getMyOrder',
      config: { auth: false },
    },
  ].map((route) => {
    if (!route.path.startsWith('/storefront/me/')) {
      return route;
    }

    return {
      ...route,
      config: {
        ...(route.config || {}),
        auth: false,
        policies: [...requireUserPolicies, ...((route.config as any)?.policies || [])],
      },
    };
  }),
};
