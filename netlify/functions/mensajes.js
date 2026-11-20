/* ══════════════════════════════════════════════════════════════════════
   /.netlify/functions/mensajes
   Devuelve los mensajes del formulario "mensajes-candela" (Netlify Forms)
   para mostrarlos en libro.html.

   Variables de entorno (Netlify → Site configuration → Environment):
   · NETLIFY_TOKEN      (obligatoria) token personal de Netlify.
   · NETLIFY_SITE_ID    (opcional)    ID del sitio de Cande. Si falta, se usa
                                      SITE_ID, que Netlify define solo.
   · NETLIFY_FORM_NAME  (opcional)    por defecto "mensajes-candela".
   · LIBRO_CLAVE        (obligatoria) contraseña del libro. Sin sesión
                                      iniciada (ver functions/sesion.js) esta
                                      función no devuelve nada.

   Separación con "Cumple Fau 2026": este sitio es otro sitio de Netlify
   (otro SITE_ID) y el formulario tiene otro nombre. Aunque por error se
   copiara el SITE_ID del cumpleaños, no existe ahí un formulario
   "mensajes-candela", así que la función responde 404 y no mezcla datos.
   ══════════════════════════════════════════════════════════════════════ */

const { sesionValida, firmar, json: jsonResponseBase, noAutorizado } = require('../lib/sesion');

const API = 'https://api.netlify.com/api/v1';
const POR_PAGINA = 100;
const MAX_PAGINAS = 50;

exports.handler = async function (event) {

  const token    = process.env.NETLIFY_TOKEN;
  const siteId   = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const formName = process.env.NETLIFY_FORM_NAME || 'mensajes-candela';

  // ── Acceso privado: solo con sesión iniciada ──
  if (!sesionValida(event.headers)) return noAutorizado();

  if (!token)  return jsonResponse(500, { error: 'Falta NETLIFY_TOKEN' });
  if (!siteId) return jsonResponse(500, { error: 'Falta NETLIFY_SITE_ID' });

  const headers = { Authorization: `Bearer ${token}` };

  try {

    // ── Buscar el formulario por nombre dentro de ESTE sitio ──
    const formsResponse = await fetch(`${API}/sites/${siteId}/forms`, { headers });

    if (!formsResponse.ok) {
      return jsonResponse(formsResponse.status, {
        error: 'No se pudieron leer los formularios del sitio'
      });
    }

    const forms = await formsResponse.json();
    const form  = forms.find(item => item.name === formName);

    if (!form) {
      // Todavía nadie envió nada (Netlify crea el formulario al desplegar,
      // pero por las dudas): se devuelve un libro vacío.
      return jsonResponse(200, []);
    }

    // ── Traer TODOS los envíos, página por página ──
    const submissions = [];

    for (let page = 1; page <= MAX_PAGINAS; page++) {
      const res = await fetch(
        `${API}/forms/${form.id}/submissions?per_page=${POR_PAGINA}&page=${page}`,
        { headers }
      );

      if (!res.ok) {
        return jsonResponse(res.status, {
          error: 'No se pudieron leer los mensajes',
          status: res.status
        });
      }

      const lote = await res.json();
      submissions.push(...lote);
      if (lote.length < POR_PAGINA) break;
    }

    const mensajes = submissions.map(item => {
      const data = item.data || {};
      const foto = getFoto(data.foto) || getFoto(data.Foto);
      return {
        id:        item.id || '',
        nombre:    data.nombre  || data.Nombre  || '',
        mensaje:   data.mensaje || data.Mensaje || '',
        // La foto pasa por /.netlify/functions/foto, que también pide sesión
        fotoUrl:   foto ? `/.netlify/functions/foto?u=${encodeURIComponent(foto.url)}&s=${firmar('foto:' + foto.url)}` : '',
        fotoTipo:  foto ? foto.tipo : '',
        createdAt: item.created_at || ''
      };
    });

    mensajes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return jsonResponse(200, mensajes);

  } catch (error) {
    return jsonResponse(500, {
      error: 'Error interno leyendo mensajes',
      detail: error.message
    });
  }
};

function jsonResponse(statusCode, data) {
  return jsonResponseBase(statusCode, data);
}

function getFoto(foto) {
  if (!foto) return null;
  if (Array.isArray(foto)) foto = foto[0];
  if (typeof foto === 'string') return foto ? { url: foto, tipo: '' } : null;
  if (foto && typeof foto === 'object') {
    const url = foto.url || foto.secure_url || foto.href || '';
    return url ? { url, tipo: foto.type || '' } : null;
  }
  return null;
}
