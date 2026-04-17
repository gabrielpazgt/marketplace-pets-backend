# Strapi Backend Context

## Resumen

Este proyecto es el backend Strapi 5 del ecommerce. Maneja catalogo, taxonomias, membresias, carrito, checkout, perfil, mascotas, direcciones, ordenes y endpoints de discovery para sitemap/feed.

## Stack real

- Strapi `5.40.x`
- TypeScript
- Postgres como configuracion principal esperada
- `users-permissions` para cuentas
- email configurable por `sendmail` o `nodemailer`

## Comandos utiles

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run seed:storefront`
- `npm run import:pdf-catalog`

## Runtime local esperado

- servidor local en `http://localhost:1338`
- puerto definido en `config/server.ts`
- frontend local permitido por `CORS_ORIGIN=http://localhost:4200,...`

## Variables de entorno clave

Usar `.env.example` como referencia. Las mas importantes para desarrollo y despliegue:

- `HOST`
- `PORT`
- `PUBLIC_URL`
- `FRONTEND_PUBLIC_URL`
- `DATABASE_*`
- `UP_RESET_PASSWORD_URL`
- `EMAIL_*`
- `SMTP_*`

## Carpetas clave

- `src/api/`: content-types, controladores, servicios y rutas
- `src/api/storefront/`: API custom que usa el frontend
- `config/`: server, database, plugins, middlewares, api
- `scripts/`: seeders e importadores
- `types/generated/`: tipos generados de content types

## Content types importantes

Entre los mas relevantes para el negocio:

- `product`
- `brand`
- `membership`
- `coupon`
- `cart`
- `cart-item`
- `order`
- `order-item`
- `pet-profile`
- `specie`
- `life-stage`
- `diet-tag`
- `health-condition`
- `catalog-category`
- `catalog-filter`
- `header-announcement`
- `adress`

## Nota importante sobre nombres persistidos

Hay nombres historicos que parecen typos pero ya forman parte del modelo y del API. No los renombres sin migracion explicita:

- `adress`
- enum `accesories`
- enum `accesory`

## API custom de storefront

La mayoria del frontend habla con `src/api/storefront/routes/storefront.ts` y `src/api/storefront/services/storefront.ts`.

Grupos de endpoints importantes:

- `GET /api/storefront/products`
- `GET /api/storefront/products/facets`
- `GET /api/storefront/products/:id`
- `GET /api/storefront/taxonomy/pets`
- `GET /api/storefront/taxonomy/catalog`
- `GET /api/storefront/memberships/plans`
- `GET /api/storefront/coupons/public`
- guest cart y guest checkout
- `/api/storefront/me/*` para cart, profile, preferences, membership, addresses, pets y orders
- `GET /api/storefront/sitemap.xml`
- `GET /api/storefront/merchant-feed.xml`

## Reglas funcionales visibles en el servicio

- moneda por defecto `GTQ`
- envio gratis desde `Q500`
- envio estandar `Q25`
- envio express `Q45`
- idioma por defecto `es`
- timezone por defecto `America/Guatemala`
- los endpoints `/storefront/me/*` aplican la policy `global::require-storefront-user`

## SEO y discovery

Este backend no solo sirve datos transaccionales. Tambien genera:

- sitemap dinamico
- merchant feed XML

Si cambias slugs, URLs publicas, taxonomias, pricing o disponibilidad, revisa impacto en esos dos endpoints.

## Scripts y data ops

- `scripts/seed-storefront-data.js`: datos base del storefront
- `scripts/import-pdf-catalog-products.js`: importacion desde catalogo PDF

Si un cambio toca schemas de producto, marca, taxonomias o variantes, revisa tambien estos scripts.

## Convenciones utiles

- Antes de tocar `storefront.ts`, intenta limitar el cambio a helpers pequenos o funciones bien delimitadas.
- Si cambias respuesta de un endpoint, piensa en el contrato del frontend inmediatamente.
- Mantener secretos fuera del repo; usar `.env`.
- No asumir que una limpieza de nombres es gratis en Strapi: puede romper UIDs, datos y panel admin.

## Definition of done util

Para cambios de backend, intenta cerrar con:

- `npm run build`
- endpoint o flujo validado manualmente
- sin romper contrato del frontend
- si hubo cambio de schema, revisar seed/import scripts y tipos generados
