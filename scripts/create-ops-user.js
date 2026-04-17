/**
 * create-ops-user.js
 * Crea (o actualiza) un usuario con rol operator para el portal operativo.
 * Uso: npm run create:ops-user
 */

const path = require('path');
const { createStrapi } = require('@strapi/core');

const USER_UID  = 'plugin::users-permissions.user';
const ROLE_UID  = 'plugin::users-permissions.role';

const TARGET_USERNAME = 'AumakkiAdmin';
const TARGET_EMAIL    = 'admin@aumakki.com';
const TARGET_PASSWORD = 'aumakki2026!';

const main = async () => {
  const strapi = createStrapi({
    appDir: process.cwd(),
    distDir: path.join(process.cwd(), 'dist'),
  });

  try {
    await strapi.load();

    // 1. Resolver rol: operator primero, si no existe usar authenticated
    let role = await strapi.db.query(ROLE_UID).findOne({ where: { type: 'operator' } });

    if (!role) {
      console.log('Rol "operator" no encontrado, creándolo...');
      role = await strapi.db.query(ROLE_UID).create({
        data: {
          name: 'Operator',
          type: 'operator',
          description: 'Rol operativo: acceso al portal de gestión de pedidos',
        },
      });
      console.log(`Rol "operator" creado (id: ${role.id})`);
    } else {
      console.log(`Rol "operator" encontrado (id: ${role.id})`);
    }

    // 2. Verificar si el usuario ya existe
    const existing = await strapi.db.query(USER_UID).findOne({
      where: { username: TARGET_USERNAME },
      populate: ['role'],
    });

    if (existing) {
      // Actualizar contraseña y rol
      const pluginService = strapi.plugin('users-permissions').service('user');
      await pluginService.edit(existing.id, {
        password: TARGET_PASSWORD,
        role: role.id,
        confirmed: true,
        blocked: false,
      });
      console.log(`\nUsuario "${TARGET_USERNAME}" ya existía → contraseña y rol actualizados.`);
    } else {
      // Crear usuario nuevo (el service hashea la contraseña automáticamente)
      const pluginService = strapi.plugin('users-permissions').service('user');
      const created = await pluginService.add({
        username: TARGET_USERNAME,
        email: TARGET_EMAIL,
        password: TARGET_PASSWORD,
        role: role.id,
        confirmed: true,
        blocked: false,
        provider: 'local',
      });
      console.log(`\nUsuario creado (id: ${created.id})`);
    }

    console.log('─────────────────────────────────');
    console.log(`Usuario : ${TARGET_USERNAME}`);
    console.log(`Email   : ${TARGET_EMAIL}`);
    console.log(`Password: ${TARGET_PASSWORD}`);
    console.log(`Rol     : operator`);
    console.log('─────────────────────────────────');
    console.log('Inicia sesión en el frontend con estas credenciales.');
    console.log('La ruta del portal operativo es: /ops');
  } finally {
    await strapi.destroy();
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err?.message || err);
    process.exit(1);
  });
