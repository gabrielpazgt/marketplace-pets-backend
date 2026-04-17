const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const HTML_PATH = path.join(ROOT_DIR, 'catalogos-soporte-taxonomia.html');
const PDF_PATH = path.join(ROOT_DIR, 'catalogos-soporte-taxonomia.pdf');

const COLLECTIONS = [
  {
    title: 'Life Stage',
    summary:
      'Estos registros si hacen falta. Se usan en productos y en perfiles de mascota. El formulario actual reconoce especialmente Cachorro, Gatito, Adulto y Senior.',
    instructions: [
      'Llenar solo el campo name.',
      'Dejar que slug se genere automaticamente.',
      'Dejar vacias las relaciones products y pet_profiles.',
      'Guardar y luego publicar.',
      'Usar nombres sin acentos para evitar roces con alias del frontend.',
    ],
    records: [
      { name: 'Cachorro', slug: 'cachorro', note: 'Etapa temprana para perro.' },
      { name: 'Gatito', slug: 'gatito', note: 'Etapa temprana para gato.' },
      { name: 'Adulto', slug: 'adulto', note: 'Etapa general para animales adultos.' },
      { name: 'Senior', slug: 'senior', note: 'Etapa senior o geriatrica.' },
    ],
  },
  {
    title: 'Diet Tag',
    summary:
      'Estos registros tambien si hacen falta. Se usan para filtros de productos y para preferencias de dieta dentro del perfil de mascota.',
    instructions: [
      'Llenar solo el campo name.',
      'Dejar que slug se genere automaticamente.',
      'Dejar vacias las relaciones products y pet_profiles.',
      'Guardar y luego publicar.',
      'Mantener exactamente estos nombres para que coincidan con los alias del sistema.',
    ],
    records: [
      { name: 'Libre de granos', slug: 'libre-de-granos', note: 'Alias del sistema: grain_free.' },
      { name: 'Alta proteina', slug: 'alta-proteina', note: 'Alias del sistema: high_protein.' },
      { name: 'Bajas calorias', slug: 'bajas-calorias', note: 'Alias del sistema: low_calorie.' },
      { name: 'Salud urinaria', slug: 'salud-urinaria', note: 'Alias del sistema: urinary.' },
      { name: 'Soporte renal', slug: 'soporte-renal', note: 'Alias del sistema: renal.' },
      { name: 'Hipoalergenico', slug: 'hipoalergenico', note: 'Alias del sistema: hypoallergenic.' },
    ],
  },
  {
    title: 'Health Condition',
    summary:
      'Estos registros si sirven. Se usan como objetivos de salud en productos y tambien pueden alimentar alertas o condiciones en el perfil de mascota.',
    instructions: [
      'Llenar solo el campo name.',
      'Dejar que slug se genere automaticamente.',
      'Dejar vacias las relaciones products y pet_profiles.',
      'Guardar y luego publicar.',
      'Esta es una lista inicial; luego la ampliamos segun el catalogo real.',
    ],
    records: [
      { name: 'Digestivo', slug: 'digestivo', note: 'Soporte gastrointestinal y sensibilidad digestiva.' },
      { name: 'Dental', slug: 'dental', note: 'Higiene oral y apoyo dental.' },
      { name: 'Urinario', slug: 'urinario', note: 'Soporte del tracto urinario.' },
      { name: 'Renal', slug: 'renal', note: 'Soporte renal.' },
      { name: 'Piel y pelaje', slug: 'piel-y-pelaje', note: 'Salud dermatologica y del manto.' },
      { name: 'Articulaciones', slug: 'articulaciones', note: 'Movilidad y soporte articular.' },
      { name: 'Control de peso', slug: 'control-de-peso', note: 'Manejo de peso y calorias.' },
      { name: 'Calma y ansiedad', slug: 'calma-y-ansiedad', note: 'Estrés, viaje o rutina.' },
      { name: 'Energia', slug: 'energia', note: 'Rendimiento o vitalidad.' },
      { name: 'Inmunidad', slug: 'inmunidad', note: 'Soporte inmune general.' },
    ],
  },
  {
    title: 'Ingredient',
    summary:
      'Estos registros si hacen falta. Se usan para el filtro de ingrediente principal, para fichas de producto y para cruces con alergias o sensibilidades.',
    instructions: [
      'Llenar solo el campo name.',
      'Dejar que slug se genere automaticamente.',
      'Dejar vacia la relacion products por ahora.',
      'Guardar y luego publicar.',
      'Empieza con este set base y luego agregamos ingredientes nuevos cuando entren productos reales.',
    ],
    records: [
      { name: 'Pollo', slug: 'pollo', note: 'Proteina frecuente en perro y gato.' },
      { name: 'Res', slug: 'res', note: 'Proteina frecuente en perro y gato.' },
      { name: 'Pescado', slug: 'pescado', note: 'Categoria general util para varias lineas.' },
      { name: 'Salmon', slug: 'salmon', note: 'Muy usado en dietas sensibles y piel.' },
      { name: 'Atun', slug: 'atun', note: 'Frecuente en gato y formulas humedas.' },
      { name: 'Cordero', slug: 'cordero', note: 'Proteina comun en formulas especiales.' },
      { name: 'Pavo', slug: 'pavo', note: 'Proteina comun en formulas especiales.' },
      { name: 'Conejo', slug: 'conejo', note: 'Proteina alternativa.' },
      { name: 'Insecto', slug: 'insecto', note: 'Proteina emergente para sensibilidad.' },
      { name: 'Camaron', slug: 'camaron', note: 'Frecuente en formulas de peces y reptiles.' },
      { name: 'Heno', slug: 'heno', note: 'Muy util para roedores y pequenas mascotas.' },
      { name: 'Arroz', slug: 'arroz', note: 'Base comun en nutricion seca.' },
      { name: 'Maiz', slug: 'maiz', note: 'Base comun en nutricion seca.' },
      { name: 'Avena', slug: 'avena', note: 'Ingrediente base o funcional.' },
      { name: 'Proteina vegetal', slug: 'proteina-vegetal', note: 'Para formulas plant-based o mixtas.' },
    ],
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fieldRow(label, value) {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function renderRecordCard(collectionTitle, record, index) {
  return `
    <article class="record-card">
      <h4>${escapeHtml(collectionTitle)} ${index + 1}</h4>
      <table>
        <tbody>
          ${fieldRow('name', record.name)}
          ${fieldRow('slug esperado', record.slug)}
          ${fieldRow('relations', collectionTitle === 'Ingredient' ? 'products vacio' : 'relations vacias')}
          ${fieldRow('estado', 'Guardar y publicar')}
          ${fieldRow('nota', record.note)}
        </tbody>
      </table>
    </article>
  `;
}

function renderCollection(collection) {
  const summaryRows = collection.records
    .map(
      (record, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(record.name)}</td>
          <td><code>${escapeHtml(record.slug)}</code></td>
          <td>${escapeHtml(record.note)}</td>
        </tr>
      `
    )
    .join('');

  return `
    <section class="collection-section">
      <h2>${escapeHtml(collection.title)}</h2>
      <p class="collection-summary">${escapeHtml(collection.summary)}</p>
      <div class="instruction-box">
        <h3>Como llenarlo en Strapi</h3>
        <ul>
          ${collection.instructions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
      <table class="summary-table">
        <thead>
          <tr>
            <th>#</th>
            <th>name</th>
            <th>slug</th>
            <th>nota</th>
          </tr>
        </thead>
        <tbody>${summaryRows}</tbody>
      </table>
      <div class="record-grid">
        ${collection.records.map((record, index) => renderRecordCard(collection.title, record, index)).join('\n')}
      </div>
    </section>
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

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Catalogos de soporte para taxonomia</title>
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
      line-height: 1.4;
      background: #fff;
    }

    h1, h2, h3, h4, p { margin: 0; }

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
      margin-bottom: 5px;
    }

    .collection-section {
      page-break-before: always;
    }

    .collection-section h2 {
      font-size: 20px;
      margin-bottom: 8px;
    }

    .collection-summary {
      margin-bottom: 8px;
      color: #475467;
    }

    .instruction-box {
      border: 1px solid #d6deef;
      border-radius: 12px;
      padding: 10px 12px;
      background: #f8fbff;
      margin-bottom: 10px;
    }

    .instruction-box h3 {
      font-size: 14px;
      margin-bottom: 6px;
    }

    .instruction-box ul {
      margin: 0 0 0 18px;
      padding: 0;
    }

    .instruction-box li {
      margin-bottom: 4px;
    }

    .summary-table,
    .record-card table {
      width: 100%;
      border-collapse: collapse;
    }

    .summary-table {
      margin-bottom: 10px;
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

    .record-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .record-card {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid #d6deef;
      border-radius: 12px;
      padding: 8px 9px;
      background: #fff;
    }

    .record-card h4 {
      font-size: 13px;
      margin-bottom: 6px;
    }

    .record-card th,
    .record-card td {
      border-top: 1px solid #edf1f8;
      padding: 4px 6px;
      text-align: left;
      vertical-align: top;
    }

    .record-card th {
      width: 34%;
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
    }
  </style>
</head>
<body>
  <section class="cover">
    <h1>Catalogos de soporte para taxonomia</h1>
    <p><strong>Generado:</strong> ${escapeHtml(generatedAt)}</p>
    <p><strong>Objetivo:</strong> dejar listos los catalogos reutilizables que alimentan filtros, perfiles de mascota y relaciones reales de producto.</p>
    <ul>
      <li><strong>Catalog Animal + Catalog Category + Catalog Filter</strong> definen la navegacion y que filtros deberian existir.</li>
      <li><strong>Life Stage, Diet Tag, Health Condition e Ingredient</strong> guardan los valores reales que seleccionas en productos y mascotas.</li>
      <li>Sin estos catalogos, la taxonomia puede verse bonita, pero los filtros por etapa, dieta, salud e ingrediente no tendran datos reales para trabajar.</li>
      <li>Estas listas son un starter set sano. Luego las ampliamos cuando entren marcas y productos reales.</li>
    </ul>
  </section>

  ${COLLECTIONS.map((collection) => renderCollection(collection)).join('\n')}
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
  const html = buildHtml();
  fs.writeFileSync(HTML_PATH, html, 'utf8');
  printPdf(HTML_PATH, PDF_PATH);

  console.log(`HTML generado en: ${HTML_PATH}`);
  console.log(`PDF generado en: ${PDF_PATH}`);
}

main();
