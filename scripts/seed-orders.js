/**
 * seed-orders.js
 * Crea datos de prueba para el portal operativo:
 *   - 1 usuario de prueba (cliente)
 *   - 20 productos ficticios publicados
 *   - 30 órdenes con items y status logs
 *
 * Uso:
 *   npm run seed:orders
 *   npm run seed:orders -- --force   (elimina y recrea)
 *
 * NO toca: catalog-animal, catalog-category, catalog-filter, specie
 */

const path = require('path');
const { createStrapi } = require('@strapi/core');

const ORDER_UID      = 'api::order.order';
const ORDER_ITEM_UID = 'api::order-item.order-item';
const ORDER_LOG_UID  = 'api::order-status-log.order-status-log';
const PRODUCT_UID    = 'api::product.product';
const BRAND_UID      = 'api::brand.brand';
const USER_UID       = 'plugin::users-permissions.user';
const SEED_TAG       = '__SEED_TEST__';

// ── Datos ficticios ─────────────────────────────────────────────────────────────

const BRANDS_SEED = [
  { name: 'Royal Canin', slug: 'royal-canin-test' },
  { name: 'Hill\'s Science Diet', slug: 'hills-science-diet-test' },
  { name: 'Purina Pro Plan', slug: 'purina-pro-plan-test' },
  { name: 'Eukanuba', slug: 'eukanuba-test' },
  { name: 'NutriVet', slug: 'nutrivet-test' },
];

const PRODUCTS_SEED = [
  { name: 'Royal Canin Medium Adult 15kg',           price: 489.00, sku: 'RC-MED-15',  category: 'food',       form: 'kibble',     stock: 42 },
  { name: 'Royal Canin Maxi Junior 4kg',              price: 219.00, sku: 'RC-MAXJ-4',  category: 'food',       form: 'kibble',     stock: 28 },
  { name: 'Hill\'s Science Diet Adulto Pollo 6kg',   price: 315.00, sku: 'HS-AD-6',    category: 'food',       form: 'kibble',     stock: 15 },
  { name: 'Hill\'s Prescription Diet k/d Renal 4kg', price: 389.00, sku: 'HS-KD-4',    category: 'health',     form: 'kibble',     stock: 8  },
  { name: 'Purina Pro Plan Sensitive Salmón 3kg',    price: 239.50, sku: 'PP-SEN-3',   category: 'food',       form: 'kibble',     stock: 33 },
  { name: 'Purina Dog Chow Razas Grandes 8kg',       price: 219.00, sku: 'PDC-RG-8',   category: 'food',       form: 'kibble',     stock: 55 },
  { name: 'Purina ONE Gato Adulto Atún 1.5kg',       price: 129.00, sku: 'P1-GAT-1.5', category: 'food',       form: 'kibble',     stock: 20 },
  { name: 'Whiskas Gatito Pollo 400g x3',            price:  74.00, sku: 'WH-GAT-3P',  category: 'food',       form: 'wet',        stock: 60 },
  { name: 'Snack Dentix Perro Grande x8',            price:  58.50, sku: 'DX-PG-8',    category: 'treats',     form: 'treat',      stock: 90 },
  { name: 'Snack Training Bits Pollo 200g',          price:  42.00, sku: 'TB-PO-200',  category: 'treats',     form: 'treat',      stock: 75 },
  { name: 'Arena Catsan Ultra Plus 10L',              price:  95.00, sku: 'CAT-ULT-10', category: 'hygiene',    form: 'hygiene',    stock: 38 },
  { name: 'Shampoo Wahl Suave Perros 500ml',         price:  88.00, sku: 'WL-SH-500',  category: 'hygiene',    form: 'hygiene',    stock: 22 },
  { name: 'Antiparasitario NexGard S x3',            price: 175.00, sku: 'NG-S-3',     category: 'health',     form: 'supplement', stock: 18 },
  { name: 'Vitaminas NutriVet Senior 60 tabs',       price: 135.00, sku: 'NV-SEN-60',  category: 'health',     form: 'supplement', stock: 0  },
  { name: 'Comedero Inox Doble 600ml',               price:  72.00, sku: 'COM-INX-D',  category: 'accesories', form: 'accesory',   stock: 14 },
  { name: 'Correa Retráctil Flexi 5m Talla M',       price: 145.00, sku: 'FL-RET-5M',  category: 'accesories', form: 'accesory',   stock: 7  },
  { name: 'Juguete Kong Clásico Talla L',            price:  98.00, sku: 'KG-CLA-L',   category: 'accesories', form: 'accesory',   stock: 25 },
  { name: 'Cama Ortopédica Pets Empire 70cm',        price: 285.00, sku: 'PE-CAM-70',  category: 'accesories', form: 'accesory',   stock: 5  },
  { name: 'Collar GPS Petfon con App',               price: 620.00, sku: 'PF-GPS-01',  category: 'accesories', form: 'accesory',   stock: 3  },
  { name: 'Bebedero Automático 2L',                  price:  88.00, sku: 'BEB-AUTO-2', category: 'accesories', form: 'accesory',   stock: 11 },
];

