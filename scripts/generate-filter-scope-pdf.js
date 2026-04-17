const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const TAXONOMY_SOURCE_PATH = path.join(__dirname, '..', 'src', 'api', 'storefront', 'utils', 'catalog-taxonomy.ts');
const HTML_PATH = path.join(ROOT_DIR, 'filter-scope-catalogo.html');
const PDF_PATH = path.join(ROOT_DIR, 'filter-scope-catalogo.pdf');

const FILTER_SCOPE_KEY_MAP = {
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

const FILTER_SCOPE_SORT_ORDER = {
  brand: 10,
  price: 20,
  form: 30,
  proteinSource: 40,
  species: 50,
  lifeStage: 60,
  dietTag: 70,
  healthCondition: 80,
  ingredient: 90,
};

const SKIPPED_CATEGORY_SCOPES = new Set([
  'dog:suministros',
]);

function loadTaxonomyPayload() {
  const source = fs.readFileSync(TAXONOMY_SOURCE_PATH, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const moduleObj = { exports: {} };
  const sandbox = {
    module: moduleObj,
    exports: moduleObj.exports,
    require,
    console,
    process,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: TAXONOMY_SOURCE_PATH });
  if (typeof moduleObj.exports.getCatalogTaxonomyPayload !== 'function') {
    throw new Error('No pude cargar getCatalogTaxonomyPayload desde catalog-taxonomy.ts');
  }

  return moduleObj.exports.getCatalogTaxonomyPayload();
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
    : `<span>${escapeHtml(value || '')}</span>`;

  return `<tr><th>${escapeHtml(label)}</th><td>${rendered}</td></tr>`;
}

function rootCategoryCode(animal, category) {
  return `${animal.key}:category:${category.slug}`;
}

function collectScopeRecords(payload) {
  const animals = payload?.data?.animals || [];
  const records = [];

  for (const animal of animals) {
    for (const category of animal.categories || []) {
      const skipKey = `${animal.key}:${category.slug}`;
      if (SKIPPED_CATEGORY_SCOPES.has(skipKey)) {
        continue;
      }

      const filterKeys = Array.from(
        new Set(
          (category.recommendedFilters || [])
            .map((item) => FILTER_SCOPE_KEY_MAP[item.key])
            .filter(Boolean)
        )
      ).sort((a, b) => FILTER_SCOPE_SORT_ORDER[a] - FILTER_SCOPE_SORT_ORDER[b]);

      for (const filterKey of filterKeys) {
        records.push({
          title: `${animal.label} / ${category.label} / ${filterKey}`,
          animal,
          category,
          filterKey,
          sortOrder: FILTER_SCOPE_SORT_ORDER[filterKey] || 50,
          categoryCode: rootCategoryCode(animal, category),
        });
      }
    }
  }

  return records;
}

function renderRecordCard(record, index) {
  const fields = [
    ['filterKey', record.filterKey],
    ['animals', `${record.animal.label} [${record.animal.key}]`],
    ['categories', `${record.category.label} [${record.categoryCode}]`],
    ['sortOrder', String(record.sortOrder)],
    ['isVisible', 'TRUE'],
  ];

  return `
    <article class="record-card">
      <h3>${escapeHtml(record.title)}</h3>
      <p class="record-note">Registro ${index + 1}. Crear, guardar. Esta tabla no usa publish.</p>
      <table>
        <tbody>
          ${fields.map(([label, value]) => fieldRow(label, value)).join('')}
        </tbody>
      </table>
    </article>
  `;
}

function buildHtml(records) {
  const generatedAt = new Date().toLocaleString('es-GT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const summaryRows = records
    .map(
      (record, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(record.animal.label)}</td>
          <td>${escapeHtml(record.category.label)}</td>
          <td><code>${escapeHtml(record.categoryCode)}</code></td>
          <td><code>${escapeHtml(record.filterKey)}</code></td>
          <td>${record.sortOrder}</td>
        </tr>
      `
    )
    .join('');

  const mappingRows = Object.entries(FILTER_SCOPE_KEY_MAP)
    .map(
      ([catalogFilterKey, filterScopeKey]) => `
        <tr>
          <td><code>${escapeHtml(catalogFilterKey)}</code></td>
          <td><code>${escapeHtml(filterScopeKey)}</code></td>
        </tr>
      `
    )
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Filter Scope para produccion</title>
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
      line-height: 1.35;
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
    }

    .cover ul {
      margin: 8px 0 0 18px;
      padding: 0;
    }

    .cover li {
      margin-bottom: 4px;
    }

    .summary-table,
    .mapping-table,
    .record-card table {
      width: 100%;
      border-collapse: collapse;
    }

    .summary-table th,
    .summary-table td,
    .mapping-table th,
    .mapping-table td {
      border: 1px solid #d6deef;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }

    .summary-table th,
    .mapping-table th {
      background: #eef3ff;
    }

    .mapping-block {
      margin-top: 8mm;
    }

    .records {
      page-break-before: always;
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

    .record-card h3 {
      font-size: 14px;
      margin-bottom: 4px;
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
    <h1>Filter Scope para produccion</h1>
    <p><strong>Contenido:</strong> registros completos para llenar <code>Filter Scope</code> en Strapi, amarrados por <code>animal + categoria raiz</code>.</p>
    <p><strong>Generado:</strong> ${escapeHtml(generatedAt)}</p>
    <ul>
      <li>Esta tabla no usa publish. Solo guardar.</li>
      <li>Siempre llena ambas relaciones: <code>animals</code> y <code>categories</code>.</li>
      <li>No dejes una de las relaciones vacia si quieres comportamiento exacto en produccion.</li>
      <li>La relacion <code>categories</code> debe apuntar a la categoria raiz, no a una subcategoria.</li>
      <li>No crear registros para <code>stock</code>; ese checkbox sigue visible por fuera de Filter Scope.</li>
      <li>No crear registros para filtros tecnicos como <code>breed-size</code>, <code>weight-range</code>, <code>material</code>, <code>weather</code> o similares. Esos ya viven en la taxonomia y no forman parte del drawer principal.</li>
      <li>Para Perro se omitio <code>dog:category:suministros</code> porque en este proyecto ya se fusiono dentro de <code>dog:category:accesorios</code>.</li>
    </ul>

    <div class="mapping-block">
      <h2 style="margin-bottom: 4mm;">Mapa de claves</h2>
      <table class="mapping-table">
        <thead>
          <tr>
            <th>Catalog Filter.key</th>
            <th>Filter Scope.filterKey</th>
          </tr>
        </thead>
        <tbody>${mappingRows}</tbody>
      </table>
    </div>

    <h2 style="margin: 8mm 0 4mm;">Resumen</h2>
    <table class="summary-table">
      <thead>
        <tr>
          <th>#</th>
          <th>animal</th>
          <th>categoria</th>
          <th>codigo de categoria</th>
          <th>filterKey</th>
          <th>sortOrder</th>
        </tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </section>

  <section class="records">
    ${records.map((record, index) => renderRecordCard(record, index)).join('\n')}
  </section>
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

function main() {
  const payload = loadTaxonomyPayload();
  const records = collectScopeRecords(payload);
  const html = buildHtml(records);

  fs.writeFileSync(HTML_PATH, html, 'utf8');
  printPdf(HTML_PATH, PDF_PATH);

  console.log(`Registros generados: ${records.length}`);
  console.log(`HTML generado en: ${HTML_PATH}`);
  console.log(`PDF generado en: ${PDF_PATH}`);
}

main();
