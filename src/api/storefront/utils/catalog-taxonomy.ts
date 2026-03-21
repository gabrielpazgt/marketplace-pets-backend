export type CatalogFilterAvailability = 'available' | 'planned';

export interface CatalogFilterDefinition {
  key: string;
  label: string;
  rationale: string;
  availability: CatalogFilterAvailability;
  control: string | null;
}

export interface CatalogTaxonomyLeaf {
  key: string;
  slug: string;
  label: string;
}

export interface CatalogTaxonomySubcategory extends CatalogTaxonomyLeaf {
  description: string;
  recommendedFilters: CatalogFilterDefinition[];
  level4: CatalogTaxonomyLeaf[];
}

export interface CatalogTaxonomyCategory extends CatalogTaxonomyLeaf {
  legacyCategory: string | null;
  description: string;
  recommendedFilters: CatalogFilterDefinition[];
  subcategories: CatalogTaxonomySubcategory[];
}

export interface CatalogTaxonomyAnimal extends CatalogTaxonomyLeaf {
  description: string;
  legacySpeciesHints: string[];
  categories: CatalogTaxonomyCategory[];
}

const FILTER_LIBRARY: Record<string, CatalogFilterDefinition> = {
  brand: {
    key: 'brand',
    label: 'Marca',
    rationale: 'Ayuda a separar lineas con formulaciones y respaldos distintos dentro de una misma necesidad.',
    availability: 'available',
    control: 'brandId',
  },
  price: {
    key: 'price',
    label: 'Precio',
    rationale: 'Permite comparar presentaciones y evitar mezclar soluciones de ticket muy diferente.',
    availability: 'available',
    control: 'price',
  },
  stock: {
    key: 'stock',
    label: 'Disponible',
    rationale: 'Es clave en tratamientos, dietas o insumos de uso continuo donde no conviene mostrar faltantes.',
    availability: 'available',
    control: 'stock',
  },
  form: {
    key: 'form',
    label: 'Formato',
    rationale: 'En nutricion y cuidado cambia mucho la decision entre seco, humedo, pellets, liquido o tabletas.',
    availability: 'available',
    control: 'form',
  },
  'protein-source': {
    key: 'protein-source',
    label: 'Proteina o sabor',
    rationale: 'Es uno de los filtros clinicos mas utiles cuando hay sensibilidad digestiva, rechazo o rotacion de dieta.',
    availability: 'available',
    control: 'proteinSource',
  },
  species: {
    key: 'species',
    label: 'Especie',
    rationale: 'Evita cruces inseguros entre productos de distinta especie o habitat.',
    availability: 'available',
    control: 'specieId',
  },
  'life-stage': {
    key: 'life-stage',
    label: 'Etapa de vida',
    rationale: 'Cachorro, adulto, senior o crecimiento cambian requerimientos energeticos y de soporte.',
    availability: 'available',
    control: 'lifeStageId',
  },
  'diet-tags': {
    key: 'diet-tags',
    label: 'Dieta especial',
    rationale: 'Sirve para segmentar formulas con foco renal, urinario, hipoalergenico o similares.',
    availability: 'available',
    control: 'dietTagId',
  },
  'health-goal': {
    key: 'health-goal',
    label: 'Objetivo de salud',
    rationale: 'Ordena productos por beneficio esperado: digestivo, dental, urinario, piel, articulaciones y otros.',
    availability: 'available',
    control: 'healthConditionId',
  },
  ingredients: {
    key: 'ingredients',
    label: 'Ingrediente principal',
    rationale: 'Ayuda a revisar tolerancia, preferencia y exclusiones frecuentes en nutricion y cuidado.',
    availability: 'available',
    control: 'ingredientId',
  },
  'breed-size': {
    key: 'breed-size',
    label: 'Tamano de raza',
    rationale: 'En perros y gatos cambia dosis, textura y densidad energetica, sobre todo en alimento y dental.',
    availability: 'planned',
    control: null,
  },
  'weight-range': {
    key: 'weight-range',
    label: 'Rango de peso',
    rationale: 'Ayuda a recomendar dosis, tallas o cargas de trabajo segun el peso corporal.',
    availability: 'planned',
    control: null,
  },
  prescription: {
    key: 'prescription',
    label: 'Uso veterinario',
    rationale: 'Importa para separar formulas terapeuticas o productos que deben revisarse con criterio clinico.',
    availability: 'planned',
    control: null,
  },
  'active-ingredient': {
    key: 'active-ingredient',
    label: 'Ingrediente activo',
    rationale: 'En farmacia y antiparasitarios es el filtro mas claro para comparar eficacia y rotacion.',
    availability: 'planned',
    control: null,
  },
  'parasite-target': {
    key: 'parasite-target',
    label: 'Parasito objetivo',
    rationale: 'Conviene distinguir pulgas, garrapatas, acaros o desparasitacion interna.',
    availability: 'planned',
    control: null,
  },
  'coat-type': {
    key: 'coat-type',
    label: 'Tipo de pelaje',
    rationale: 'En shampoos, cepillos y grooming cambia mucho segun pelo corto, largo, doble capa o sensible.',
    availability: 'planned',
    control: null,
  },
  absorbency: {
    key: 'absorbency',
    label: 'Absorcion',
    rationale: 'En arenas y sustratos define limpieza, frecuencia de recambio y experiencia del tutor.',
    availability: 'planned',
    control: null,
  },
  'odor-control': {
    key: 'odor-control',
    label: 'Control de olor',
    rationale: 'Es especialmente importante en arena, sustrato y soluciones de higiene de uso diario.',
    availability: 'planned',
    control: null,
  },
  'litter-texture': {
    key: 'litter-texture',
    label: 'Textura de arena o sustrato',
    rationale: 'Algunos gatos y roedores prefieren granulometrias concretas y eso afecta la adherencia.',
    availability: 'planned',
    control: null,
  },
  'habitat-size': {
    key: 'habitat-size',
    label: 'Tamano de habitat',
    rationale: 'En jaulas, acuarios y terrarios es un filtro tecnico basico para bienestar y compatibilidad.',
    availability: 'planned',
    control: null,
  },
  'water-type': {
    key: 'water-type',
    label: 'Tipo de agua',
    rationale: 'Acuariofilia necesita separar agua dulce, marino, goldfish, tropical o tortuguera.',
    availability: 'planned',
    control: null,
  },
  'tank-capacity': {
    key: 'tank-capacity',
    label: 'Capacidad',
    rationale: 'Facilita elegir filtros, calentadores y bombas segun litros o volumen util.',
    availability: 'planned',
    control: null,
  },
  'uvb-output': {
    key: 'uvb-output',
    label: 'Salida UVB o calor',
    rationale: 'En reptiles conviene separar potencia y tipo de emision para no recomendar equipo inadecuado.',
    availability: 'planned',
    control: null,
  },
  'substrate-type': {
    key: 'substrate-type',
    label: 'Tipo de sustrato',
    rationale: 'Ayuda a separar fibra, arena, papel, corteza u otras bases segun especie y humedad.',
    availability: 'planned',
    control: null,
  },
  material: {
    key: 'material',
    label: 'Material',
    rationale: 'En jaulas, comederos, acuarios, ropa o equipo conviene distinguir plastico, metal, vidrio y tela.',
    availability: 'planned',
    control: null,
  },
  weather: {
    key: 'weather',
    label: 'Clima o temporada',
    rationale: 'Ropa y equipo de exterior se benefician de separar frio, lluvia, verano o uso mixto.',
    availability: 'planned',
    control: null,
  },
  'training-use': {
    key: 'training-use',
    label: 'Uso de entrenamiento',
    rationale: 'Correas, bozales, juguetes y premios cambian segun paseo, obediencia, enrichment o deporte.',
    availability: 'planned',
    control: null,
  },
};

