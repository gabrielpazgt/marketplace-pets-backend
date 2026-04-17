const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const HTML_PATH = path.join(ROOT_DIR, 'guia-campos-producto.html');
const PDF_PATH = path.join(ROOT_DIR, 'guia-campos-producto.pdf');

const FIELD_GUIDE = [
  {
    key: 'name',
    label: 'Nombre publico',
    type: 'string',
    required: 'Si',
    fill: 'Nombre visible en tienda. Usa marca + tipo de producto + especie o etapa cuando aporte claridad.',
    example: 'NutriSource Arroz con pollo para adultos.',
  },
  {
    key: 'slug',
    label: 'Slug',
    type: 'uid',
    required: 'Si',
    fill: 'Se genera desde el nombre. Solo ajustalo si necesitas una URL mas limpia o consistente.',
    example: 'nutri-source-arroz-con-pollo-para-adultos',
  },
  {
    key: 'description',
    label: 'Descripcion',
    type: 'blocks',
    required: 'Si',
    fill: 'Resumen corto comercial. Debe decir que es, para quien es y por que sirve.',
    example: 'Alimento seco premium para perros adultos con pollo como ingrediente principal...',
  },
  {
    key: 'price',
    label: 'Precio raiz',
    type: 'decimal',
    required: 'Si',
    fill: 'Si NO hay variantes, se llena manualmente. Si SI hay variantes, se recalcula solo con el menor precio.',
    example: '89.00',
  },
  {
    key: 'compareAtPrice',
    label: 'Precio tachado raiz',
    type: 'decimal',
    required: 'No',
    fill: 'Usalo solo si el producto sin variantes tiene oferta. Si el descuento vive en variantes, dejalo vacio en la raiz.',
    example: '99.00',
  },
  {
    key: 'sku',
    label: 'SKU raiz',
    type: 'string',
    required: 'No',
    fill: 'Usalo cuando el producto no tenga variantes. Si el SKU cambia por presentacion, mejor manejarlo dentro de variants.',
    example: 'NS-ADULT-4LB',
  },
  {
    key: 'stock',
    label: 'Stock raiz',
    type: 'integer',
    required: 'Si',
    fill: 'Si NO hay variantes, se llena manualmente. Si SI hay variantes, se recalcula solo con la suma de todos los stocks.',
    example: '18',
  },
  {
    key: 'variants',
    label: 'Variantes',
    type: 'json',
    required: 'No',
    fill: 'Usalo para presentaciones, tamanos o sabores. Cada variante debe llevar su propio SKU, precio, compareAtPrice y stock.',
    example: '[{ "id": "v1", "label": "4 lb", "price": 89, "stock": 8 }]',
  },
  {
    key: 'isFeatured',
    label: 'Destacado',
    type: 'boolean',
    required: 'No',
    fill: 'Marcalo solo si quieres dar prioridad al producto en recomendaciones o listados destacados.',
    example: 'true',
  },
  {
    key: 'images',
    label: 'Imagenes',
    type: 'media[]',
    required: 'Si',
    fill: 'Carga empaque y, si tienes, imagenes secundarias del producto o beneficios. El empaque debe ir primero.',
    example: '1 imagen principal + 2 a 5 imagenes secundarias',
  },
  {
    key: 'brand',
    label: 'Marca',
    type: 'relation',
    required: 'Si',
    fill: 'Selecciona la marca oficial del producto en Strapi.',
    example: 'Nutrisource',
  },
  {
    key: 'category',
    label: 'Categoria base',
    type: 'enum',
    required: 'Si',
    fill: 'Clasificacion operativa general: food, treats, hygiene, health, accesories u other.',
    example: 'food',
  },
  {
    key: 'form',
    label: 'Forma',
    type: 'enum',
    required: 'No',
    fill: 'Define el formato fisico real del producto.',
    example: 'kibble',
  },
  {
    key: 'proteinSource',
    label: 'Proteina principal',
    type: 'enum',
    required: 'No',
    fill: 'Usa la proteina dominante de la formula. Si mezcla varias sin una dominante clara, usa mixed.',
    example: 'chicken',
  },
  {
    key: 'speciesSupported',
    label: 'Especies soportadas',
    type: 'relation[]',
    required: 'Si',
    fill: 'Relacion biologica real del producto. Esto ayuda a filtros y recomendaciones.',
    example: 'Perro',
  },
  {
    key: 'lifeStages',
    label: 'Etapas de vida',
    type: 'relation[]',
    required: 'No',
    fill: 'Marca las etapas que el fabricante realmente soporta. Puedes ser estricto comercialmente o seguir la formulacion oficial.',
    example: 'Adulto',
  },
  {
    key: 'weightMinKg',
    label: 'Peso minimo',
    type: 'decimal',
    required: 'No',
    fill: 'Usalo solo si quieres afinar compatibilidad por talla o peso. Si no lo trabajaran aun, usa el estandar amplio.',
    example: '0',
  },
  {
    key: 'weightMaxKg',
    label: 'Peso maximo',
    type: 'decimal',
    required: 'No',
    fill: 'Complementa el peso minimo. Si no lo usaran todavia, mantengan el estandar amplio.',
    example: '999',
  },
  {
    key: 'diet_tags',
    label: 'Etiquetas de dieta',
    type: 'relation[]',
    required: 'No',
    fill: 'Solo agrega etiquetas comprobables desde la ficha oficial: libre de granos, alta proteina, urinario, etc.',
    example: 'Libre de granos',
  },
  {
    key: 'health_claims',
    label: 'Claims de salud',
    type: 'relation[]',
    required: 'No',
    fill: 'Relaciona beneficios funcionales claros y repetibles que si ayudan al filtrado posterior.',
    example: 'Digestivo, Soporte articular',
  },
  {
    key: 'ingredients',
    label: 'Ingredientes clave',
    type: 'relation[]',
    required: 'No',
    fill: 'Usa ingredientes importantes para busqueda o filtros. No hace falta meter toda la formula.',
    example: 'Pollo, Arroz integral',
  },
  {
    key: 'catalogAnimals',
    label: 'Animal del catalogo',
    type: 'relation[]',
    required: 'Si',
    fill: 'Relacion visual y comercial para la tienda. Debe estar alineado con speciesSupported.',
    example: 'Perro',
  },
  {
    key: 'catalogCategory',
    label: 'Categoria visual',
    type: 'relation',
    required: 'Si',
    fill: 'Es la clasificacion que hoy si conviene usar en tienda. Para nuevos productos, esta sustituye en la practica al viejo subcategory.',
    example: 'Alimento seco',
  },
  {
    key: 'badge',
    label: 'Badge',
    type: 'enum',
    required: 'No',
    fill: 'Etiqueta visual corta. Usala con criterio para NEW, TOP o SALE.',
    example: 'TOP',
  },
  {
    key: 'characteristics',
    label: 'Caracteristicas',
    type: 'blocks',
    required: 'Si',
    fill: 'Lista factual del producto: formato, ingrediente principal, analisis, tecnologia, presentaciones.',
    example: 'Croqueta seca, pollo ingrediente #1, con probioticos...',
  },
  {
    key: 'benefits',
    label: 'Beneficios',
    type: 'blocks',
    required: 'Si',
    fill: 'Lista de beneficios traducidos a valor para la mascota o el comprador. Deben salir de la ficha oficial, no inventados.',
    example: 'Apoya la salud digestiva y el bienestar general.',
  },
];

