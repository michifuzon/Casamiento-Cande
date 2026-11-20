/* ══════════════════════════════════════════════════════════════════════
   /.netlify/functions/mensajes
   Devuelve los mensajes del formulario "mensajes-candela" (Netlify Forms)
   para mostrarlos en libro.html.

   Variables de entorno (Netlify → Site configuration → Environment):
   · NETLIFY_TOKEN      (obligatoria) token personal de Netlify.
   · NETLIFY_SITE_ID    (opcional)    ID del sitio de Cande. Si falta, se usa
                                      SITE_ID, que Netlify define solo.
   · NETLIFY_FORM_NAME  (opcional)    por defecto "mensajes-candela".
   · LIBRO_CLAVE        (recomendada) si está definida, el libro solo se abre
                                      con libro.html?clave=ESA_CLAVE.

   Separación con "Cumple Fau 2026": este sitio es otro sitio de Netlify
   (otro SITE_ID) y el formulario tiene otro nombre. Aunque por error se
   copiara el SITE_ID del cumpleaños, no existe ahí un formulario
   "mensajes-candela", así que la función responde 404 y no mezcla datos.
   ══════════════════════════════════════════════════════════════════════ */

const API = 'https://api.netlify.com/api/v1';
const POR_PAGINA = 100;
const MAX_PAGINAS = 50;

exports.handler = async function (event) {

  const token    = process.env.NETLIFY_TOKEN;
  const siteId   = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const formName = process.env.NETLIFY_FORM_NAME || 'mensajes-candela';
  const clave    = process.env.LIBRO_CLAVE;

  // ── Acceso privado (opcional) ──
  if (clave) {
    const recibida =
      (event.queryStringParameters && event.queryStringParameters.clave) ||
      (event.headers && (event.headers['x-libro-clave'] || event.headers['X-Libro-Clave'])) ||
      '';
    if (recibida !== clave) {
      return jsonResponse(401, { error: 'Acceso restringido' });
    }
  }

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
      return {
        nombre:    data.nombre  || data.Nombre  || '',
        mensaje:   data.mensaje || data.Mensaje || '',
        fotoUrl:   getFotoUrl(data.foto) || getFotoUrl(data.Foto) || '',
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
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(data)
  };
}

function getFotoUrl(foto) {
  if (!foto) return '';
  if (typeof foto === 'string') return foto;
  if (Array.isArray(foto) && foto[0]) {
    return foto[0].url || foto[0].secure_url || foto[0].href || '';
  }
  if (typeof foto === 'object') {
    return foto.url || foto.secure_url || foto.href || '';
  }
  return '';
}
