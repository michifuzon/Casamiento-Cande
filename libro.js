/* ══════════════════════════════════════════════════════════════════════
   libro.js — libro digital de recuerdos (libro.html)
   Lee las respuestas del formulario "mensajes-candela" a través de
   /.netlify/functions/mensajes y muestra una por página.

   · Si en Netlify está configurada LIBRO_CLAVE, abrir:
       libro.html?clave=LA_CLAVE
   · Para previsualizar el diseño sin respuestas reales:
       libro.html?demo
   ══════════════════════════════════════════════════════════════════════ */

// ── DOM ───────────────────────────────────────────────────────────────
const book         = document.getElementById('book');
const cover        = document.getElementById('bookCover');
const clickText    = document.getElementById('clickText');
const bookClose    = document.getElementById('bookClose');
const pageScroll   = document.getElementById('pageScroll');
const bookPage     = document.getElementById('bookPage');
const loadingState = document.getElementById('loadingState');
const emptyState   = document.getElementById('emptyState');
const errorState   = document.getElementById('errorState');
const errorTitulo  = document.getElementById('errorTitulo');
const errorTexto   = document.getElementById('errorTexto');
const reintentar   = document.getElementById('reintentar');

const params = new URLSearchParams(location.search);
const CLAVE  = params.get('clave') || '';
const DEMO   = params.has('demo');

let currentPage = 0;
let bookPages   = [];
let direccion   = 'next';

// Giro leve de la polaroid, alternado página a página
const GIROS_FOTO = ['-1.6deg', '1.4deg', '-1deg', '1.8deg'];


// ══════════════════════════════════════════════════════════════════════
//  ABRIR / CERRAR
// ══════════════════════════════════════════════════════════════════════

function abrirLibro() {
  if (book.classList.contains('open')) return;
  book.style.transform = '';
  book.classList.add('open');
  clickText.classList.add('hidden');
}

function cerrarLibro() {
  book.classList.remove('open');
  clickText.classList.remove('hidden');
}

cover.addEventListener('click', abrirLibro);
cover.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirLibro(); }
});
[cover, clickText].forEach(el => {
  el.addEventListener('touchstart', e => { e.preventDefault(); abrirLibro(); }, { passive: false });
});
clickText.addEventListener('click', abrirLibro);
bookClose.addEventListener('click', cerrarLibro);

// Inclinación 3D en escritorio (como el original)
if (window.matchMedia('(hover:hover) and (pointer:fine)').matches && window.innerWidth > 900) {
  document.addEventListener('mousemove', e => {
    if (book.classList.contains('open')) return;
    const dx = (e.clientX - window.innerWidth  / 2) / (window.innerWidth  / 2);
    const dy = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    book.style.transform = `perspective(1400px) rotateY(${dx * 7}deg) rotateX(${-dy * 4}deg)`;
  });
  document.addEventListener('mouseleave', () => { book.style.transform = ''; });
}


// ══════════════════════════════════════════════════════════════════════
//  CARGA DE MENSAJES
// ══════════════════════════════════════════════════════════════════════

function mostrarEstado(cual) {
  loadingState.hidden = cual !== 'loading';
  emptyState.hidden   = cual !== 'empty';
  errorState.hidden   = cual !== 'error';
  bookPage.hidden     = cual !== 'page';
  // el estado de carga arranca visible por HTML
  loadingState.style.display = cual === 'loading' ? '' : 'none';
}

async function cargarMensajes() {
  mostrarEstado('loading');

  if (DEMO) {
    prepararPaginas(mensajesDemo());
    return;
  }

  try {
    const url = '/.netlify/functions/mensajes' + (CLAVE ? `?clave=${encodeURIComponent(CLAVE)}` : '');
    const response = await fetch(url, { method: 'GET', cache: 'no-store' });

    if (response.status === 401) {
      errorTitulo.textContent = 'Este libro es privado';
      errorTexto.textContent  = 'Abrilo con el enlace completo que te pasaron (incluye la clave).';
      reintentar.hidden = true;
      mostrarEstado('error');
      return;
    }

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const mensajes = await response.json();
    if (!Array.isArray(mensajes)) throw new Error('Respuesta inesperada');

    prepararPaginas(mensajes);

  } catch (err) {
    console.error(err);
    errorTitulo.textContent = 'No se pudieron cargar los mensajes';
    errorTexto.textContent  = 'Probá abrir el libro de nuevo en un ratito.';
    reintentar.hidden = false;
    mostrarEstado('error');
  }
}