const RULES = [
  'Si el producto tiene variants, el stock raiz se recalcula con la suma de sus variantes.',
  'Si el producto tiene variants, el price raiz se recalcula con el menor precio de esas variantes.',
  'El campo subcategory se considera legado para producto. Para nuevos productos trabaja con catalogCategory.',
  'catalogAnimals y speciesSupported deben apuntar al mismo animal salvo casos muy especiales.',
  'diet_tags y health_claims deben cargarse solo cuando la ficha oficial lo respalde claramente.',
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findBrowser() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function toFileUrl(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return `file:///${normalized}`;
}

function printPdf(htmlPath, pdfPath) {
  const browser = findBrowser();
  if (!browser) {
    throw new Error('No encontre Edge o Chrome para exportar el PDF');
  }

  execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--run-all-compositor-stages-before-draw',
      `--print-to-pdf=${pdfPath}`,
      toFileUrl(htmlPath),
    ],
    { stdio: 'ignore' }
  );
}

function renderFieldCard(field) {
  return `
    <article class="field-card">
      <div class="field-card__top">
        <h3>${escapeHtml(field.label)}</h3>
        <code>${escapeHtml(field.key)}</code>
      </div>
      <table>
        <tbody>
          <tr><th>Tipo</th><td>${escapeHtml(field.type)}</td></tr>
          <tr><th>Obligatorio</th><td>${escapeHtml(field.required)}</td></tr>
          <tr><th>Como llenarlo</th><td>${escapeHtml(field.fill)}</td></tr>
          <tr><th>Ejemplo</th><td>${escapeHtml(field.example)}</td></tr>
        </tbody>
      </table>
    </article>
  `;
}

