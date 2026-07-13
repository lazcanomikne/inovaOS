// Envío de correo por SMTP (servidor propio de INOVATECH).
// Las credenciales viven sólo en variables de entorno.
import nodemailer from 'nodemailer';
import { LOGO_BASE64 } from './_logo.js';

let transporte;

// Cabecera de marca compartida (con el logo incrustado vía CID: se ve siempre,
// aunque el cliente bloquee imágenes externas).
const CABECERA = `
  <tr><td style="background:linear-gradient(135deg,#5b5bd6,#7c6cf0);padding:18px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:12px;vertical-align:middle;">
        <img src="cid:logo-inovaos" width="46" height="46" alt="InovaOS" style="display:block;border-radius:12px;" />
      </td>
      <td style="vertical-align:middle;">
        <div style="color:#fff;font-size:19px;font-weight:800;letter-spacing:-.02em;">InovaOS</div>
        <div style="color:rgba(255,255,255,.78);font-size:12px;margin-top:2px;">Tu operación, bajo control.</div>
      </td>
    </tr></table>
  </td></tr>`;

// Adjunto del logo para el sendMail (referenciado por el cid de la cabecera).
const ADJUNTO_LOGO = {
  filename: 'inovaos.png',
  content: Buffer.from(LOGO_BASE64, 'base64'),
  cid: 'logo-inovaos',
  contentType: 'image/png',
};

function tx() {
  if (!transporte) {
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error('Falta configuración SMTP');
    transporte = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 465),
      secure: String(SMTP_SECURE ?? 'true') === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // En serverless conviene no dejar sockets colgando.
      pool: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporte;
}

const plantilla = (codigo, nombre) => `
<!doctype html>
<html lang="es"><body style="margin:0;background:#f2f1fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:440px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 6px 24px rgba(17,12,46,.10);">
        ${CABECERA}
        <tr><td style="padding:28px 24px;">
          <p style="margin:0 0 6px;font-size:16px;color:#15102b;">Hola${nombre ? ' ' + nombre : ''},</p>
          <p style="margin:0 0 22px;font-size:14px;color:#5b5768;line-height:1.5;">Tu código para entrar a InovaOS:</p>
          <div style="text-align:center;margin:0 0 22px;">
            <div style="display:inline-block;background:#f2f1fb;border:1px solid #e2def5;border-radius:14px;padding:16px 26px;font-size:34px;font-weight:800;letter-spacing:10px;color:#5b5bd6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${codigo}</div>
          </div>
          <p style="margin:0 0 8px;font-size:13px;color:#5b5768;line-height:1.5;">Vence en <strong>10 minutos</strong> y sólo sirve una vez.</p>
          <p style="margin:0;font-size:13px;color:#8a8699;line-height:1.5;">Si no fuiste tú, ignora este correo. Nadie puede entrar sin este código.</p>
        </td></tr>
        <tr><td style="padding:14px 24px 22px;border-top:1px solid #f0eef8;">
          <p style="margin:0;font-size:11px;color:#a5a1b5;">Este es un correo automático, no respondas a esta dirección.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

/* ---------------------- Recordatorios de pendientes ---------------------- */

const APP_URL = 'https://inovaos.mikne.com.mx';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const COLOR_PRIORIDAD = { Alta: '#ff453a', Media: '#ff9f0a', Baja: '#30d158' };

// Encuadre de cada recordatorio (coincide con la franja del diagrama).
export const RECORDATORIOS = {
  por_aceptar: {
    texto: 'Pendiente por aceptar', color: '#5b5bd6', urgente: false,
    intro: 'Te asignaron este pendiente', cta: 'Aceptar pendiente',
    nota: 'Aún no lo has aceptado. Ábrelo para aceptarlo o proponer otra fecha.',
  },
  '3dias': { texto: 'Vence en 3 días', color: '#30d158', urgente: false },
  '2dias': { texto: 'Vence en 2 días', color: '#ff9f0a', urgente: false },
  '1dia': { texto: 'Vence mañana', color: '#ff9f0a', urgente: false },
  hoy: { texto: 'Vence hoy', color: '#ff9f0a', urgente: true },
  vencido24: { texto: 'Vencido — 1 día de retraso', color: '#ff453a', urgente: true },
  vencido48: { texto: 'Vencido — 2 días de retraso', color: '#ff453a', urgente: true },
  vencido72: { texto: 'Vencido — 3 días · retraso crítico', color: '#ff453a', urgente: true },
};

function fechaLarga(iso) {
  if (!iso) return 'Sin fecha compromiso';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (isNaN(d)) return String(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

const fila = (etiqueta, valor) => valor
  ? `<tr>
       <td style="padding:7px 0;color:#8a8699;font-size:13px;width:120px;vertical-align:top;">${etiqueta}</td>
       <td style="padding:7px 0;color:#15102b;font-size:14px;font-weight:600;">${valor}</td>
     </tr>`
  : '';

export function plantillaRecordatorio(p, tipo) {
  const r = RECORDATORIOS[tipo] || RECORDATORIOS['1dia'];
  const colorPri = COLOR_PRIORIDAD[p.prioridad] || '#8a8699';
  return `