reintentar.addEventListener('click', cargarMensajes);

function prepararPaginas(mensajes) {
  const validos = (mensajes || []).filter(m => m && (m.nombre || m.mensaje));

  if (!validos.length) {
    mostrarEstado('empty');
    return;
  }

  bookPages = [
    { type: 'intro', totalMessages: validos.length },
    ...validos.map((data, index) => ({ type: 'message', data, index }))
  ];

  currentPage = 0;
  mostrarEstado('page');
  renderCurrentPage();
}


// ══════════════════════════════════════════════════════════════════════
//  PÁGINAS
// ══════════════════════════════════════════════════════════════════════

function renderCurrentPage() {
  const page = bookPages[currentPage];
  if (!page) return;

  bookPage.innerHTML = page.type === 'intro' ? htmlIntro(page) : htmlMensaje(page);
  pageScroll.scrollTop = 0;

  // Animación de paso de página
  const contenido = bookPage.firstElementChild;
  contenido.classList.add(direccion === 'prev' ? 'entra-izq' : 'entra-der');

  // Fotos: mostrar al cargar; si falla, se oculta el marco
  bookPage.querySelectorAll('.entry-photo img').forEach(img => {
    const fig = img.closest('.entry-photo');
    const listo = () => fig.classList.add('cargada');
    if (img.complete && img.naturalWidth) listo();
    img.addEventListener('load', listo);
    img.addEventListener('error', () => fig.classList.add('sin-foto'));
  });

  precargarFoto(currentPage + 1);
}

function htmlIntro(page) {
  const n = page.totalMessages;
  return `
    <div class="single-page-content intro-page">

      <div class="intro-carta">
        <span class="lazo-icono intro-lazo" aria-hidden="true"><svg viewBox="0 0 200 170"><use href="#i-lazo"/></svg></span>

        <h1 class="titulo-serif intro-titulo">Para <em>Cande</em>, con todo nuestro amor</h1>

        <div class="intro-texto">
          <p>En un día tan especial, quisimos regalarte algo que puedas guardar para siempre.</p>
          <p>Este libro reúne las palabras, los recuerdos y el cariño de todas las personas que te acompañan en esta nueva etapa.</p>
          <p>Cada página tiene un pedacito de alguien que te quiere.</p>
        </div>

        <p class="intro-cuenta">
          <strong>${n}</strong> ${n === 1 ? 'mensaje te está esperando' : 'mensajes te están esperando'}
        </p>
      </div>

      ${htmlNav()}
    </div>`;
}

function htmlMensaje(page) {
  const entry  = page.data;
  const i      = page.index;
  const giro   = GIROS_FOTO[i % GIROS_FOTO.length];
  const nombre = escapeHtml(entry.nombre || 'Alguien que te quiere');
  const numero = String(i + 1).padStart(2, '0');
  const foto   = entry.fotoUrl
    ? `
      <figure class="entry-photo" style="--photo-r:${giro}">
        <span class="cinta-rayas photo-cinta" aria-hidden="true"></span>
        <img src="${escapeHtml(entry.fotoUrl)}" alt="Foto que mandó ${nombre}" decoding="async" />
      </figure>`
    : '';

  return `
    <div class="single-page-content message-page">

      <article class="entry-card ${entry.fotoUrl ? 'has-photo' : 'solo-texto'}">
        ${foto}
        <div class="entry-body">
          <span class="entry-num">N.º ${numero}</span>
          <h2 class="titulo-serif entry-name">${nombre}</h2>
          <div class="entry-text">${escapeHtml(entry.mensaje || '').trim()}</div>
        </div>
      </article>

      ${htmlNav()}
    </div>`;
}

