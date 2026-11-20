/* ══════════════════════════════════════════════════════════════════════
   libro.js — libro digital de recuerdos (libro.html)
   Lee las respuestas del formulario "mensajes-candela" a través de
   /.netlify/functions/mensajes y muestra una por página.

   · Es PRIVADO: pide la contraseña (LIBRO_CLAVE en Netlify) y la valida
     el servidor (/.netlify/functions/sesion), que deja una cookie segura.
   · Herramientas de impresión: vista previa A4, carta PDF, todas en ZIP
     o en un único PDF (ver cartas.js).
   · Para previsualizar el diseño sin respuestas reales (solo en la
     computadora, con un servidor local): libro.html?demo
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
const LOCAL  = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const DEMO   = params.has('demo') && LOCAL;
const SESION = '/.netlify/functions/sesion';

let sesionActiva = false;
let mensajes     = [];

let currentPage = 0;
let bookPages   = [];
let direccion   = 'next';

// Giro leve de la polaroid, alternado página a página
const GIROS_FOTO = ['-1.6deg', '1.4deg', '-1deg', '1.8deg'];


// ══════════════════════════════════════════════════════════════════════
//  ABRIR / CERRAR
// ══════════════════════════════════════════════════════════════════════

function abrirLibro() {
  if (!sesionActiva) { pedirClave(); return; }
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

async function pedirMensajes() {
  const response = await fetch('/.netlify/functions/mensajes', { method: 'GET', cache: 'no-store', credentials: 'same-origin' });
  if (response.status === 401) { const e = new Error('sesión'); e.sesion = true; throw e; }
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const lista = await response.json();
  if (!Array.isArray(lista)) throw new Error('Respuesta inesperada');
  return lista;
}

async function cargarMensajes() {
  mostrarEstado('loading');

  if (DEMO) {
    prepararPaginas(mensajesDemo());
    return;
  }

  try {
    prepararPaginas(await pedirMensajes());
  } catch (err) {
    if (err.sesion) { sesionVencida(); return; }
    console.error(err);
    errorTitulo.textContent = 'No se pudieron cargar los mensajes';
    errorTexto.textContent  = 'Probá abrir el libro de nuevo en un ratito.';
    reintentar.hidden = false;
    mostrarEstado('error');
  }
}

reintentar.addEventListener('click', cargarMensajes);

function prepararPaginas(lista) {
  const validos = (lista || []).filter(m => m && (m.nombre || m.mensaje));
  mensajes = validos;
  limpiarCartas();
  actualizarBarra();

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

  // Avisos de impresión de esta carta (foto con poca resolución, etc.)
  if (page.type === 'message') {
    const indice = page.index;
    obtenerCarta(indice).then(carta => {
      const ul = bookPage.querySelector('.entry-avisos');
      if (!ul || bookPages[currentPage] !== page) return;
      pintarAvisos(ul, carta.avisos);
    }).catch(() => {});
  }
}

function htmlIntro(page) {
  const n = page.totalMessages;
  return `
    <div class="single-page-content intro-page">

      <div class="intro-carta">
        <span class="intro-stickers" aria-hidden="true">
          <span class="sticker st-corazon"><svg viewBox="0 0 200 184"><use href="#i-corazon-pintado"/></svg></span>
          <span class="sticker st-lazo"><svg viewBox="0 0 200 170"><use href="#i-lazo"/></svg></span>
          <span class="sticker st-flor"><svg viewBox="0 0 200 200"><use href="#i-flor-azul"/></svg></span>
        </span>

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
        <span class="cinta photo-cinta" aria-hidden="true"></span>
        <span class="sticker foto-flor st-flor" aria-hidden="true"><svg viewBox="0 0 200 200"><use href="#i-flor-azul"/></svg></span>
        <img src="${escapeHtml(entry.fotoUrl)}" alt="Foto que mandó ${nombre}" decoding="async" />
      </figure>`
    : '';

  return `
    <div class="single-page-content message-page">

      <article class="entry-card ${entry.fotoUrl ? 'has-photo' : 'solo-texto'}">
        ${foto}
        <div class="entry-body">
          <span class="entry-num">N.º ${numero}${stickerChico(i)}</span>
          <h2 class="titulo-serif entry-name">${nombre}</h2>
          <div class="entry-text">${escapeHtml(entry.mensaje || '').trim()}</div>
          <div class="entry-acciones">
            <button type="button" class="btn btn--linea btn--chico" data-accion="vista" data-indice="${i}">Vista previa A4</button>
            <button type="button" class="btn btn--chico" data-accion="pdf" data-indice="${i}">Descargar carta PDF</button>
          </div>
          <ul class="lista-avisos entry-avisos" hidden></ul>
        </div>
      </article>

      ${htmlNav()}
    </div>`;
}

// Sticker chiquito junto al número: alterna moño, flor y corazón
function stickerChico(i) {
  const tipos = [
    ['i-lazo', '0 0 200 170'],
    ['i-flor-azul', '0 0 200 200'],
    ['i-corazon-pintado', '0 0 200 184']
  ];
  const [id, vb] = tipos[i % tipos.length];
  return `<span class="sticker-inline" aria-hidden="true"><svg viewBox="${vb}"><use href="#${id}"/></svg></span>`;
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
  if (accion === 'vista')  abrirVista(Number(btn.dataset.indice));
  if (accion === 'pdf')    descargarCarta(Number(btn.dataset.indice), btn);
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
  if (hayModalAbierto()) return;
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
//  SESIÓN PRIVADA
// ══════════════════════════════════════════════════════════════════════

const loginModal  = document.getElementById('loginModal');
const loginForm   = document.getElementById('loginForm');
const loginClave  = document.getElementById('loginClave');
const loginError  = document.getElementById('loginError');
const loginEntrar = document.getElementById('loginEntrar');
const barra       = document.getElementById('barraPrivada');
const bpCuenta    = document.getElementById('bpCuenta');

async function verificarSesion() {
  if (DEMO) { entrar(); return; }
  try {
    const r = await fetch(SESION, { cache: 'no-store', credentials: 'same-origin' });
    const d = await r.json();
    if (d.autenticado) entrar();
    else pedirClave(d.configurado === false
      ? 'Todavía no hay contraseña configurada en Netlify (falta LIBRO_CLAVE).'
      : '');
  } catch {
    pedirClave('No se pudo conectar. Revisá la conexión y probá de nuevo.');
  }
}

function pedirClave(error = '') {
  loginError.textContent = error;
  abrirModal(loginModal, loginClave);
}

function entrar() {
  sesionActiva = true;
  cerrarModal(loginModal);
  document.body.classList.add('con-barra');
  barra.hidden = false;
  cargarMensajes();
}

function sesionVencida() {
  salirLocal();
  pedirClave('Tu sesión terminó. Volvé a ingresar la contraseña.');
}

function salirLocal() {
  sesionActiva = false;
  mensajes = [];
  bookPages = [];
  limpiarCartas();
  cerrarVista();
  cerrarLibro();
  barra.hidden = true;
  document.body.classList.remove('con-barra');
  bookPage.innerHTML = '';
  mostrarEstado('loading');
}

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const clave = loginClave.value;
  if (!clave) { loginError.textContent = 'Escribí la contraseña.'; loginClave.focus(); return; }

  loginEntrar.disabled = true;
  loginError.textContent = '';
  try {
    const r = await fetch(SESION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ clave })
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.autenticado) {
      loginClave.value = '';
      entrar();
    } else {
      loginError.textContent = d.error || 'No se pudo iniciar sesión.';
      loginClave.select();
    }
  } catch {
    loginError.textContent = 'No se pudo conectar. Probá de nuevo.';
  } finally {
    loginEntrar.disabled = false;
  }
});

document.getElementById('btnSalir').addEventListener('click', async () => {
  try { await fetch(SESION, { method: 'DELETE', credentials: 'same-origin' }); } catch { /* igual se cierra acá */ }
  salirLocal();
  pedirClave('');
});