<!doctype html>
<html lang="es"><body style="margin:0;background:#f2f1fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 6px 24px rgba(17,12,46,.10);">

        ${CABECERA}

        <!-- Banda de estado del vencimiento -->
        <tr><td style="background:${r.color}1a;border-left:4px solid ${r.color};padding:12px 20px;">
          <span style="color:${r.color};font-size:14px;font-weight:800;">${r.urgente ? '⚠️ ' : '🗓️ '}${r.texto}</span>
        </td></tr>

        <!-- Cuerpo -->
        <tr><td style="padding:24px;">
          <p style="margin:0 0 4px;font-size:13px;color:#8a8699;">${r.intro || 'Recordatorio de pendiente'}</p>
          <h1 style="margin:0 0 4px;font-size:21px;font-weight:800;color:#15102b;letter-spacing:-.02em;line-height:1.25;">${p.titulo}</h1>
          ${p.descripcion ? `<p style="margin:0 0 14px;font-size:14px;color:#5b5768;line-height:1.5;">${p.descripcion}</p>` : '<div style="height:10px"></div>'}

          ${r.nota ? `<div style="background:${r.color}12;border-radius:12px;padding:12px 14px;margin:0 0 16px;font-size:13px;color:#5b5768;line-height:1.5;">👉 ${r.nota}</div>` : ''}

          <table role="presentation" width="100%" style="border-top:1px solid #f0eef8;border-bottom:1px solid #f0eef8;margin:4px 0 20px;">
            ${fila('Responsable', p.responsable_nombre)}
            ${fila('Delegado por', p.creador_nombre)}
            ${fila('Prioridad', `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colorPri};margin-right:6px;vertical-align:middle;"></span>${p.prioridad || '—'}`)}
            ${fila('Área', p.area)}
            ${fila('Fecha compromiso', fechaLarga(p.fecha_compromiso))}
          </table>

          <a href="${APP_URL}" style="display:block;text-align:center;background:linear-gradient(135deg,#5b5bd6,#7c6cf0);color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px;border-radius:14px;">
            ${r.cta || 'Abrir en InovaOS'}
          </a>
        </td></tr>

        <tr><td style="padding:14px 24px 22px;border-top:1px solid #f0eef8;">
          <p style="margin:0;font-size:11px;color:#a5a1b5;">Recibes este correo porque eres responsable de este pendiente en InovaOS. Correo automático, no respondas a esta dirección.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function enviarRecordatorio(destinatario, pendiente, tipo) {
  const r = RECORDATORIOS[tipo] || RECORDATORIOS['1dia'];
  const from = `InovaOS <${process.env.SMTP_USER}>`;
  const prefijo = r.urgente ? '⚠️ ' : '';
  await tx().sendMail({
    from,
    to: destinatario,
    subject: `${prefijo}${r.texto}: ${pendiente.titulo}`,
    text: `Recordatorio InovaOS — ${r.texto}\n\nPendiente: ${pendiente.titulo}\nResponsable: ${pendiente.responsable_nombre || '—'}\nDelegado por: ${pendiente.creador_nombre || '—'}\nPrioridad: ${pendiente.prioridad || '—'}\nFecha compromiso: ${fechaLarga(pendiente.fecha_compromiso)}\n\nÁbrelo en ${APP_URL}`,
    html: plantillaRecordatorio(pendiente, tipo),
    attachments: [ADJUNTO_LOGO],
  });
}

export async function enviarCodigo(email, codigo, nombre) {
  // La marca es InovaOS; la dirección real sigue siendo la del buzón SMTP.
  const from = `InovaOS <${process.env.SMTP_USER}>`;
  await tx().sendMail({
    from,
    to: email,
    subject: `${codigo} es tu código de acceso · InovaOS`,
    text: `Tu código para entrar a InovaOS es ${codigo}. Vence en 10 minutos y sólo sirve una vez. Si no fuiste tú, ignora este correo.`,
    html: plantilla(codigo, nombre),
    attachments: [ADJUNTO_LOGO],
  });
}

// Comprueba conexión + autenticación sin enviar nada.
export async function verificarSmtp() {
  await tx().verify();
  return true;
}
