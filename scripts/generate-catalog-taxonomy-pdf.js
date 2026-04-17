const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SOURCE_PATH = path.join(__dirname, 'seed-catalog-taxonomy.js');
const HTML_PATH = path.join(ROOT_DIR, 'catalogo-taxonomia-categorias.html');
const PDF_PATH = path.join(ROOT_DIR, 'catalogo-taxonomia-categorias.pdf');

function loadAnimals() {
  const text = fs.readFileSync(SOURCE_PATH, 'utf8');
  const start = text.indexOf('const ANIMALS = [');
  const end = text.indexOf('];\n\n//', start);

  if (start === -1 || end === -1) {
    throw new Error('No pude localizar la constante ANIMALS en seed-catalog-taxonomy.js');
  }

  const literal = text.slice(start + 'const ANIMALS = '.length, end + 1);
  return vm.runInNewContext(literal);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fieldRow(label, value) {
  const rendered = Array.isArray(value)
    ? `<code>${escapeHtml(JSON.stringify(value))}</code>`
    : String(value || '').startsWith('<')
      ? String(value)
      : `<span>${escapeHtml(value || '')}</span>`;

  return `<tr><th>${escapeHtml(label)}</th><td>${rendered}</td></tr>`;
}

function renderRecordCard(title, fields, note = '') {
  return `
    <article class="record-card">
      <h4>${escapeHtml(title)}</h4>
      ${note ? `<p class="record-note">${escapeHtml(note)}</p>` : ''}
      <table>
        <tbody>
          ${fields.map(([label, value]) => fieldRow(label, value)).join('')}
        </tbody>
      </table>
    </article>
  `;
}

function rootCategoryCode(animal, category) {
  return `${animal.key}:category:${category.slug}`;
}

function subcategoryCode(animal, category, subcategory) {
  return `${rootCategoryCode(animal, category)}:subcategory:${subcategory.slug}`;
}

function buildCategoryFields(animal, category) {
  return [
    ['code', rootCategoryCode(animal, category)],
    ['key', category.slug],
    ['slug', category.slug],
    ['label', category.label],
    ['description', '(vacío)'],
    ['level', 'category'],
    ['legacyCategory', category.legacyCategory || '(vacío)'],
    ['matchTerms', []],
    ['sortOrder', String((category.sortOrder || 0) * 10)],
    ['isActive', 'TRUE'],
    ['animal', `${animal.key} / ${animal.label}`],
    ['parent', '(vacío)'],
    ['children', 'No ingresar manualmente'],
    ['recommendedFilters', '(vacío por ahora)'],
    ['navigationImage', '(vacío por ahora)'],
  ];
}

function buildSubcategoryFields(animal, category, subcategory) {
  return [
    ['code', subcategoryCode(animal, category, subcategory)],
    ['key', subcategory.slug],
    ['slug', subcategory.slug],
    ['label', subcategory.label],
    ['description', '(vacío)'],
    ['level', 'subcategory'],
    ['legacyCategory', '(vacío)'],
    ['matchTerms', []],
    ['sortOrder', String((subcategory.sortOrder || 0) * 10)],
    ['isActive', 'TRUE'],
    ['animal', `${animal.key} / ${animal.label}`],
    ['parent', `${category.label} [${rootCategoryCode(animal, category)}]`],
    ['children', 'No ingresar manualmente'],
    ['recommendedFilters', '(vacío por ahora)'],
    ['navigationImage', '(vacío por ahora)'],
  ];
}

function renderCatalogAnimalSummary(animals) {
  const rows = animals
    .map(
      (animal) => `
        <tr>
          <td><code>${escapeHtml(animal.key)}</code></td>
          <td><code>${escapeHtml(animal.slug)}</code></td>
          <td>${escapeHtml(animal.label)}</td>
          <td>${escapeHtml(String(animal.sortOrder || 0))}</td>
        </tr>
      `
    )
    .join('');

  return `
    <section class="cover-block">
      <h2>Catalog Animal disponibles</h2>
      <table class="summary-table">
        <thead>
          <tr>
            <th>key</th>
            <th>slug</th>
            <th>label</th>
            <th>sortOrder</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function renderAnimalSection(animal) {
  const categoryBlocks = (animal.categories || [])
    .map((category) => {
      const categoryCard = renderRecordCard(
        `${animal.label} · Categoría raíz · ${category.label}`,
        buildCategoryFields(animal, category),
        'Crear primero esta categoría raíz, publicarla y luego usarla como parent de sus subcategorías.'
      );

      const subcategoryCards = (category.subcategories || [])
        .map((subcategory) =>
          renderRecordCard(
            `${animal.label} · Subcategoría · ${subcategory.label}`,
            buildSubcategoryFields(animal, category, subcategory)
          )
        )
        .join('');

      return `
        <section class="category-block">
          <h3>${escapeHtml(category.label)}</h3>
          <div class="records-grid">
            ${categoryCard}
            ${subcategoryCards}
          </div>
        </section>
      `;
    })
    .join('');

  return `
    <section class="animal-section">
      <div class="animal-header">
        <h2>${escapeHtml(animal.label)}</h2>
        <p><strong>Catalog Animal:</strong> <code>${escapeHtml(animal.key)}</code> / <code>${escapeHtml(animal.slug)}</code></p>
        <p><strong>Uso:</strong> selecciona este animal en el campo <code>animal</code> al crear cada categoría o subcategoría.</p>
      </div>
      ${categoryBlocks}
    </section>
  `;
}

function buildHtml(animals) {
  const now = new Date();
  const generatedAt = now.toLocaleString('es-GT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Catálogo de Taxonomía · Categorías y Subcategorías</title>
  <style>
    @page {
      size: A4;
      margin: 14mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #172033;
      margin: 0;
      font-size: 11px;
      line-height: 1.35;
      background: #fff;
    }

    h1, h2, h3, h4, p {
      margin: 0;
    }

    .cover {
      padding-bottom: 12mm;
      border-bottom: 2px solid #d6deef;
      margin-bottom: 10mm;
    }

    .cover h1 {
      font-size: 24px;
      margin-bottom: 8px;
      color: #0e1726;
    }

    .cover p {
      margin-bottom: 6px;
      max-width: 900px;
    }

    .cover ul {
      margin: 8px 0 0 18px;
      padding: 0;
    }

    .cover li {
      margin-bottom: 4px;
    }

    .cover-block {
      margin-top: 12mm;
    }

    .summary-table,
    .record-card table {
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

    .animal-section {
      page-break-before: always;
    }

    .animal-header {
      margin-bottom: 8mm;
      padding: 10px 12px;
      background: #f6f9ff;
      border: 1px solid #d6deef;
      border-radius: 10px;
    }

    .animal-header h2 {
      font-size: 21px;
      margin-bottom: 6px;
    }

    .animal-header p {
      margin-bottom: 4px;
    }

    .category-block {
      margin-bottom: 10mm;
    }

    .category-block h3 {
      font-size: 16px;
      margin-bottom: 5mm;
      padding-bottom: 4px;
      border-bottom: 1px solid #d6deef;
    }

    .records-grid {
      display: block;
    }

    .record-card {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid #d6deef;
      border-radius: 10px;
      padding: 8px 9px;
      margin-bottom: 6mm;
      background: #fff;
    }

    .record-card h4 {
      font-size: 13px;
      margin-bottom: 4px;
      color: #0e1726;
    }

    .record-note {
      margin-bottom: 6px;
      color: #5a6883;
    }

    .record-card th,
    .record-card td {
      border-top: 1px solid #edf1f8;
      padding: 4px 6px;
      text-align: left;
      vertical-align: top;
    }

    .record-card th {
      width: 28%;
      background: #f8fbff;
      font-weight: 600;
      color: #344054;
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
    <h1>Catálogo de Taxonomía</h1>
    <p><strong>Contenido:</strong> categorías y subcategorías para cada especie, siguiendo el orden exacto de campos del formulario de <code>Catalog Category</code>.</p>
    <p><strong>Generado:</strong> ${escapeHtml(generatedAt)}</p>
    <ul>
      <li>El campo <code>code</code> es único y no se puede repetir. Por eso una categoría raíz no puede llevar solo <code>bird</code> o <code>dog</code>.</li>
      <li>Patrón de categoría raíz: <code>&lt;animalKey&gt;:category:&lt;categorySlug&gt;</code>.</li>
      <li>Patrón de subcategoría: <code>&lt;animalKey&gt;:category:&lt;categorySlug&gt;:subcategory:&lt;subcategorySlug&gt;</code>.</li>
      <li>En esta plantilla se dejan <code>description</code>, <code>recommendedFilters</code> y <code>navigationImage</code> vacíos para avanzar primero con la taxonomía base.</li>
      <li>El campo <code>children</code> no se llena manualmente; Strapi lo arma al relacionar cada subcategoría con su <code>parent</code>.</li>
      <li>Después de guardar cada registro, publícalo.</li>
    </ul>
    ${renderCatalogAnimalSummary(animals)}
  </section>
  ${animals.map(renderAnimalSection).join('\n')}
</body>
</html>`;
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
    throw new Error('No encontré Edge o Chrome para exportar el PDF');
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

function main() {
  const animals = loadAnimals();
  const html = buildHtml(animals);
  fs.writeFileSync(HTML_PATH, html, 'utf8');
  printPdf(HTML_PATH, PDF_PATH);

  console.log(`HTML generado en: ${HTML_PATH}`);
  console.log(`PDF generado en: ${PDF_PATH}`);
}

main();