function htmlNav() {
  const isFirst = currentPage === 0;
  const isLast  = currentPage === bookPages.length - 1;

  return `
    <nav class="page-navigation" aria-label="Páginas del libro">
      <button type="button" class="btn btn--linea page-btn" aria-label="Anterior" data-accion="prev" ${isFirst ? 'disabled' : ''}>
        <span aria-hidden="true">←</span><span class="btn-txt">Anterior</span>
      </button>

      <span class="page-counter">${currentPage + 1} / ${bookPages.length}</span>

      ${isLast
        ? `<button type="button" class="btn btn--linea page-btn" data-accion="cerrar" aria-label="Cerrar libro"><span class="btn-txt">Cerrar libro</span><span aria-hidden="true">✕</span></button>`
        : `<button type="button" class="btn page-btn" data-accion="next" aria-label="Siguiente"><span class="btn-txt">Siguiente</span><span aria-hidden="true">→</span></button>`}
    </nav>`;
}

bookPage.addEventListener('click', e => {
  const btn = e.target.closest('[data-accion]');
  if (!btn) return;
  const accion = btn.dataset.accion;
  if (accion === 'next')   nextPage();
  if (accion === 'prev')   previousPage();
  if (accion === 'cerrar') cerrarLibro();
});

function nextPage() {
  if (currentPage < bookPages.length - 1) {
    currentPage++;
    direccion = 'next';
    renderCurrentPage();
  }
}

function previousPage() {
  if (currentPage > 0) {
    currentPage--;
    direccion = 'prev';
    renderCurrentPage();
  }
}

function precargarFoto(indice) {
  const p = bookPages[indice];
  if (p && p.type === 'message' && p.data.fotoUrl) {
    const img = new Image();
    img.src = p.data.fotoUrl;
  }
}

// Teclado: flechas para pasar, Escape para cerrar
document.addEventListener('keydown', e => {
  if (!book.classList.contains('open') || bookPage.hidden) return;
  if (e.key === 'ArrowRight') nextPage();
  if (e.key === 'ArrowLeft')  previousPage();
  if (e.key === 'Escape')     cerrarLibro();
});

// Deslizar con el dedo para pasar de página (solo gestos horizontales claros)
(function () {
  let x0 = null, y0 = null;
  pageScroll.addEventListener('touchstart', e => {
    const t = e.touches[0];
    x0 = t.clientX; y0 = t.clientY;
  }, { passive: true });
  pageScroll.addEventListener('touchend', e => {
    if (x0 === null || bookPage.hidden) return;
    const t  = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    x0 = y0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      dx < 0 ? nextPage() : previousPage();
    }
  }, { passive: true });
}());


// ══════════════════════════════════════════════════════════════════════
//  UTILIDADES
// ══════════════════════════════════════════════════════════════════════

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* Mensajes de EJEMPLO (solo con ?demo). Sirven para ver el diseño;
   no son mensajes reales ni se guardan en ningún lado. */
function mensajesDemo() {
  return [
    {
      nombre:  'Invitada de ejemplo',
      mensaje: 'Este es un mensaje de ejemplo para ver cómo queda una página con foto.\n\nAcá va a aparecer, completo y con sus saltos de línea, lo que cada persona le escriba a Cande',
      fotoUrl: 'assets/candela-portada.webp'
    },
    {
      nombre:  'Invitado de ejemplo',
      mensaje: 'Mensaje de ejemplo sin foto, para ver cómo se ve una página solo con texto.',
      fotoUrl: ''
    },
    {
      nombre:  'Mensaje largo de ejemplo',
      mensaje: Array.from({ length: 7 }, (_, i) =>
        `Párrafo de ejemplo ${i + 1}. Así se ve un mensaje largo: la página se puede desplazar y la navegación queda siempre visible abajo, para pasar a la siguiente cuando termines de leer.`
      ).join('\n\n'),
      fotoUrl: ''
    }
  ];
}

cargarMensajes();