function actualizarBarra() {
  const n = mensajes.length;
  bpCuenta.textContent = n === 1 ? '1 mensaje recibido' : `${n} mensajes recibidos`;
  document.getElementById('btnTodas').disabled = n === 0;
}


// ══════════════════════════════════════════════════════════════════════
//  MODALES
// ══════════════════════════════════════════════════════════════════════

const modales = [];

function abrirModal(m, foco) {
  if (!m.classList.contains('show')) modales.push(m);
  m.classList.add('show');
  setTimeout(() => { const f = foco || m.querySelector('button, input'); if (f) f.focus(); }, 350);
}

function cerrarModal(m) {
  m.classList.remove('show');
  const i = modales.indexOf(m);
  if (i > -1) modales.splice(i, 1);
}

function hayModalAbierto() {
  return modales.length > 0 || !vistaA4.hidden;
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!vistaA4.hidden) { cerrarVista(); return; }
  const m = modales[modales.length - 1];
  if (m && m.querySelector('[data-cerrar]')) cerrarModal(m);
});

document.querySelectorAll('[data-cerrar]').forEach(b =>
  b.addEventListener('click', () => cerrarModal(b.closest('.info-modal'))));


// ══════════════════════════════════════════════════════════════════════
//  CARTAS A4 (la composición está en cartas.js)
// ══════════════════════════════════════════════════════════════════════

