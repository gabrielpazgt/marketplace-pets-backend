const buildOrderEmail = (order: any): string => {
  const items = (order.order_items || [])
    .map((item: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${item.nameSnapshot || 'Producto'}${item.qty > 1 ? ` x${item.qty}` : ''}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;">Q${Number(item.lineTotal || 0).toFixed(2)}</td>
      </tr>`)
    .join('');

  const shipping = order.shippingAddress
    ? `${order.shippingAddress.line1 || ''}, ${order.shippingAddress.municipality || order.shippingAddress.city || ''}, Guatemala`
    : 'Por confirmar';

  const total = Number(order.grandTotal || 0).toFixed(2);
  const shipping_total = Number(order.shippingTotal || 0).toFixed(2);
  const orderNumber = order.orderNumber || order.oderNumber || `#${order.id}`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:600px;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#f59e0b,#fb8c00);padding:32px;text-align:center;">
          <p style="margin:0;font-size:24px;font-weight:900;color:#fff;">🐾 Aumakki</p>
          <p style="margin:8px 0 0;color:rgba(255,255,255,.9);font-size:14px;">Tu tienda de mascotas en Guatemala</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">¡Tu pedido fue recibido! ✅</h1>
          <p style="margin:0 0 24px;color:#64748b;">Gracias por tu compra. Estamos procesando tu pedido.</p>

          <div style="background:#fff7ed;border:1px solid rgba(217,119,6,.2);border-radius:12px;padding:16px;margin-bottom:24px;">
            <p style="margin:0;font-size:13px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Número de pedido</p>
            <p style="margin:4px 0 0;font-size:22px;font-weight:900;color:#0f172a;font-family:monospace;">${orderNumber}</p>
          </div>

          <h3 style="margin:0 0 12px;font-size:15px;color:#0f172a;">Resumen del pedido</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f1f5f9;border-radius:12px;overflow:hidden;">
            <thead><tr style="background:#f8fafc;">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;">Producto</th>
              <th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b;">Subtotal</th>
            </tr></thead>
            <tbody>${items}</tbody>
            <tfoot>
              <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Envío</td><td style="padding:8px 12px;text-align:right;font-size:13px;">Q${shipping_total}</td></tr>
              <tr style="background:#f8fafc;"><td style="padding:10px 12px;font-weight:900;color:#0f172a;">Total</td><td style="padding:10px 12px;text-align:right;font-weight:900;color:#16a34a;font-size:16px;">Q${total}</td></tr>
            </tfoot>
          </table>

          <div style="margin-top:24px;padding:16px;background:#f1f5f9;border-radius:12px;">
            <p style="margin:0 0 4px;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;">Dirección de entrega</p>
            <p style="margin:0;color:#1e293b;font-size:14px;">${shipping}</p>
          </div>

          <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
            Te avisaremos cuando tu pedido sea enviado. Si tienes alguna pregunta, escríbenos a
            <a href="mailto:contacto@aumakki.com" style="color:#f59e0b;">contacto@aumakki.com</a>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">© 2026 Aumakki · Guatemala · <a href="#" style="color:#94a3b8;">Política de privacidad</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

export default {
  async afterCreate(event: any) {
    const { result } = event;

    // Crear log inicial de status
    try {
      await (strapi as any).db.query('api::order-status-log.order-status-log').create({
        data: {
          order: result.id,
          status: result.statusOrder || 'pending',
          changedBy: 'sistema',
        },
      });
    } catch (err) {
      strapi.log.warn('Error creando log inicial de status:', err);
    }

    try {
      const order = await (strapi as any).db.query('api::order.order').findOne({
        where: { id: result.id },
        populate: {
          order_items: { select: ['nameSnapshot', 'qty', 'unitPrice', 'lineTotal'] },
          customer: { select: ['email', 'username'] },
        },
      });

      if (!order) return;

      const recipientEmail = order.email || order.customer?.email;
      if (!recipientEmail) return;

      const orderNumber = order.orderNumber || order.oderNumber || `#${order.id}`;

      await (strapi as any).plugin('email').provider.send({
        to: recipientEmail,
        subject: `✅ Tu pedido ${orderNumber} fue recibido — Aumakki`,
        html: buildOrderEmail(order),
      });
    } catch (err) {
      // No bloquear la creación del pedido si falla el email
      strapi.log.warn('Error enviando email de confirmación de orden:', err);
    }
  },
};
