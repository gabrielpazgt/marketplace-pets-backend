const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const HTML_PATH = path.join(ROOT_DIR, 'catalogo-marcas-strapi.html');
const PDF_PATH = path.join(ROOT_DIR, 'catalogo-marcas-strapi.pdf');

const BRANDS = [
  { name: 'Acana', observedCount: 4 },
  { name: 'Advance', observedCount: 8 },
  { name: 'Advance Veterinary Diets', observedCount: 8 },
  { name: 'Balance', observedCount: 8 },
  { name: 'Be Natural', observedCount: 4 },
  { name: 'Belcando', observedCount: 10 },
  { name: 'Birbo', observedCount: 4 },
  { name: 'Breed Health Nutrition', observedCount: 3 },
  { name: 'Cibau', observedCount: 9 },
  { name: 'Ecopet Natural', observedCount: 1 },
  { name: 'Element Series', observedCount: 1 },
  { name: 'Farmina', observedCount: 31 },
  { name: "Hill's", observedCount: 30 },
  { name: "Hill's Prescription Diet", observedCount: 12 },
  { name: "Hunter's Special", observedCount: 2 },
  { name: 'Instinct', observedCount: 15 },
  { name: 'Limited Ingredient', observedCount: 1 },
  { name: 'Monello', observedCount: 9 },
  { name: 'N&D Ancestral', observedCount: 8 },
  { name: 'N&D Ocean', observedCount: 2 },
  { name: 'N&D Prime', observedCount: 2 },
  { name: 'N&D Quinoa', observedCount: 2 },
  { name: 'N&D Tropical Selection', observedCount: 6 },
  { name: 'N&D White', observedCount: 1 },
  { name: 'Nutrience', observedCount: 8 },
  { name: 'Nutrisource', observedCount: 31 },
  { name: 'Original', observedCount: 2 },
  { name: 'Pure Vita', observedCount: 11 },
  { name: 'Raw Boost', observedCount: 5 },
  { name: 'Royal Canin', observedCount: 53 },
  { name: 'Science Diet', observedCount: 18 },
  { name: 'Select By Monello', observedCount: 4 },
  { name: 'Size Health Nutrition', observedCount: 10 },
  { name: 'Small Bites', observedCount: 4 },
  { name: 'Small Paws', observedCount: 4 },
  { name: 'Sportmix', observedCount: 1 },
  { name: 'Star Pro', observedCount: 7 },
  { name: 'Taste of the Wild', observedCount: 8 },
  { name: "Tuffy's", observedCount: 2 },
  { name: 'Vet Life', observedCount: 9 },
  { name: 'Veterinary Diet', observedCount: 9 },
  { name: 'Wholesomes', observedCount: 1 },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' ')
    .replace(/['"]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function fieldRow(label, value, useCode = false) {
  const rendered = useCode
    ? `<code>${escapeHtml(value || '')}</code>`
    : `<span>${escapeHtml(value || '')}</span>`;

  return `<tr><th>${escapeHtml(label)}</th><td>${rendered}</td></tr>`;
}

function renderCard(brand, index) {
  const slug = slugify(brand.name);
  const fields = [
    ['name', brand.name, false],
    ['slug sugerido', slug, true],
    ['website', '(dejar vacio por ahora)', false],
    ['logo', '(opcional por ahora)', false],
    ['isActive', 'TRUE', false],
    ['publicar', 'Si, despues de guardar', false],
    ['referencia en tienda', `${brand.observedCount} productos visibles`, false],
  ];

  return `
    <article class="record-card">
      <h3>${index + 1}. ${escapeHtml(brand.name)}</h3>
      <p class="record-note">Cargar en Strapi dentro de <code>Brand</code>.</p>
      <table>
        <tbody>
          ${fields.map(([label, value, useCode]) => fieldRow(label, value, useCode)).join('')}
        </tbody>
      </table>
    </article>
  `;
}

function buildHtml(brands) {
  const generatedAt = new Date().toLocaleString('es-GT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const summaryRows = brands
    .map(
      (brand, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(brand.name)}</td>
          <td><code>${escapeHtml(slugify(brand.name))}</code></td>
          <td>${brand.observedCount}</td>
          <td>TRUE</td>
        </tr>
      `
    )
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Catalogo de Marcas para Strapi</title>
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
      padding-bottom: 9mm;
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
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5mm;
    }

    .record-card {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid #d6deef;
      border-radius: 10px;
      padding: 8px 9px;
      background: #fff;
    }

    .record-card h3 {
      font-size: 13px;
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
      width: 36%;
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

    .hint {
      color: #5a6883;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <section class="cover">
    <h1>Catalogo de Marcas para Strapi</h1>
    <p><strong>Contenido:</strong> marcas transcritas de tus capturas para cargarlas en <code>Brand</code>.</p>
    <p><strong>Generado:</strong> ${escapeHtml(generatedAt)}</p>
    <p><strong>Total de marcas:</strong> ${brands.length}</p>
    <ul>
      <li>Esta lista esta transcrita tal como aparece en la tienda.</li>
      <li>El campo <code>name</code> es el importante; <code>slug</code> puede autogenerarse desde el nombre.</li>
      <li><code>website</code> y <code>logo</code> pueden quedar vacios por ahora.</li>
      <li>Deja <code>isActive</code> en <code>TRUE</code> y publica cada marca.</li>
      <li>La columna <code>referencia en tienda</code> no es un campo de Strapi; solo te ayuda a validar lo que viste en pantalla.</li>
      <li>Varias entradas pueden ser lineas comerciales y no marca madre; por ahora se dejaron exactamente como las capturas.</li>
    </ul>

    <h2 style="margin: 10mm 0 4mm;">Resumen</h2>
    <table class="summary-table">
      <thead>
        <tr>
          <th>#</th>
          <th>name</th>
          <th>slug sugerido</th>
          <th>referencia en tienda</th>
          <th>isActive</th>
        </tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>
    <p class="hint" style="margin-top: 4mm;">Schema actual de Brand: name, slug, logo, website, isActive.</p>
  </section>

  <section class="records">
    ${brands.map((brand, index) => renderCard(brand, index)).join('\n')}
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
  const html = buildHtml(BRANDS);
  fs.writeFileSync(HTML_PATH, html, 'utf8');
  printPdf(HTML_PATH, PDF_PATH);

  console.log(`HTML generado en: ${HTML_PATH}`);
  console.log(`PDF generado en: ${PDF_PATH}`);
}

main();
