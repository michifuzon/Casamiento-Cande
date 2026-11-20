/* ══════════════════════════════════════════════════════════════════════
   Sesión privada del libro (compartido por las funciones).

   · La contraseña vive SOLO en la variable de entorno LIBRO_CLAVE.
   · Al iniciar sesión se entrega una cookie HttpOnly firmada (HMAC-SHA256)
     que vence a los 7 días. No contiene la contraseña.
   · La firma usa una llave derivada de NETLIFY_TOKEN + LIBRO_CLAVE:
     si se cambia la contraseña, todas las sesiones abiertas se cierran.
   · Si LIBRO_CLAVE no está configurada, el libro queda CERRADO para todos.
   ══════════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');

const COOKIE   = 'libro_sesion';
const DURACION = 7 * 24 * 60 * 60;          // segundos

function clave()    { return process.env.LIBRO_CLAVE || ''; }

function llave() {
  return crypto.createHmac('sha256', 'libro-cande:' + (process.env.NETLIFY_TOKEN || ''))
    .update('sesion:' + clave()).digest();
}

function firmar(texto) {
  return crypto.createHmac('sha256', llave()).update(texto).digest('base64url');
}

function iguales(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function claveCorrecta(recibida) {
  return !!clave() && typeof recibida === 'string' && iguales(recibida, clave());
}

function leerCookie(headers) {
  const h = (headers && (headers.cookie || headers.Cookie)) || '';
  for (const parte of h.split(';')) {
    const i = parte.indexOf('=');
    if (i > -1 && parte.slice(0, i).trim() === COOKIE) return parte.slice(i + 1).trim();
  }
  return '';
}

function sesionValida(headers) {
  if (!clave()) return false;
  const [version, vence, firma] = leerCookie(headers).split('.');
  if (version !== 'v1' || !vence || !firma) return false;
  if (!(Number(vence) > Date.now() / 1000)) return false;
  return iguales(firma, firmar('v1.' + vence));
}

function esSeguro(headers) {
  const proto = (headers && (headers['x-forwarded-proto'] || headers['X-Forwarded-Proto'])) || '';
  const host  = (headers && (headers.host || headers.Host)) || '';
  // En Netlify siempre es https. Solo en pruebas locales (http://localhost) se omite "Secure".
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return proto === 'https';
  return true;
}

function cookieNueva(headers) {
  const vence = Math.floor(Date.now() / 1000) + DURACION;
  const valor = `v1.${vence}.${firmar('v1.' + vence)}`;
  return `${COOKIE}=${valor}; Path=/; Max-Age=${DURACION}; HttpOnly; SameSite=Strict` + (esSeguro(headers) ? '; Secure' : '');
}

function cookieBorrada(headers) {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict` + (esSeguro(headers) ? '; Secure' : '');
}

function json(statusCode, data, extra = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
    body: JSON.stringify(data)
  };
}

function noAutorizado() {
  if (!clave()) return json(503, { error: 'El libro todavía no tiene contraseña (falta LIBRO_CLAVE).' });
  return json(401, { error: 'Iniciá sesión para ver el libro.' });
}

module.exports = { claveCorrecta, sesionValida, cookieNueva, cookieBorrada, firmar, iguales, json, noAutorizado };
