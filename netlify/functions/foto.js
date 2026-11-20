/* /.netlify/functions/foto?u=…&s=…
   Entrega la foto de un mensaje SOLO con sesión iniciada.
   "u" es la dirección del archivo que dio la API de Netlify y "s" su firma
   (la genera la función "mensajes"): no sirve como proxy para otra cosa. */

const { sesionValida, firmar, iguales, json, noAutorizado } = require('../lib/sesion');

const LIMITE = 4.3 * 1024 * 1024;   // las funciones responden hasta ~6 MB en base64

exports.handler = async function (event) {
  if (!sesionValida(event.headers)) return noAutorizado();

  const q = event.queryStringParameters || {};
  const url = q.u || '';
  if (!url || !q.s || !iguales(q.s, firmar('foto:' + url)) || !/^https?:\/\//.test(url)) {
    return json(400, { error: 'Foto inválida' });
  }

  try {
    const r = await fetch(url);
    if (!r.ok) return json(r.status === 403 ? 410 : 502, { error: 'La foto no está disponible', status: r.status });

    const datos = Buffer.from(await r.arrayBuffer());
    const tipo  = r.headers.get('content-type') || 'application/octet-stream';

    if (datos.length > LIMITE) {
      // Demasiado pesada para pasar por la función: se redirige al archivo
      // (dirección temporal y firmada de Netlify).
      return { statusCode: 302, headers: { Location: url, 'Cache-Control': 'no-store' }, body: '' };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': tipo, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
      body: datos.toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return json(502, { error: 'No se pudo traer la foto', detail: e.message });
  }
};