const cacheCartas = new Map();   // índice → Promise<carta>
const MAX_CACHE = 6;

function limpiarCartas() {
  for (const p of cacheCartas.values()) p.then(c => c.foto && c.foto.liberar()).catch(() => {});
  cacheCartas.clear();
}

let refresco = null;
function refrescarMensajes() {
  if (!refresco) {
    refresco = pedirMensajes().then(lista => {
      const porId = new Map(lista.map(m => [m.id, m]));
      mensajes.forEach(m => { const n = porId.get(m.id); if (n) m.fotoUrl = n.fotoUrl; });
    }).finally(() => { refresco = null; });
  }
  return refresco;
}

async function fotoDe(i) {
  try {
    return await Cartas.prepararFoto(mensajes[i].fotoUrl);
  } catch (e) {
    if (e.status === 401) { sesionVencida(); throw e; }
    if (e.status === 410 || e.status === 400) {          // el enlace temporal de Netlify venció
      await refrescarMensajes();
      return Cartas.prepararFoto(mensajes[i].fotoUrl);
    }
    throw e;
  }
}

async function componerCarta(i) {
  const msg = mensajes[i];
  const avisos = [];
  let foto = null;
  if (msg.fotoUrl) {
    try {
      foto = await fotoDe(i);
    } catch (e) {
      if (e.status === 401) throw e;
      avisos.push(e.formato
        ? 'No se pudo leer la foto adjunta (formato que este navegador no abre, por ejemplo HEIC). La carta se arma sin foto: probá desde Safari o descargá la foto desde Netlify.'
        : 'No se pudo descargar la foto adjunta. La carta se arma sin foto; probá de nuevo en un rato.');
    }
  }
  const carta = await Cartas.componer(msg, i + 1, foto, avisos);
  carta.foto = foto;
  return carta;
}

function obtenerCarta(i) {
  if (cacheCartas.has(i)) {
    const p = cacheCartas.get(i);          // se mueve al final: usada hace poco
    cacheCartas.delete(i);
    cacheCartas.set(i, p);
    return p;
  }
  const p = componerCarta(i);
  p.catch(() => cacheCartas.delete(i));
  cacheCartas.set(i, p);
  while (cacheCartas.size > MAX_CACHE) {
    const [k, viejo] = cacheCartas.entries().next().value;
    cacheCartas.delete(k);
    viejo.then(c => c.foto && c.foto.liberar()).catch(() => {});
  }
  return p;
}

function pintarAvisos(ul, avisos) {
  ul.innerHTML = avisos.map(a => `<li>${escapeHtml(a)}</li>`).join('');
  ul.hidden = !avisos.length;
}