const CUSTOMERS = [
  { email: 'maria.lopez@gmail.com',      username: 'maria_lopez',   firstName: 'María',    lastName: 'López',    phone: '+502 5534-2211' },
  { email: 'carlos.paz@yahoo.com',       username: 'carlos_paz',    firstName: 'Carlos',   lastName: 'Paz',      phone: '+502 4412-8899' },
  { email: 'ana.santos@hotmail.com',     username: 'ana_santos',    firstName: 'Ana',      lastName: 'Santos',   phone: '+502 5678-1234' },
  { email: 'jose.ramos@gmail.com',       username: 'jose_ramos',    firstName: 'José',     lastName: 'Ramos',    phone: '+502 3322-9900' },
  { email: 'lucia.garcia@gmail.com',     username: 'lucia_garcia',  firstName: 'Lucía',    lastName: 'García',   phone: '+502 5500-4477' },
  { email: 'pedro.mendez@live.com',      username: 'pedro_mendez',  firstName: 'Pedro',    lastName: 'Méndez',   phone: '+502 4499-0011' },
  { email: 'sofia.choc@gmail.com',       username: 'sofia_choc',    firstName: 'Sofía',    lastName: 'Choc',     phone: '+502 5821-3340' },
  { email: 'miguel.xol@gmail.com',       username: 'miguel_xol',    firstName: 'Miguel',   lastName: 'Xol',      phone: '+502 4730-9988' },
  { email: 'carmen.ajpop@gmail.com',     username: 'carmen_ajpop',  firstName: 'Carmen',   lastName: 'Ajpop',    phone: '+502 5100-2233' },
  { email: 'roberto.ixcoy@gmail.com',    username: 'roberto_ixcoy', firstName: 'Roberto',  lastName: 'Ixcoy',    phone: '+502 4021-7766' },
];

const ADDRESSES = [
  { line1: '12 Calle 3-45 Zona 1',           municipality: 'Guatemala Ciudad',       department: 'Guatemala',       postalCode: '01001' },
  { line1: 'Av. La Reforma 7-62 Zona 10',    municipality: 'Guatemala Ciudad',       department: 'Guatemala',       postalCode: '01010' },
  { line1: '5a Calle 6-34 Zona 3',           municipality: 'Mixco',                  department: 'Guatemala',       postalCode: '01057' },
  { line1: 'Calzada Roosevelt 14-20 Zona 7', municipality: 'Guatemala Ciudad',       department: 'Guatemala',       postalCode: '01007' },
  { line1: '3a Avenida 2-15 Zona 1',         municipality: 'Antigua Guatemala',      department: 'Sacatepéquez',    postalCode: '03001' },
  { line1: 'Calle Real 8-12',                municipality: 'San Lucas Sacatepéquez', department: 'Sacatepéquez',    postalCode: '03006' },
  { line1: '10a Avenida 25-30 Zona 4',       municipality: 'Quetzaltenango',         department: 'Quetzaltenango',  postalCode: '09001' },
  { line1: 'Blvd. Los Próceres 11-19 Z.10',  municipality: 'Guatemala Ciudad',       department: 'Guatemala',       postalCode: '01010' },
];

// Progresiones de status (van en orden cronológico)
const STATUS_PROGRESSIONS = [
  ['pending'],
  ['pending'],
  ['pending', 'paid'],
  ['pending', 'paid', 'processing'],
  ['pending', 'paid', 'processing'],
  ['pending', 'paid', 'processing', 'shipped'],
  ['pending', 'paid', 'processing', 'shipped'],
  ['pending', 'paid', 'processing', 'shipped', 'delivered'],
  ['pending', 'paid', 'processing', 'shipped', 'delivered'],
  ['pending', 'paid', 'processing', 'shipped', 'delivered'],
  ['pending', 'cancelled'],
  ['pending', 'paid', 'cancelled'],
];

const PAYMENT_KINDS = ['card', 'card', 'card', 'bank', 'cod'];