const pickFilters = (keys: string[]) =>
  keys
    .map((key) => FILTER_LIBRARY[key])
    .filter((item): item is CatalogFilterDefinition => Boolean(item));

const leaf = (slug: string, label: string): CatalogTaxonomyLeaf => ({
  key: slug,
  slug,
  label,
});

const subcategory = (
  slug: string,
  label: string,
  description: string,
  recommendedFilterKeys: string[] = [],
  level4: CatalogTaxonomyLeaf[] = []
): CatalogTaxonomySubcategory => ({
  ...leaf(slug, label),
  description,
  recommendedFilters: pickFilters(recommendedFilterKeys),
  level4,
});

const category = (
  slug: string,
  label: string,
  legacyCategory: string | null,
  description: string,
  recommendedFilterKeys: string[],
  subcategories: CatalogTaxonomySubcategory[]
): CatalogTaxonomyCategory => ({
  ...leaf(slug, label),
  legacyCategory,
  description,
  recommendedFilters: pickFilters(recommendedFilterKeys),
  subcategories,
});

const animal = (
  slug: string,
  label: string,
  description: string,
  legacySpeciesHints: string[],
  categories: CatalogTaxonomyCategory[]
): CatalogTaxonomyAnimal => ({
  ...leaf(slug, label),
  description,
  legacySpeciesHints,
  categories,
});