function descargarArchivo(datos, nombre, tipo) {
  const blob = datos instanceof Blob ? datos : new Blob([datos], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return blob.size;
}

async function descargarCarta(i, boton) {
  const texto = boton ? boton.innerHTML : '';
  if (boton) { boton.disabled = true; boton.textContent = 'Generando…'; }
  try {
    const carta = await obtenerCarta(i);
    const bytes = await Cartas.pdfDeCarta(carta);
    descargarArchivo(bytes, carta.archivo, 'application/pdf');
  } catch (e) {
    console.error(e);
    if (e.status !== 401) alert('No se pudo generar la carta. Probá de nuevo.');
  } finally {
    if (boton) { boton.disabled = false; boton.innerHTML = texto; }
  }
}


// ══════════════════════════════════════════════════════════════════════
//  VISTA PREVIA A4
// ══════════════════════════════════════════════════════════════════════

const vistaA4     = document.getElementById('vistaA4');
const vaTitulo    = document.getElementById('vaTitulo');
const vaHoja      = document.getElementById('vaHoja');
const vaCargando  = document.getElementById('vaCargando');
const vaHojas     = document.getElementById('vaHojas');
const vaHojaNum   = document.getElementById('vaHojaNum');
const vaAvisos    = document.getElementById('vaAvisos');
const vaDescargar = document.getElementById('vaDescargar');

const vista = { i: 0, hoja: 0, carta: null, turno: 0 };

async function abrirVista(i) {
  vistaA4.hidden = false;
  document.body.classList.add('con-vista');
  setTimeout(() => document.getElementById('vaCerrar').focus(), 50);
  await mostrarCartaEnVista(i);
}

async function mostrarCartaEnVista(i) {
  const turno = ++vista.turno;
  vista.i = i;
  vista.hoja = 0;
  vista.carta = null;
  const msg = mensajes[i];
  vaTitulo.textContent = `Carta N.º ${String(i + 1).padStart(2, '0')} · ${msg.nombre || 'Alguien que te quiere'}`;
  document.getElementById('vaCartaAnt').disabled = i === 0;
  document.getElementById('vaCartaSig').disabled = i === mensajes.length - 1;
  vaHoja.innerHTML = '';
  vaCargando.hidden = false;
  vaCargando.textContent = 'Armando la carta…';
  vaHojas.hidden = true;
  vaAvisos.hidden = true;
  vaDescargar.disabled = true;

  try {
    const carta = await obtenerCarta(i);
    if (turno !== vista.turno) return;
    vista.carta = carta;
    pintarAvisos(vaAvisos, carta.avisos);
    vaDescargar.disabled = false;
    await pintarHoja();
  } catch (e) {
    if (turno !== vista.turno) return;
    console.error(e);
    vaCargando.textContent = 'No se pudo armar la vista previa. Probá de nuevo.';
  }
}

async function pintarHoja() {
  const c = vista.carta;
  if (!c) return;
  vaHoja.innerHTML = await Cartas.svgDePagina(c.paginas[vista.hoja]);
  vaCargando.hidden = true;
  const n = c.paginas.length;
  vaHojas.hidden = n < 2;
  vaHojaNum.textContent = `Hoja ${vista.hoja + 1} de ${n}`;
  document.getElementById('vaHojaAnt').disabled = vista.hoja === 0;
  document.getElementById('vaHojaSig').disabled = vista.hoja === n - 1;
}

function cerrarVista() {
  if (vistaA4.hidden) return;
  vista.turno++;
  vistaA4.hidden = true;
  document.body.classList.remove('con-vista');
  vaHoja.innerHTML = '';
  // El libro queda en la carta que se estaba mirando
  const destino = bookPages.findIndex(p => p.type === 'message' && p.index === vista.i);
  if (destino > -1 && destino !== currentPage) {
    direccion = destino > currentPage ? 'next' : 'prev';
    currentPage = destino;
    renderCurrentPage();
  }
}

document.getElementById('vaCerrar').addEventListener('click', cerrarVista);
document.getElementById('vaCartaAnt').addEventListener('click', () => { if (vista.i > 0) mostrarCartaEnVista(vista.i - 1); });
document.getElementById('vaCartaSig').addEventListener('click', () => { if (vista.i < mensajes.length - 1) mostrarCartaEnVista(vista.i + 1); });
document.getElementById('vaHojaAnt').addEventListener('click', () => { if (vista.hoja > 0) { vista.hoja--; pintarHoja(); } });
document.getElementById('vaHojaSig').addEventListener('click', () => {
  if (vista.carta && vista.hoja < vista.carta.paginas.length - 1) { vista.hoja++; pintarHoja(); }
});
vaDescargar.addEventListener('click', () => descargarCarta(vista.i, vaDescargar));

vistaA4.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') document.getElementById('vaHojaSig').click();
  if (e.key === 'ArrowLeft')  document.getElementById('vaHojaAnt').click();
});


// ══════════════════════════════════════════════════════════════════════
//  DESCARGAR TODAS (ZIP o PDF completo)
// ══════════════════════════════════════════════════════════════════════

const todasModal      = document.getElementById('todasModal');
const progresoModal   = document.getElementById('progresoModal');
const progresoTitulo  = document.getElementById('progresoTitulo');
const progresoBarra   = document.getElementById('progresoBarra');
const progresoRelleno = document.getElementById('progresoRelleno');
const progresoTexto   = document.getElementById('progresoTexto');
const progresoAvisos  = document.getElementById('progresoAvisos');
const progresoBoton   = document.getElementById('progresoBoton');

let tarea = null;   // { cancelada, terminada }

document.getElementById('btnTodas').addEventListener('click', () => {
  const n = mensajes.length;
  document.getElementById('todasTexto').textContent =
    `${n === 1 ? 'Hay 1 carta' : `Hay ${n} cartas`}. Cada una empieza en una hoja A4 nueva, lista para imprimir al 100 %.`;
  abrirModal(todasModal);
});

todasModal.querySelectorAll('[data-formato]').forEach(b =>
  b.addEventListener('click', () => { cerrarModal(todasModal); descargarTodas(b.dataset.formato); }));

progresoBoton.addEventListener('click', () => {
  if (tarea && !tarea.terminada) {
    tarea.cancelada = true;
    progresoTexto.textContent = 'Cancelando…';
  } else {
    cerrarModal(progresoModal);
  }
});

