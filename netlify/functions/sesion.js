/* /.netlify/functions/sesion
   GET    → { autenticado: true|false }
   POST   → { clave } inicia sesión (cookie HttpOnly)
   DELETE → cierra la sesión */

const { claveCorrecta, sesionValida, cookieNueva, cookieBorrada, json } = require('../lib/sesion');

exports.handler = async function (event) {
  const metodo = event.httpMethod;

  if (metodo === 'GET') {
    return json(200, { autenticado: sesionValida(event.headers), configurado: !!process.env.LIBRO_CLAVE });
  }

  if (metodo === 'DELETE') {
    return json(200, { autenticado: false }, { 'Set-Cookie': cookieBorrada(event.headers) });
  }

  if (metodo === 'POST') {
    if (!process.env.LIBRO_CLAVE) {
      return json(503, { error: 'Falta configurar LIBRO_CLAVE en Netlify.' });
    }
    let clave = '';
    try {
      const cuerpo = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : (event.body || '');
      clave = JSON.parse(cuerpo).clave;
    } catch { /* cuerpo inválido */ }

    if (!claveCorrecta(clave)) {
      await new Promise(r => setTimeout(r, 900));        // frena los intentos al azar
      return json(401, { error: 'Contraseña incorrecta.' });
    }
    return json(200, { autenticado: true }, { 'Set-Cookie': cookieNueva(event.headers) });
  }

  return json(405, { error: 'Método no permitido' }, { Allow: 'GET, POST, DELETE' });
};
