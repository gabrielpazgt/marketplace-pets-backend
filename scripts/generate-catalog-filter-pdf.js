const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SOURCE_PATH = path.join(__dirname, '..', 'src', 'api', 'storefront', 'utils', 'catalog-taxonomy.ts');
const HTML_PATH = path.join(ROOT_DIR, 'catalogo-filtros.html');
const PDF_PATH = path.join(ROOT_DIR, 'catalogo-filtros.pdf');

function loadFilterLibrary() {
  const text = fs.readFileSync(SOURCE_PATH, 'utf8');
  const startToken = 'const FILTER_LIBRARY: Record<string, CatalogFilterDefinition> = ';
  const endToken = '};\n\nconst pickFilters';
  const start = text.indexOf(startToken);
  const end = text.indexOf(endToken, start);

  if (start === -1 || end === -1) {
    throw new Error('No pude localizar FILTER_LIBRARY en catalog-taxonomy.ts');
  }

  const literal = text.slice(start + startToken.length, end + 1);
  return vm.runInNewContext(`(${literal})`);
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

function renderCard(filter, index) {
  const sortOrder = (index + 1) * 10;
  const fields = [
    ['key', filter.key],
    ['label', filter.label],
    ['rationale', filter.rationale || '(vacio)'],
    ['availability', 'available'],
    ['control', filter.control || '(sin definir)'],
    ['sortOrder', String(sortOrder)],
    ['isActive', 'TRUE'],
    ['recommendedByCategories', '(vacio por ahora)'],
  ];

  return `
    <article class="record-card">
      <h3>${escapeHtml(filter.label)}</h3>
      <p class="record-note">Registro ${index + 1}. Crear, guardar y publicar exactamente con estos valores.</p>
      <table>
        <tbody>
          ${fields.map(([label, value]) => fieldRow(label, value)).join('')}
        </tbody>
      </table>
    </article>
  `;
}

function buildHtml(filters) {
  const now = new Date();
  const generatedAt = now.toLocaleString('es-GT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const summaryRows = filters
    .map(
      (filter, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><code>${escapeHtml(filter.key)}</code></td>
          <td>${escapeHtml(filter.label)}</td>
          <td>available</td>
          <td><code>${escapeHtml(filter.control || '')}</code></td>
          <td>${(index + 1) * 10}</td>
        </tr>
      `
    )
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Catalogo de Filtros</title>
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
      line-height: 1.36;
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
    <h1>Catalogo de Filtros</h1>
    <p><strong>Contenido:</strong> plantilla completa para llenar <code>Catalog Filter</code> en Strapi.</p>
    <p><strong>Generado:</strong> ${escapeHtml(generatedAt)}</p>
    <ul>
      <li>Usa exactamente estos <code>key</code>; no los traduzcas ni les cambies guiones.</li>
      <li>El campo <code>control</code> debe llenarse exactamente como aparece en este documento.</li>
      <li>El campo <code>recommendedByCategories</code> puede quedar vacio por ahora.</li>
      <li>Todos los filtros de este PDF deben cargarse como <code>available</code> en Strapi.</li>
      <li>Despues de guardar cada filtro, publicalo.</li>
    </ul>

    <h2 style="margin: 10mm 0 4mm;">Resumen</h2>
    <table class="summary-table">
      <thead>
        <tr>
          <th>#</th>
          <th>key</th>
          <th>label</th>
          <th>availability</th>
          <th>control</th>
          <th>sortOrder</th>
        </tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </section>

  <section class="records">
    ${filters.map((filter, index) => renderCard(filter, index)).join('\n')}
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
  const library = loadFilterLibrary();
  const filters = Object.values(library);
  const html = buildHtml(filters);

  fs.writeFileSync(HTML_PATH, html, 'utf8');
  printPdf(HTML_PATH, PDF_PATH);

  console.log(`HTML generado en: ${HTML_PATH}`);
  console.log(`PDF generado en: ${PDF_PATH}`);
}

main();