function buildHtml() {
  const generatedAt = new Date().toLocaleString('es-GT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const summaryRows = FIELD_GUIDE.map(
    (field, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><code>${escapeHtml(field.key)}</code></td>
        <td>${escapeHtml(field.label)}</td>
        <td>${escapeHtml(field.type)}</td>
        <td>${escapeHtml(field.required)}</td>
      </tr>
    `
  ).join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Guia de campos de producto</title>
  <style>
    @page {
      size: A4;
      margin: 14mm;
    }

    * { box-sizing: border-box; }

    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #172033;
      margin: 0;
      font-size: 11px;
      line-height: 1.42;
      background: #fff;
    }

    h1, h2, h3, p { margin: 0; }

    .cover {
      padding-bottom: 10mm;
      border-bottom: 2px solid #d6deef;
      margin-bottom: 10mm;
    }

    .cover h1 {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .cover p {
      margin-bottom: 6px;
      color: #41506b;
    }

    .cover ul {
      margin: 8px 0 0 18px;
      padding: 0;
    }

    .cover li {
      margin-bottom: 4px;
    }

    .summary-table,
    .field-card table {
      width: 100%;
      border-collapse: collapse;
    }

    .summary-table th,
    .summary-table td {
      border: 1px solid #d6deef;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }

    .summary-table th {
      background: #eef3ff;
    }

    .fields {
      page-break-before: always;
    }

    .field-card {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid #d6deef;
      border-radius: 10px;
      padding: 8px 9px;
      margin-bottom: 6mm;
      background: #fff;
    }

    .field-card__top {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: baseline;
      margin-bottom: 6px;
    }

    .field-card h3 {
      font-size: 14px;
    }

    .field-card th,
    .field-card td {
      border-top: 1px solid #edf1f8;
      padding: 5px 6px;
      text-align: left;
      vertical-align: top;
    }

    .field-card th {
      width: 24%;
      background: #f8fbff;
      font-weight: 600;
      color: #344054;
    }

    .legacy-box {
      margin-top: 8mm;
      padding: 8px 10px;
      border: 1px solid #ffd59f;
      border-radius: 10px;
      background: #fff8ef;
    }

    code {
      font-family: Consolas, "Courier New", monospace;
      font-size: 10px;
      background: #f4f7fb;
      padding: 1px 4px;
      border-radius: 4px;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <section class="cover">
    <h1>Guia de Campos de Producto</h1>
    <p><strong>Uso:</strong> referencia rapida para cargar productos en Strapi con un criterio consistente.</p>
    <p><strong>Generado:</strong> ${escapeHtml(generatedAt)}</p>
    <ul>
      ${RULES.map((rule) => `<li>${escapeHtml(rule)}</li>`).join('')}
    </ul>

    <h2 style="margin: 10mm 0 4mm;">Resumen de campos operativos</h2>
    <table class="summary-table">
      <thead>
        <tr>
          <th>#</th>
          <th>key</th>
          <th>Campo</th>
          <th>Tipo</th>
          <th>Obligatorio</th>
        </tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>

    <div class="legacy-box">
      <strong>Campo legado:</strong> <code>subcategory</code><br />
      Ya no se recomienda para productos nuevos. La clasificacion visual y comercial debe resolverse con <code>catalogCategory</code>.
    </div>
  </section>

  <section class="fields">
    ${FIELD_GUIDE.map(renderFieldCard).join('\n')}
  </section>
</body>
</html>`;
}

function main() {
  const html = buildHtml();
  fs.writeFileSync(HTML_PATH, html, 'utf8');
  printPdf(HTML_PATH, PDF_PATH);

  console.log(`HTML generado en: ${HTML_PATH}`);
  console.log(`PDF generado en: ${PDF_PATH}`);
}

main();