function progreso(hechas, total, texto) {
  const pct = total ? Math.round(hechas / total * 100) : 0;
  progresoRelleno.style.width = pct + '%';
  progresoBarra.setAttribute('aria-valuenow', pct);
  progresoTexto.textContent = texto;
}

const pausa = () => new Promise(r => setTimeout(r, 0));

function mb(bytes) {
  return (bytes / 1048576).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' MB';
}

async function descargarTodas(formato) {
  const n = mensajes.length;
  if (!n) return;
  tarea = { cancelada: false, terminada: false };
  const yo = tarea;
  const avisos = [];
  const cancelada = () => Object.assign(new Error('cancelada'), { cancelada: true });
  let hojas = 0;

  progresoTitulo.textContent = formato === 'zip' ? 'Armando el ZIP…' : 'Armando el libro completo…';
  progresoAvisos.hidden = true;
  progresoBoton.textContent = 'Cancelar';
  progreso(0, n, 'Preparando…');
  abrirModal(progresoModal, progresoBoton);

  try {
    await Cartas.preparar();
    if (formato === 'zip') await Cartas.cargarScript('vendor/fflate.min.js');

    let ctx = null, zip = null, zipListo = null;
    if (formato === 'pdf') {
      ctx = await Cartas.nuevoPDF('Libro de recuerdos de Cande · 05.12.2026');
    } else {
      const partes = [];
      zipListo = new Promise((ok, mal) => {
        zip = new fflate.Zip((err, datos, final) => {
          if (err) { mal(err); return; }
          partes.push(datos);
          if (final) ok(new Blob(partes, { type: 'application/zip' }));
        });
      });
    }

    for (let i = 0; i < n; i++) {
      if (yo.cancelada) throw cancelada();
      progreso(i, n, `Carta ${i + 1} de ${n}: ${mensajes[i].nombre || 'sin nombre'}`);
      await pausa();

      // Las cartas ya armadas se reutilizan; el resto se arma y se suelta
      const enCache = cacheCartas.has(i);
      const carta = enCache ? await cacheCartas.get(i) : await componerCarta(i);
      carta.avisos.forEach(a => avisos.push(`N.º ${String(i + 1).padStart(2, '0')} · ${carta.nombre}: ${a}`));
      hojas += carta.paginas.length;

      if (ctx) {
        await Cartas.agregarCarta(ctx, carta);
      } else {
        const bytes = await Cartas.pdfDeCarta(carta);
        const archivo = new fflate.ZipPassThrough(carta.archivo);
        zip.add(archivo);
        archivo.push(bytes, true);
      }
      if (!enCache && carta.foto) carta.foto.liberar();
    }

    if (yo.cancelada) throw cancelada();
    progreso(n, n, formato === 'zip' ? 'Cerrando el ZIP…' : 'Guardando el PDF (puede tardar un poco)…');
    await pausa();

    let tamano;
    if (ctx) {
      const bytes = await Cartas.guardar(ctx);
      if (yo.cancelada) throw cancelada();
      tamano = descargarArchivo(bytes, 'Libro_Candela_2026.pdf', 'application/pdf');
    } else {
      zip.end();
      const blob = await zipListo;
      if (yo.cancelada) throw cancelada();
      tamano = descargarArchivo(blob, 'Cartas_Candela_2026.zip', 'application/zip');
    }

    yo.terminada = true;
    progresoTitulo.textContent = '¡Listo!';
    progresoTexto.textContent = formato === 'zip'
      ? `Se descargó Cartas_Candela_2026.zip: ${n === 1 ? '1 carta' : n + ' cartas'} en PDF (${mb(tamano)}).`
      : `Se descargó Libro_Candela_2026.pdf: ${n === 1 ? '1 carta' : n + ' cartas'}, ${hojas} hojas A4 (${mb(tamano)}).`;
    if (avisos.length) {
      progresoTexto.textContent += ' Antes de imprimir, revisá estos avisos:';
      pintarAvisos(progresoAvisos, avisos);
    }
    progresoBoton.textContent = 'Cerrar';
  } catch (e) {
    yo.terminada = true;
    if (e.cancelada || e.status === 401) { cerrarModal(progresoModal); return; }
    console.error(e);
    progresoTitulo.textContent = 'No se pudo terminar';
    progresoTexto.textContent = 'Algo falló mientras se armaban las cartas. Probá de nuevo; si vuelve a pasar, descargalas de a una.';
    progresoBoton.textContent = 'Cerrar';
  }
}


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
      mensaje: 'Este es un mensaje de ejemplo para ver cómo queda una página con foto.\n\nAcá va a aparecer, completo y con sus saltos de línea, lo que cada persona le escriba a Cande.',
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

verificarSesion();