const STATUS_NOTES = {
  paid:       ['Pago verificado por pasarela', 'Cobro confirmado', null],
  processing: ['Preparando paquete', 'En bodega: preparando envío', null],
  shipped:    ['Enviado con mensajero propio', 'Entregado a empresa de correos', null, 'Número de guía: GT-' + Math.floor(Math.random()*99999)],
  delivered:  ['Entrega confirmada por cliente', 'El cliente recibió el pedido', null],
  cancelled:  ['Solicitud del cliente', 'Stock insuficiente', 'No se procesó el pago', null],
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const hoursAgo = (h) => { const d = new Date(); d.setHours(d.getHours() - h); return d.toISOString(); };

const generateOrderNumber = (index) => {
  const year = new Date().getFullYear().toString().slice(-2);
  return `AUM-${year}-${String(1000 + index).padStart(5, '0')}`;
};

const buildAddress = (addr, customer) => ({
  firstName: customer.firstName,
  lastName: customer.lastName,
  fullName: `${customer.firstName} ${customer.lastName}`,
  phone: customer.phone,
  line1: addr.line1,
  municipality: addr.municipality,
  department: addr.department,
  postalCode: addr.postalCode,
  country: 'Guatemala',
});

const pickItems = (products, count = null) => {
  const n = count ?? randInt(1, 4);
  return [...products].sort(() => Math.random() - 0.5).slice(0, n).map(p => ({
    productId: p.id,
    name: p.name,
    qty: randInt(1, 3),
    unitPrice: p.price,
  }));
};

// ── Main ───────────────────────────────────────────────────────────────────────

const main = async () => {
  const strapi = createStrapi({
    appDir: process.cwd(),
    distDir: path.join(process.cwd(), 'dist'),
  });

  try {
    await strapi.load();
    console.log('✅ Strapi cargado');

    const force = process.argv.includes('--force');

    // ── 1. Limpiar datos seed anteriores si --force ──────────────────────────
    const existingOrders = await strapi.db.query(ORDER_UID).findMany({
      where: { couponCode: SEED_TAG }, select: ['id'],
    });

    if (existingOrders.length > 0) {
      if (!force) {
        console.log(`\nYa existen ${existingOrders.length} órdenes de prueba.`);
        console.log('Usa --force para eliminarlas y recrearlas.');
        return;
      }
      console.log(`\nEliminando ${existingOrders.length} órdenes seed anteriores...`);
      for (const o of existingOrders) {
        await strapi.db.query(ORDER_LOG_UID).deleteMany({ where: { order: o.id } });
        await strapi.db.query(ORDER_ITEM_UID).deleteMany({ where: { order: o.id } });
        await strapi.db.query(ORDER_UID).delete({ where: { id: o.id } });
      }

      // Limpiar productos seed
      await strapi.db.query(PRODUCT_UID).deleteMany({ where: { sku: { $startsWith: 'SEED-' } } });
      // Limpiar marcas seed
      await strapi.db.query(BRAND_UID).deleteMany({ where: { slug: { $endsWith: '-test' } } });
      console.log('Datos seed anteriores eliminados.\n');
    }

    // ── 2. Crear marcas seed ─────────────────────────────────────────────────
    console.log('Creando marcas de prueba...');
    const brands = [];
    for (const b of BRANDS_SEED) {
      const existing = await strapi.db.query(BRAND_UID).findOne({ where: { slug: b.slug } });
      if (existing) { brands.push(existing); continue; }
      const created = await strapi.db.query(BRAND_UID).create({
        data: { name: b.name, slug: b.slug },
      });
      brands.push(created);
    }
    console.log(`  ${brands.length} marcas listas`);

    // ── 3. Crear productos seed ──────────────────────────────────────────────
    console.log('Creando productos de prueba...');
    const products = [];
    for (let i = 0; i < PRODUCTS_SEED.length; i++) {
      const p = PRODUCTS_SEED[i];
      const brand = brands[i % brands.length];
      const seedSku = `SEED-${p.sku}`;
      const existing = await strapi.db.query(PRODUCT_UID).findOne({ where: { sku: seedSku } });
      if (existing) { products.push({ id: existing.id, name: p.name, price: p.price }); continue; }

      const slugBase = p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70);
      const slug = `${slugBase}-test`;

      const created = await strapi.db.query(PRODUCT_UID).create({
        data: {
          name: p.name,
          slug,
          sku: seedSku,
          price: p.price,
          stock: p.stock,
          category: p.category,
          form: p.form,
          brand: brand.id,
          publishedAt: new Date().toISOString(),
        },
      });
      products.push({ id: created.id, name: p.name, price: p.price });
    }
    console.log(`  ${products.length} productos listos`);

    // ── 4. Crear usuario de prueba (cliente) ─────────────────────────────────
    console.log('Verificando usuario de prueba...');
    let testUser = await strapi.db.query(USER_UID).findOne({
      where: { email: 'test.cliente@aumakki.com' },
    });
    if (!testUser) {
      // Buscar role "Authenticated"
      const authRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' },
      });
      testUser = await strapi.db.query(USER_UID).create({
        data: {
          username: 'test_cliente',
          email: 'test.cliente@aumakki.com',
          password: '$2a$10$FakeHashForTestingPurposesOnly12345678901234567890',
          confirmed: true,
          blocked: false,
          provider: 'local',
          role: authRole?.id,
        },
      });
      console.log(`  Usuario creado: test.cliente@aumakki.com`);
    } else {
      console.log(`  Usuario existente: test.cliente@aumakki.com`);
    }

    // ── 5. Crear órdenes con items y status logs ─────────────────────────────
    console.log('\nCreando órdenes de prueba...');
    const TOTAL = 30;
    let created = 0;

    for (let i = 0; i < TOTAL; i++) {
      const customer = pick(CUSTOMERS);
      const addr = pick(ADDRESSES);
      const progression = pick(STATUS_PROGRESSIONS);
      const finalStatus = progression[progression.length - 1];
      const paymentKind = pick(PAYMENT_KINDS);
      const items = pickItems(products);
      const membershipApplied = Math.random() < 0.2;

      const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
      const discount = membershipApplied ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
      const shippingTotal = (subtotal - discount) >= 500 ? 0 : 25;
      const grandTotal = parseFloat((subtotal - discount + shippingTotal).toFixed(2));

      const shippingAddress = buildAddress(addr, customer);

      // Repartir la orden a lo largo del tiempo — más recientes primero
      const orderAgeHours = randInt(i * 2, i * 2 + 72);
      const orderDate = hoursAgo(orderAgeHours);

      // Asociar ~30% de órdenes al usuario de prueba
      const isTestUser = i < 8;
      const orderNumber = generateOrderNumber(i + 1);

      const order = await strapi.db.query(ORDER_UID).create({
        data: {
          orderNumber,
          oderNumber: orderNumber,
          email: isTestUser ? 'test.cliente@aumakki.com' : customer.email,
          user: isTestUser ? testUser.id : undefined,
          shippingAddress,
          billingAddress: shippingAddress,
          currency: 'GTQ',
          subtotal: parseFloat(subtotal.toFixed(2)),
          discountTotal: discount,
          shippingTotal,
          taxTotal: 0,
          grandTotal,
          statusOrder: finalStatus,
          membershipApplied,
          couponCode: SEED_TAG, // marcador — no es un cupón real
          createdAt: orderDate,
          updatedAt: hoursAgo(Math.max(0, orderAgeHours - randInt(1, 12))),
        },
      });

      // Items
      for (const item of items) {
        await strapi.db.query(ORDER_ITEM_UID).create({
          data: {
            order: order.id,
            product: item.productId,
            nameSnapshot: item.name,
            qty: item.qty,
            unitPrice: item.unitPrice,
            lineTotal: parseFloat((item.unitPrice * item.qty).toFixed(2)),
          },
        });
      }

      // Status logs (uno por cada step de la progresión)
      for (let step = 0; step < progression.length; step++) {
        const status = progression[step];
        const stepHoursAgo = orderAgeHours - step * randInt(2, 12);
        const logDate = hoursAgo(Math.max(0, stepHoursAgo));
        const noteOptions = STATUS_NOTES[status] || [null];
        const note = pick(noteOptions);

        await strapi.db.query(ORDER_LOG_UID).create({
          data: {
            order: order.id,
            status,
            note,
            changedBy: step === 0 ? 'sistema' : pick(['ops@aumakki.com', 'admin@aumakki.com']),
            createdAt: logDate,
            updatedAt: logDate,
          },
        });
      }

      created++;
      process.stdout.write(`\r  Órdenes: ${created}/${TOTAL}`);
    }

    console.log(`\n\n✅ Seed completado:`);
    console.log(`   Marcas:    ${brands.length}`);
    console.log(`   Productos: ${products.length}`);
    console.log(`   Órdenes:   ${created} (${TOTAL})`);
    console.log(`   Usuario de prueba: test.cliente@aumakki.com`);
    console.log(`\n   Statuses en BD: pending, paid, processing, shipped, delivered, cancelled`);
    console.log(`   Las órdenes 1-8 están asociadas al usuario de prueba.`);
    console.log(`\n   Para limpiar y recrear: npm run seed:orders -- --force`);

  } finally {
    await strapi.destroy();
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nError en seed de órdenes:', err?.message || err);
    process.exit(1);
  });