const animals: CatalogTaxonomyAnimal[] = [
  animal(
    'dog',
    'Perro',
    'Perro: conviene separar nutricion, farmacia, cuidado rutinario, aseo, descanso y equipo de uso diario.',
    ['perro', 'dog'],
    [
      category(
        'alimentacion',
        'Alimentacion',
        'food',
        'Como veterinario, aqui importa etapa, tamano, fuente proteica y objetivo nutricional mas que la marca sola.',
        ['brand', 'price', 'stock', 'form', 'life-stage', 'protein-source', 'diet-tags', 'health-goal', 'ingredients', 'breed-size', 'weight-range'],
        [
          subcategory('alimento-seco', 'Alimento seco', 'Croqueta o dieta seca para mantenimiento o soporte.', ['form', 'life-stage', 'protein-source', 'diet-tags', 'ingredients']),
          subcategory('alimento-humedo', 'Alimento humedo', 'Sobres, latas y formulas mas palatables o con mayor humedad.', ['form', 'life-stage', 'protein-source', 'diet-tags', 'ingredients']),
          subcategory('alimento-medicado', 'Alimento medicado', 'Dieta terapeutica o de uso veterinario donde manda el objetivo clinico.', ['life-stage', 'diet-tags', 'health-goal', 'ingredients', 'prescription']),
          subcategory('formulas-lacteas', 'Formulas lacteas', 'Sustitutos lacteos y apoyo temprano para cachorro o neonatos.', ['life-stage', 'ingredients', 'weight-range']),
        ]
      ),
      category(
        'treats',
        'Treats',
        'treats',
        'En premios para perro hay que distinguir textura, objetivo de entrenamiento y beneficio funcional.',
        ['brand', 'price', 'stock', 'form', 'protein-source', 'health-goal', 'ingredients', 'life-stage'],
        [
          subcategory('suaves', 'Suaves', 'Premios blandos utiles para entrenamiento o perros senior.'),
          subcategory('crocantes', 'Crocantes', 'Premios con mayor textura y experiencia mastigatoria.'),
          subcategory('entrenamiento', 'Entrenamiento', 'Bocados pequenos de alta frecuencia para refuerzo positivo.', ['form', 'protein-source', 'ingredients', 'training-use']),
          subcategory('dentales', 'Dentales', 'Snacks pensados para friccion mecanica y rutina oral.', ['life-stage', 'health-goal', 'ingredients', 'breed-size']),
          subcategory('postres', 'Postres', 'Premios indulgentes de uso ocasional.'),
        ]
      ),
      category(
        'farmacia',
        'Farmacia',
        'health',
        'Farmacia debe ordenarse por sistema u objetivo clinico para no mezclar analgesia, digestivo o dermatologia.',
        ['brand', 'price', 'stock', 'species', 'life-stage', 'health-goal', 'active-ingredient', 'prescription'],
        [
          subcategory('analgesicos-y-antiinflamatorios', 'Analgesicos y antiinflamatorios', 'Soporte de dolor e inflamacion bajo criterio profesional.', ['health-goal', 'active-ingredient', 'prescription']),
          subcategory('anestesicos-y-tranquilizantes', 'Anestesicos y tranquilizantes', 'Linea sensible que conviene separar por uso estrictamente veterinario.', ['active-ingredient', 'prescription']),
          subcategory('antibioticos', 'Antibioticos', 'Segmentacion clinica por indicacion y activo principal.', ['active-ingredient', 'prescription']),
          subcategory('antialergicos-y-antihistaminicos', 'Antialergicos y antihistaminicos', 'Apoyo para prurito o reacciones alergicas.', ['health-goal', 'active-ingredient']),
          subcategory('dermatologicos', 'Dermatologicos', 'Soporte topico o sistemico para piel y pelaje.', ['health-goal', 'active-ingredient', 'coat-type']),
          subcategory('digestivos', 'Digestivos', 'Probioticos, antiacidos y apoyo intestinal.', ['health-goal', 'ingredients', 'active-ingredient']),
          subcategory('oftalmicos', 'Oftalmicos', 'Limpieza y soporte ocular.'),
          subcategory('otologicos', 'Otologicos', 'Limpieza y soporte de oido externo.'),
          subcategory('accesorios-veterinarios', 'Accesorios veterinarios', 'Jeringas, collar isabelino y apoyo clinico complementario.', ['material']),
        ]
      ),
      category(
        'cuidado-rutinario',
        'Cuidado rutinario',
        'health',
        'Esta capa separa prevencion y soporte continuo: antiparasitarios, relajacion y suplementos.',
        ['brand', 'price', 'stock', 'life-stage', 'health-goal', 'active-ingredient', 'parasite-target', 'weight-range'],
        [
          subcategory('antipulgas-garrapatas-y-acaros', 'Antipulgas, garrapatas y acaros', 'Prevencion externa y control por parasito objetivo.', ['active-ingredient', 'parasite-target', 'weight-range']),
          subcategory('relajantes', 'Relajantes', 'Apoyo en ansiedad, viajes o cambios de rutina.', ['health-goal', 'ingredients']),
          subcategory('vitaminas-y-suplementos', 'Vitaminas y suplementos', 'Soporte preventivo para articulaciones, piel, digestivo o energia.', ['life-stage', 'health-goal', 'ingredients']),
        ]
      ),
      category(
        'aseo',
        'Aseo',
        'hygiene',
        'En higiene conviene separar bano, dental y limpieza rapida porque cada uso exige filtros distintos.',
        ['brand', 'price', 'stock', 'form', 'ingredients', 'coat-type'],
        [
          subcategory('shampoo', 'Shampoo', 'Limpieza base o especializada para piel y pelaje.', ['form', 'ingredients', 'coat-type']),
          subcategory('acondicionador', 'Acondicionador', 'Apoyo para desenredo, brillo o hidratacion.', ['ingredients', 'coat-type']),
          subcategory('pasta-dental', 'Pasta dental', 'Higiene oral diaria.', ['ingredients', 'health-goal']),
          subcategory('cepillos-dentales', 'Cepillos dentales', 'Herramienta para rutina oral mecanica.', ['material', 'breed-size']),
          subcategory('humectantes', 'Humectantes', 'Apoyo para resequedad o almohadillas.'),
          subcategory('fragancias', 'Fragancias', 'Acabado cosmetico posterior al bano.'),
          subcategory('toallas-humedas', 'Toallas humedas', 'Limpieza rapida de patas, hocico o cuerpo.', ['ingredients']),
        ]
      ),
      category(
        'grooming',
        'Grooming',
        'hygiene',
        'Grooming se beneficia de filtros por tipo de pelaje, zona de uso y tamano del perro.',
        ['brand', 'price', 'stock', 'coat-type', 'material', 'breed-size'],
        [
          subcategory('peinado', 'Peinado', 'Cepillos y peines segun largo y densidad de pelo.', ['coat-type', 'material', 'breed-size']),
          subcategory('cortaunas', 'Cortaunas', 'Herramientas de corte segun tamano y grosor de una.', ['breed-size', 'material']),
          subcategory('desenredadores', 'Desenredadores', 'Accesorios o sprays para nudos y manto largo.', ['coat-type', 'ingredients']),
          subcategory('tijeras-de-grooming', 'Tijeras de grooming', 'Corte cosmetico con control y seguridad.', ['material', 'coat-type']),
        ]
      ),
      category(
        'juguetes',
        'Juguetes',
        'accesories',
        'Los juguetes deben segmentarse por tipo de actividad y fuerza de mordida.',
        ['brand', 'price', 'stock', 'life-stage', 'material', 'training-use', 'breed-size'],
        [
          subcategory('masticables', 'Masticables', 'Enriquecimiento oral y descarga de mordida.', ['life-stage', 'material', 'breed-size']),
          subcategory('interactivos', 'Interactivos', 'Juego cognitivo o dispensadores de premio.', ['life-stage', 'training-use']),
          subcategory('fetch', 'Fetch', 'Pelotas y lanzables para cobro y ejercicio.', ['material', 'breed-size']),
        ]
      ),
      category(
        'descanso',
        'Descanso',
        'other',
        'Camas y refugios deben poder filtrarse por tamano, material y temporada.',
        ['brand', 'price', 'stock', 'material', 'weight-range', 'weather'],
        [
          subcategory('camas', 'Camas', 'Descanso principal para hogar o kennel.', ['material', 'weight-range', 'weather']),
          subcategory('casas', 'Casas', 'Refugios cubiertos para interior o exterior.', ['material', 'weight-range', 'weather']),
          subcategory('colchas', 'Colchas', 'Capas ligeras o protectores para superficie.', ['material', 'weather']),
        ]
      ),
      category(
        'suministros',
        'Suministros',
        'other',
        'Consumibles de apoyo para limpieza o manejo diario.',
        ['brand', 'price', 'stock', 'material'],
        [
          subcategory('desechos', 'Desechos', 'Bolsas y soluciones para recoleccion.', ['material']),
          subcategory('toallas-sanitarias', 'Toallas sanitarias', 'Absorbentes de apoyo postoperatorio o celo.', ['absorbency', 'weight-range']),
          subcategory('limpieza', 'Limpieza', 'Complementos de higiene general.', ['ingredients', 'material']),
        ]
      ),
      category(
        'accesorios',
        'Accesorios',
        'accesories',
        'En accesorios importa mucho el uso concreto: comer, paseo, transporte o entrenamiento.',
        ['brand', 'price', 'stock', 'material', 'weight-range', 'training-use'],
        [
          subcategory('platos-y-dispensadores', 'Platos y dispensadores', 'Comida y agua segun volumen y material.', ['material', 'weight-range']),
          subcategory('contenedores-de-alimento', 'Contenedores de alimentos', 'Almacenamiento con foco en capacidad y hermeticidad.', ['material']),
          subcategory('bozales', 'Bozales', 'Control por talla y uso especifico.', ['weight-range', 'training-use', 'material']),
          subcategory('collares', 'Collares', 'Uso diario o identificacion.', ['weight-range', 'material', 'training-use']),
          subcategory('arneses', 'Arneses', 'Paseo y control por ajuste corporal.', ['weight-range', 'training-use', 'material']),
          subcategory('correas', 'Correas', 'Paseo basico o adiestramiento.', ['material', 'training-use']),
          subcategory('transporte', 'Transporte', 'Jaulas y bolsos por talla y tipo de viaje.', ['weight-range', 'material']),
          subcategory('entrenamiento', 'Entrenamiento', 'Accesorios para obediencia y manejo.', ['training-use', 'material']),
        ]
      ),
      category(
        'ropa',
        'Ropa',
        'other',
        'La ropa debe filtrar por clima, talla y cobertura segun funcion real.',
        ['brand', 'price', 'stock', 'weather', 'weight-range', 'material'],
        [
          subcategory('frio', 'Frio', 'Abrigos y capas termicas.', ['weather', 'weight-range', 'material']),
          subcategory('lluvia', 'Lluvia', 'Impermeables y capas de agua.', ['weather', 'weight-range', 'material']),
          subcategory('zapatos', 'Zapatos', 'Proteccion de almohadillas y terreno.', ['weight-range', 'weather', 'material']),
          subcategory('lentes', 'Lentes', 'Proteccion ocular especializada.', ['weight-range', 'material']),
          subcategory('disfraces', 'Disfraces', 'Uso ocasional y estacional.', ['weather', 'weight-range']),
          subcategory('multiuso', 'Multiuso', 'Prendas de uso mixto.', ['weather', 'weight-range', 'material']),
        ]
      ),
    ]
  ),
  animal(
    'cat',
    'Gato',
    'Gato: el filtro fino suele concentrarse en alimentacion, arena, areneros, rascado y juego.',
    ['gato', 'cat'],
    [
      category(
        'alimentacion',
        'Alimentacion',
        'food',
        'En gatos conviene separar seco, humedo y formulas funcionales con foco urinario, peso y digestibilidad.',
        ['brand', 'price', 'stock', 'form', 'life-stage', 'protein-source', 'diet-tags', 'health-goal', 'ingredients', 'weight-range'],
        [
          subcategory(
            'alimento-seco',
            'Alimento seco',
            'Croqueta de mantenimiento o control funcional.',
            ['form', 'life-stage', 'protein-source', 'diet-tags', 'health-goal', 'ingredients'],
            [
              leaf('gatito', 'Gatito'),
              leaf('adulto', 'Adulto'),
              leaf('senior', 'Senior'),
              leaf('control-bolas-de-pelo', 'Control bolas de pelo'),
              leaf('control-peso', 'Control peso'),
              leaf('digestion-sensible', 'Digestion sensible'),
            ]
          ),
          subcategory(
            'alimento-humedo',
            'Alimento humedo',
            'Sobres, latas y texturas humedas para palatabilidad o hidratacion.',
            ['form', 'life-stage', 'protein-source', 'health-goal', 'ingredients'],
            [
              leaf('pate', 'Pate'),
              leaf('trozos-en-salsa', 'Trozos en salsa'),
              leaf('trozos-en-gelatina', 'Trozos en gelatina'),
              leaf('latas', 'Latas'),
              leaf('sobres', 'Sobres'),
            ]
          ),
        ]
      ),
      category(
        'treats',
        'Treats',
        'treats',
        'En snacks felinos manda la textura y si son funcionales o dentales.',
        ['brand', 'price', 'stock', 'form', 'protein-source', 'health-goal', 'ingredients'],
        [
          subcategory(
            'snacks',
            'Snacks',
            'Premios de refuerzo o palatabilidad.',
            ['form', 'protein-source', 'health-goal', 'ingredients'],
            [
              leaf('snacks-crujientes', 'Snacks crujientes'),
              leaf('snacks-cremosos', 'Snacks cremosos'),
              leaf('snacks-funcionales', 'Snacks funcionales'),
            ]
          ),
          subcategory('snacks-dentales', 'Snacks dentales', 'Refuerzo oral con textura o activo funcional.', ['health-goal', 'ingredients']),
        ]
      ),
      category(
        'higiene',
        'Higiene',
        'hygiene',
        'Arena y limpieza felina deben filtrar por absorcion, olor, textura y preferencia del gato.',
        ['brand', 'price', 'stock', 'health-goal', 'absorbency', 'odor-control', 'litter-texture'],
        [
          subcategory(
            'arena',
            'Arena',
            'Base de eliminacion segun control de olor, textura y adherencia.',
            ['absorbency', 'odor-control', 'litter-texture'],
            [
              leaf('arena-aglomerante', 'Arena aglomerante'),
              leaf('arena-de-silice', 'Arena de silice'),
              leaf('arena-vegetal', 'Arena vegetal'),
              leaf('arena-perfumada', 'Arena perfumada'),
            ]
          ),
        ]
      ),
      category(
        'areneros',
        'Areneros',
        'hygiene',
        'Conviene separar por apertura, manejo de olor y facilidad de limpieza.',
        ['brand', 'price', 'stock', 'material', 'odor-control', 'habitat-size'],
        [
          subcategory(
            'areneros-abiertos',
            'Areneros abiertos',
            'Bandejas de acceso simple y rapido.',
            ['material', 'habitat-size'],
            [
              leaf('bandeja-simple', 'Bandeja simple'),
              leaf('bandeja-con-borde', 'Bandeja con borde'),
            ]
          ),
          subcategory(
            'areneros-cerrados',
            'Areneros cerrados',
            'Refugio con mas control de olor y salpicadura.',
            ['material', 'odor-control', 'habitat-size'],
            [
              leaf('caja-cerrada', 'Caja cerrada'),
              leaf('caja-con-filtro', 'Caja con filtro'),
              leaf('caja-autolimpiante', 'Caja autolimpiante'),
            ]
          ),
        ]
      ),
      category(
        'rascadores',
        'Rascadores',
        'accesories',
        'El rascado se elige por altura, estabilidad y tipo de superficie.',
        ['brand', 'price', 'stock', 'material', 'habitat-size', 'life-stage'],
        [
          subcategory(
            'verticales',
            'Verticales',
            'Superficies altas para estiramiento.',
            ['material', 'habitat-size'],
            [
              leaf('rascador-con-base', 'Rascador con base'),
              leaf('rascador-pequeno', 'Rascador pequeno'),
            ]
          ),
          subcategory(
            'arboles',
            'Arboles',
            'Estructuras de varias alturas con descanso y observacion.',
            ['material', 'habitat-size'],
            [
              leaf('arbol-pequeno', 'Arbol pequeno'),
              leaf('arbol-mediano', 'Arbol mediano'),
              leaf('arbol-grande', 'Arbol grande'),
            ]
          ),
        ]
      ),
      category(
        'juguetes',
        'Juguetes',
        'accesories',
        'En gatos conviene separar presa, movimiento y estimulacion cognitiva.',
        ['brand', 'price', 'stock', 'life-stage', 'material'],
        [
          subcategory(
            'caza',
            'Caza',
            'Juguetes que imitan presa y activan persecucion.',
            ['life-stage', 'material'],
            [
              leaf('ratones', 'Ratones'),
              leaf('pelotas', 'Pelotas'),
              leaf('juguetes-con-plumas', 'Juguetes con plumas'),
            ]
          ),
          subcategory(
            'interactivos',
            'Interactivos',
            'Estimulo mental y juego dirigido.',
            ['life-stage', 'material'],
            [
              leaf('varitas', 'Varitas'),
              leaf('juguetes-electricos', 'Juguetes electricos'),
              leaf('puzzle-toys', 'Puzzle toys'),
            ]
          ),
        ]
      ),
    ]
  ),
  animal(
    'fish',
    'Pez y acuario',
    'Peces y acuario: aqui lo mas util es filtrar por especie, tipo de agua y capacidad del sistema.',
    ['pez', 'peces', 'fish', 'acuario'],
    [
      category(
        'alimentacion',
        'Alimentacion',
        'food',
        'En peces conviene separar tipo de particula y especie objetivo.',
        ['brand', 'price', 'stock', 'form', 'species', 'ingredients', 'water-type'],
        [
          subcategory(
            'hojuelas',
            'Hojuelas',
            'Alimento liviano para peces de superficie o comunitarios.',
            ['species', 'ingredients', 'water-type'],
            [
              leaf('tropical', 'Tropical'),
              leaf('goldfish', 'Goldfish'),
              leaf('mezcla-comunitaria', 'Mezcla comunitaria'),
            ]
          ),
          subcategory(
            'pellets',
            'Pellets',
            'Particula mas estable para especies concretas y capas de agua distintas.',
            ['form', 'species', 'ingredients', 'water-type'],
            [
              leaf('pellets-flotantes', 'Pellets flotantes'),
              leaf('pellets-hundibles', 'Pellets hundibles'),
              leaf('pellets-ciclidos', 'Pellets ciclidos'),
            ]
          ),
        ]
      ),
      category(
        'acuarios',
        'Acuarios',
        'accesories',
        'Pecera y kit deben ordenarse por capacidad, material y tipo de sistema.',
        ['brand', 'price', 'stock', 'water-type', 'tank-capacity', 'material'],
        [
          subcategory(
            'acuarios',
            'Acuarios',
            'Urnas y kits base para montar o ampliar sistema.',
            ['water-type', 'tank-capacity', 'material'],
            [
              leaf('acuario-pequeno', 'Acuario pequeno'),
              leaf('acuario-mediano', 'Acuario mediano'),
              leaf('acuario-grande', 'Acuario grande'),
              leaf('kit-acuario', 'Kit acuario'),
            ]
          ),
        ]
      ),
      category(
        'equipamiento',
        'Equipamiento',
        'accesories',
        'El equipo tecnico debe filtrar por litros, tipo de agua y funcion exacta.',
        ['brand', 'price', 'stock', 'water-type', 'tank-capacity', 'material'],
        [
          subcategory(
            'filtracion',
            'Filtracion',
            'Movimiento y depuracion mecanica o biologica.',
            ['water-type', 'tank-capacity', 'material'],
            [
              leaf('filtro-interno', 'Filtro interno'),
              leaf('filtro-externo', 'Filtro externo'),
              leaf('filtro-mochila', 'Filtro mochila'),
            ]
          ),
          subcategory(
            'calentadores',
            'Calentadores',
            'Control termico segun litros y automatizacion.',
            ['tank-capacity', 'water-type'],
            [
              leaf('calentador-sumergible', 'Calentador sumergible'),
              leaf('calentador-automatico', 'Calentador automatico'),
            ]
          ),
          subcategory(
            'aireacion',
            'Aireacion',
            'Oxigenacion y movimiento complementario.',
            ['tank-capacity', 'water-type'],
            [
              leaf('bombas-aire', 'Bombas aire'),
              leaf('difusores', 'Difusores'),
              leaf('piedras-aire', 'Piedras aire'),
            ]
          ),
        ]
      ),
      category(
        'decoracion',
        'Decoracion',
        'other',
        'Decoracion debe separar natural vs artificial y revisar seguridad para el tipo de acuario.',
        ['brand', 'price', 'stock', 'water-type', 'material'],
        [
          subcategory(
            'plantas',
            'Plantas',
            'Cobertura, refugio y acabado visual.',
            ['water-type', 'material'],
            [
              leaf('plantas-artificiales', 'Plantas artificiales'),
              leaf('plantas-seda', 'Plantas seda'),
            ]
          ),
          subcategory(
            'rocas',
            'Rocas',
            'Estructura dura para refugio o aquascaping.',
            ['water-type', 'material'],
            [
              leaf('rocas-naturales', 'Rocas naturales'),
              leaf('rocas-decorativas', 'Rocas decorativas'),
            ]
          ),
        ]
      ),
    ]
  ),
  animal(
    'bird',
    'Ave',
    'Aves: la decision suele girar entre alimentacion, jaula, perchas y nidos segun especie y tamano.',
    ['ave', 'bird', 'loro', 'canario', 'perico'],
    [
      category(
        'alimentacion',
        'Alimentacion',
        'food',
        'En aves conviene distinguir mezcla base, pellets y especie objetivo.',
        ['brand', 'price', 'stock', 'form', 'species', 'life-stage', 'ingredients'],
        [
          subcategory(
            'semillas',
            'Semillas',
            'Mezclas tradicionales por tipo de ave.',
            ['species', 'ingredients', 'life-stage'],
            [
              leaf('mezcla-estandar', 'Mezcla estandar'),
              leaf('mezcla-premium', 'Mezcla premium'),
              leaf('semillas-especificas', 'Semillas especificas'),
            ]
          ),
          subcategory(
            'pellets',
            'Pellets',
            'Formula mas uniforme para mantenimiento o crecimiento.',
            ['form', 'species', 'life-stage', 'ingredients'],
            [
              leaf('pellets-mantenimiento', 'Pellets mantenimiento'),
              leaf('pellets-crecimiento', 'Pellets crecimiento'),
              leaf('pellets-especiales', 'Pellets especiales'),
            ]
          ),
        ]
      ),
      category(
        'jaulas',
        'Jaulas',
        'accesories',
        'La jaula debe filtrarse por tamano, especie y material para no recomendar espacios insuficientes.',
        ['brand', 'price', 'stock', 'species', 'habitat-size', 'material'],
        [
          subcategory(
            'jaulas',
            'Jaulas',
            'Habitats principales de interior.',
            ['species', 'habitat-size', 'material'],
            [
              leaf('jaulas-pequenas', 'Jaulas pequenas'),
              leaf('jaulas-medianas', 'Jaulas medianas'),
              leaf('jaulas-grandes', 'Jaulas grandes'),
            ]
          ),
        ]
      ),
      category(
        'accesorios',
        'Accesorios',
        'accesories',
        'Perchas y nidos cambian por tamano de ave, postura y material.',
        ['brand', 'price', 'stock', 'species', 'material', 'habitat-size'],
        [
          subcategory(
            'perchas',
            'Perchas',
            'Descanso y ejercicio de pies segun textura.',
            ['species', 'material'],
            [
              leaf('perchas-madera', 'Perchas madera'),
              leaf('perchas-plastico', 'Perchas plastico'),
              leaf('perchas-naturales', 'Perchas naturales'),
            ]
          ),
          subcategory(
            'nidos',
            'Nidos',
            'Refugio y puesta segun material y formato.',
            ['species', 'material', 'habitat-size'],
            [
              leaf('nidos-madera', 'Nidos madera'),
              leaf('nidos-fibra', 'Nidos fibra'),
              leaf('nidos-caja', 'Nidos caja'),
            ]
          ),
        ]
      ),
    ]
  ),
  animal(
    'reptile',
    'Reptil',
    'Reptiles: lo critico es diferenciar alimento, terrario, UVB, calor y sustrato por especie.',
    ['reptil', 'reptile', 'tortuga', 'iguana', 'serpiente', 'anfibio'],
    [
      category(
        'alimentacion',
        'Alimentacion',
        'food',
        'En reptiles la especie objetivo y el tipo de presa o pellet son la variable principal.',
        ['brand', 'price', 'stock', 'form', 'species', 'life-stage', 'ingredients'],
        [
          subcategory(
            'alimento-reptiles',
            'Alimento reptiles',
            'Pellets o granulado formulado para especies concretas.',
            ['form', 'species', 'life-stage', 'ingredients'],
            [
              leaf('pellets-tortuga', 'Pellets tortuga'),
              leaf('pellets-lagarto', 'Pellets lagarto'),
              leaf('camarones-secos', 'Camarones secos'),
            ]
          ),
          subcategory(
            'alimento-vivo',
            'Alimento vivo',
            'Feeders por especie y tamano.',
            ['species', 'life-stage'],
            [
              leaf('grillos', 'Grillos'),
              leaf('gusanos', 'Gusanos'),
            ]
          ),
        ]
      ),
      category(
        'habitat',
        'Habitat',
        'accesories',
        'Terrario y tortuguera deben poder filtrarse por tamano, material y ventilacion.',
        ['brand', 'price', 'stock', 'species', 'habitat-size', 'material'],
        [
          subcategory(
            'terrarios',
            'Terrarios',
            'Recinto base para reptil o anfibio.',
            ['species', 'habitat-size', 'material'],
            [
              leaf('terrarios-vidrio', 'Terrarios vidrio'),
              leaf('terrarios-malla', 'Terrarios malla'),
              leaf('tortugueras', 'Tortugueras'),
            ]
          ),
        ]
      ),
      category(
        'equipamiento',
        'Equipamiento',
        'accesories',
        'Iluminacion y calefaccion merecen filtros tecnicos porque un error afecta bienestar y metabolismo.',
        ['brand', 'price', 'stock', 'species', 'habitat-size', 'uvb-output', 'material'],
        [
          subcategory(
            'iluminacion',
            'Iluminacion',
            'Luz UVB y apoyo fotoperiodico.',
            ['species', 'uvb-output'],
            [
              leaf('lamparas-uvb', 'Lamparas UVB'),
              leaf('lamparas-calor', 'Lamparas calor'),
            ]
          ),
          subcategory(
            'calefaccion',
            'Calefaccion',
            'Fuentes de calor de contacto o ambiente.',
            ['species', 'habitat-size', 'uvb-output'],
            [
              leaf('heat-mats', 'Heat mats'),
            ]
          ),
          subcategory(
            'control-ambiental',
            'Control ambiental',
            'Monitoreo fino de temperatura y humedad.',
            ['species', 'habitat-size'],
            [
              leaf('termometros', 'Termometros'),
              leaf('higrometros', 'Higrometros'),
            ]
          ),
        ]
      ),
      category(
        'sustrato',
        'Sustrato',
        'hygiene',
        'El sustrato debe separarse por humedad, ingestion accidental y especie objetivo.',
        ['brand', 'price', 'stock', 'species', 'substrate-type', 'odor-control'],
        [
          subcategory(
            'sustrato',
            'Sustrato',
            'Base del habitat segun retencion de humedad o look natural.',
            ['species', 'substrate-type', 'odor-control'],
            [
              leaf('arena-desierto', 'Arena desierto'),
              leaf('fibra-coco', 'Fibra coco'),
              leaf('corteza', 'Corteza'),
            ]
          ),
        ]
      ),
      category(
        'decoracion',
        'Decoracion',
        'other',
        'Rocas, troncos y refugios deben ordenarse por seguridad y compatibilidad con el terrario.',
        ['brand', 'price', 'stock', 'species', 'material'],
        [
          subcategory(
            'decoracion',
            'Decoracion',
            'Refugio y enriquecimiento estructural.',
            ['species', 'material'],
            [
              leaf('rocas', 'Rocas'),
              leaf('cuevas', 'Cuevas'),
              leaf('troncos', 'Troncos'),
              leaf('plantas-artificiales', 'Plantas artificiales'),
            ]
          ),
        ]
      ),
    ]
  ),
  animal(
    'small-pet',
    'Roedor y pequena mascota',
    'Roedores y pequenas mascotas: se ordenan mejor por alimento, habitat y sustrato.',
    ['roedor', 'hamster', 'conejo', 'cobayo', 'small-pet', 'small pet'],
    [
      category(
        'alimentacion',
        'Alimentacion',
        'food',
        'Aqui conviene separar por especie objetivo y composicion base.',
        ['brand', 'price', 'stock', 'form', 'species', 'life-stage', 'ingredients'],
        [
          subcategory(
            'pellets',
            'Pellets',
            'Formula base por especie.',
            ['species', 'life-stage', 'ingredients'],
            [
              leaf('pellets-conejo', 'Pellets conejo'),
              leaf('pellets-hamster', 'Pellets hamster'),
              leaf('pellets-cobaya', 'Pellets cobaya'),
            ]
          ),
        ]
      ),
      category(
        'habitat',
        'Habitat',
        'accesories',
        'Jaulas y refugios deben filtrarse por especie, tamano y material.',
        ['brand', 'price', 'stock', 'species', 'habitat-size', 'material'],
        [
          subcategory(
            'jaulas',
            'Jaulas',
            'Recinto principal para roedor o pequena mascota.',
            ['species', 'habitat-size', 'material'],
            [
              leaf('jaulas-roedores', 'Jaulas roedores'),
            ]
          ),
          subcategory(
            'casas',
            'Casas',
            'Refugio o escondite interior.',
            ['species', 'habitat-size', 'material'],
            [
              leaf('casas-pequenas', 'Casas pequenas'),
            ]
          ),
          subcategory(
            'tuneles',
            'Tuneles',
            'Juego y enriquecimiento ambiental.',
            ['species', 'habitat-size', 'material'],
            [
              leaf('tuneles-juego', 'Tuneles juego'),
            ]
          ),
        ]
      ),
      category(
        'sustrato',
        'Sustrato',
        'hygiene',
        'Sustrato debe poder filtrar absorcion, control de olor y material base.',
        ['brand', 'price', 'stock', 'species', 'substrate-type', 'absorbency', 'odor-control'],
        [
          subcategory(
            'sustrato',
            'Sustrato',
            'Base absorbente y de confort.',
            ['species', 'substrate-type', 'absorbency', 'odor-control'],
            [
              leaf('viruta', 'Viruta'),
              leaf('papel-reciclado', 'Papel reciclado'),
              leaf('fibra-vegetal', 'Fibra vegetal'),
            ]
          ),
        ]
      ),
    ]
  ),
  animal(
    'horse',
    'Caballo',
    'Caballo: la navegacion util suele separar alimentacion, suplementos, cuidado y equipo.',
    ['caballo', 'horse', 'equino'],
    [
      category(
        'alimentacion',
        'Alimentacion',
        'food',
        'En equinos importa mucho la etapa, nivel de trabajo y tipo de concentrado.',
        ['brand', 'price', 'stock', 'form', 'life-stage', 'ingredients', 'weight-range'],
        [
          subcategory(
            'concentrado',
            'Concentrado',
            'Base energetica segun edad y actividad.',
            ['life-stage', 'ingredients', 'weight-range'],
            [
              leaf('concentrado-adulto', 'Concentrado adulto'),
              leaf('concentrado-potro', 'Concentrado potro'),
              leaf('concentrado-deportivo', 'Concentrado deportivo'),
            ]
          ),
        ]
      ),
      category(
        'suplementos',
        'Suplementos',
        'health',
        'Suplementos equinos deben ordenarse por objetivo funcional.',
        ['brand', 'price', 'stock', 'health-goal', 'ingredients'],
        [
          subcategory(
            'suplementos',
            'Suplementos',
            'Apoyo dirigido a rendimiento o mantenimiento.',
            ['health-goal', 'ingredients'],
            [
              leaf('articulaciones', 'Articulaciones'),
              leaf('energia', 'Energia'),
              leaf('electrolitos', 'Electrolitos'),
              leaf('digestivos', 'Digestivos'),
            ]
          ),
        ]
      ),
      category(
        'cuidado',
        'Cuidado',
        'hygiene',
        'El cuidado diario del caballo se entiende mejor si separa cascos, grooming y bano.',
        ['brand', 'price', 'stock', 'form', 'ingredients', 'material'],
        [
          subcategory(
            'cuidado',
            'Cuidado',
            'Mantenimiento de casco, manto y limpieza.',
            ['form', 'ingredients', 'material'],
            [
              leaf('cascos', 'Cascos'),
              leaf('cepillos', 'Cepillos'),
              leaf('shampoo', 'Shampoo'),
            ]
          ),
        ]
      ),
      category(
        'equipo',
        'Equipo',
        'accesories',
        'Montura y tack requieren filtros por material, talla y disciplina.',
        ['brand', 'price', 'stock', 'material', 'weight-range', 'weather'],
        [
          subcategory(
            'montura',
            'Montura',
            'Equipo de monta y control.',
            ['material', 'weight-range', 'weather'],
            [
              leaf('silla-de-montar', 'Silla de montar'),
              leaf('riendas', 'Riendas'),
              leaf('mantillas', 'Mantillas'),
            ]
          ),
        ]
      ),
    ]
  ),
];

export const getCatalogTaxonomyPayload = () => ({
  data: {
    version: '2026-03-12',
    generatedFrom: 'taxonomy-curated-with-veterinary-filter-matrix',
    filterLibrary: Object.values(FILTER_LIBRARY),
    animals,
  },
});
