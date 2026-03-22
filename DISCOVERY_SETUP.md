# Discovery Setup

## Public Endpoints

- Sitemap dinamico: `https://aumakki.com/api/storefront/sitemap.xml`
- Merchant feed XML: `https://aumakki.com/api/storefront/merchant-feed.xml`

En local, los endpoints equivalentes suelen ser:

- `http://localhost:1338/api/storefront/sitemap.xml`
- `http://localhost:1338/api/storefront/merchant-feed.xml`

## Required Backend Env

Define estas variables en produccion para que los enlaces del sitemap y del feed apunten a la tienda publica correcta:

- `PUBLIC_URL`
- `FRONTEND_PUBLIC_URL`

## Google Search Console

1. Crear o abrir la propiedad de `https://aumakki.com/`
2. Verificar dominio o prefijo de URL
3. En la seccion de sitemaps, enviar:
   - `https://aumakki.com/api/storefront/sitemap.xml`
4. Revisar cobertura, indexacion y mejoras de producto

## Google Merchant Center

1. Crear o abrir la cuenta de Merchant Center
2. Verificar y reclamar el sitio `https://aumakki.com/`
3. Crear una fuente primaria de productos
4. Elegir recuperacion programada o feed por URL
5. Usar:
   - `https://aumakki.com/api/storefront/merchant-feed.xml`
6. Validar diagnosticos de atributos, imagenes, precio, disponibilidad y URLs

## Practical Notes

- El feed ya expone precio, sale price, disponibilidad, marca, imagen y link publico de producto.
- El sitemap ya expone home, catalogo, colecciones, familias, categorias, subcategorias y fichas de producto.
- Las paginas transaccionales como checkout y success deben seguir fuera del indice.

## SSR / Prerender Evaluation

Estado actual:

- La tienda funciona como SPA Angular.
- Ya existe una base SEO mejorada con canonical, robots, sitemap, structured data y metadatos por pagina.

Siguiente paso recomendado:

1. Medir primero indexacion con el sitemap dinamico y el feed ya activos.
2. Si queremos mejorar render para bots no-Google y compartir HTML mas completo, evaluar `Angular SSR` o prerender para:
   - home
   - catalogo general
   - colecciones principales
   - fichas de producto

Recomendacion:

- No meter SSR a ciegas en el mismo sprint.
- Primero confirmar URLs canonicas, sitemap, Search Console y Merchant Center.
- Luego evaluar si conviene SSR completo o prerender selectivo de rutas publicas de alto valor.
