/* ══════════════════════════════════════════════════════════════════════
   index.js — página de participación
   Libro 3D, formulario (Netlify Forms), foto, modales y festejo.
   ══════════════════════════════════════════════════════════════════════ */

// ── DOM ───────────────────────────────────────────────────────────────
const book        = document.getElementById('book');
const cover       = document.getElementById('bookCover');
const clickText   = document.getElementById('clickText');
const scene       = document.querySelector('.scene');
const bookContent = document.querySelector('.book-content');
const bookClose   = document.getElementById('bookClose');

const form        = document.getElementById('guestForm');
const submitBtn   = form.querySelector('.btn-submit');
const nombreInput = document.getElementById('nombre');
const textarea    = document.getElementById('mensaje');
const charCount   = document.getElementById('charCount');
const fotoInput   = document.getElementById('fotoInput');
const uploadArea  = document.getElementById('uploadArea');
const uploadLabel = document.getElementById('uploadLabel');
const previewImg  = document.getElementById('preview-img');
const fotoQuitar  = document.getElementById('fotoQuitar');

const thanksModal = document.getElementById('thanksModal');
const thanksIcon  = document.getElementById('thanksIcon');
const thanksTitle = document.getElementById('thanksTitle');
const thanksText  = document.getElementById('thanksText');
const closeThanks = document.getElementById('closeThanks');

const infoBtn     = document.getElementById('infoBtn');
const infoModal   = document.getElementById('infoModal');
const infoClose   = document.getElementById('infoClose');
const infoOpen    = document.getElementById('infoOpen');

const TEXTO_BOTON  = 'Enviar mi mensaje';
const TEXTO_UPLOAD = 'Sumá una foto con Cande';
const ICONO_LAZO   = '<svg viewBox="0 0 200 170"><use href="#i-lazo"/></svg>';

const esMovil = () => window.innerWidth <= 900;

let isSending  = false;
let modoPopup  = null;   // 'validacion' | 'exito' | 'error'
let previewURL = null;

// El formulario no es navegable mientras la tapa está cerrada
bookContent.setAttribute('inert', '');


// ══════════════════════════════════════════════════════════════════════
//  LIBRO: ABRIR / CERRAR
// ══════════════════════════════════════════════════════════════════════

function abrirLibro() {
  if (book.classList.contains('open')) return;

  book.style.transform = '';
  book.classList.add('open');
  clickText.classList.add('hidden');
  bookContent.removeAttribute('inert');

  const baseDelay = esMovil() ? 0.75 : 1.45;
  document
    .querySelectorAll('.form-section .top-title, .form-section .postit, .form-section .field-group, .form-section .btn-submit')
    .forEach((el, i) => { el.style.transitionDelay = `${baseDelay + i * 0.11}s`; });

  book.classList.add('fields-ready');
  document.getElementById('perritaWrap')?.classList.add('peeking');
}

function cerrarLibro() {
  document
    .querySelectorAll('.form-section .top-title, .form-section .postit, .form-section .field-group, .form-section .btn-submit')
    .forEach(el => { el.style.transitionDelay = '0s'; });

  book.classList.remove('open', 'fields-ready');
  bookContent.setAttribute('inert', '');
  clickText.classList.remove('hidden');
  if (document.activeElement && bookContent.contains(document.activeElement)) {
    document.activeElement.blur();
  }
}

cover.addEventListener('click', abrirLibro);
cover.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirLibro(); }
});

// Apertura inmediata por toque (sin demora en iOS/Android)
[cover, clickText].forEach(el => {
  el.addEventListener('touchstart', e => { e.preventDefault(); abrirLibro(); }, { passive: false });
});
clickText.addEventListener('click', abrirLibro);

bookClose.addEventListener('click', cerrarLibro);


// ══════════════════════════════════════════════════════════════════════
//  INCLINACIÓN 3D (solo escritorio, con el libro cerrado)
// ══════════════════════════════════════════════════════════════════════

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
//  ETIQUETAS FLOTANTES, AUTO-ALTO Y CONTADOR
// ══════════════════════════════════════════════════════════════════════

document.querySelectorAll('.field-float').forEach(wrap => {
  const el = wrap.querySelector('input, textarea');
  if (!el) return;
  const sync = () => wrap.classList.toggle('filled', el.value.trim().length > 0);
  el.addEventListener('focus', () => wrap.classList.add('focused'));
  el.addEventListener('blur',  () => { wrap.classList.remove('focused'); sync(); });
  el.addEventListener('input', sync);
  sync();
});

function ajustarTextarea() {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
  charCount.textContent = textarea.value.length.toLocaleString('es-AR');
}

textarea.addEventListener('input', ajustarTextarea);

nombreInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); textarea.focus(); }
});


// ══════════════════════════════════════════════════════════════════════
//  FOTO: PREVIEW, ARRASTRAR Y QUITAR
// ══════════════════════════════════════════════════════════════════════

// ¿Es una imagen? Algunos celulares/PC no informan el tipo de las HEIC.
function esImagen(file) {
  if (file.type) return file.type.startsWith('image/');
  return /.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(file.name || '');
}

const PESO_MAXIMO = 7.5 * 1024 * 1024;   // Netlify Forms acepta hasta ~8 MB por envío

function mostrarPreview() {
  const file = fotoInput.files && fotoInput.files[0];
  if (!file) { quitarFoto(); return; }

  if (!esImagen(file)) {
    quitarFoto();
    mostrarPopup('validacion', {
      texto:  '!',
      titulo: 'Ese archivo no es una foto',
      cuerpo: 'Elegí una imagen de tu galería (JPG, PNG o HEIC).'
    });
    return;
  }

  if (previewURL) URL.revokeObjectURL(previewURL);
  previewURL = URL.createObjectURL(file);
  previewImg.src = previewURL;
  uploadArea.classList.add('has-file');
  uploadLabel.textContent = file.name || 'Foto elegida';
}

function quitarFoto() {
  fotoInput.value = '';
  if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = null; }
  previewImg.removeAttribute('src');
  uploadArea.classList.remove('has-file');
  uploadLabel.textContent = TEXTO_UPLOAD;
}

fotoInput.addEventListener('change', mostrarPreview);

fotoQuitar.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  quitarFoto();
});

['dragenter', 'dragover'].forEach(ev =>
  uploadArea.addEventListener(ev, e => { e.preventDefault(); uploadArea.classList.add('drag-over'); })
);
['dragleave', 'drop'].forEach(ev =>
  uploadArea.addEventListener(ev, e => { e.preventDefault(); uploadArea.classList.remove('drag-over'); })
);
uploadArea.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    fotoInput.files = dt.files;
    mostrarPreview();
  }
});

/**
 * Las fotos de celular suelen pesar 4–12 MB y Netlify Forms acepta hasta
 * ~8 MB por envío. Si la foto es pesada, se achica a 2000 px (JPEG) antes
 * de mandarla. Si el navegador no puede procesarla, se envía la original.
 */
async function prepararFoto(file) {
  const LIMITE = 3.5 * 1024 * 1024;
  if (!file || file.size <= LIMITE) return file;

  try {
    let fuente;
    if ('createImageBitmap' in window) {
      fuente = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } else {
      fuente = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    }

    const MAX   = 2000;
    const escala = Math.min(1, MAX / Math.max(fuente.width, fuente.height));
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(fuente.width  * escala);
    canvas.height = Math.round(fuente.height * escala);
    canvas.getContext('2d').drawImage(fuente, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.86));
    if (!blob || blob.size >= file.size) return file;

    const nombre = (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg' });
  } catch (err) {
    return file;
  }
}


// ══════════════════════════════════════════════════════════════════════
//  ENVÍO
// ══════════════════════════════════════════════════════════════════════

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (isSending) return;

  const nombreVal  = nombreInput.value.trim();
  const mensajeVal = textarea.value.trim();

  if (!nombreVal || !mensajeVal) {
    mostrarPopup('validacion', {
      texto:  '✎',
      titulo: 'Te faltó algo',
      cuerpo: !nombreVal && !mensajeVal
        ? 'Completá tu nombre y tu mensaje para Cande.'
        : !nombreVal ? 'Contanos quién sos: falta tu nombre.' : 'Falta lo más lindo: tu mensaje para Cande.'
    });
    return;
  }

  isSending = true;
  submitBtn.disabled = true;
  submitBtn.classList.add('sending');
  submitBtn.textContent = 'Enviando tu mensaje…';

  try {
    const datos = new FormData(form);
    const foto  = fotoInput.files && fotoInput.files[0];
    if (foto) {
      const lista = await prepararFoto(foto);
      if (lista.size > PESO_MAXIMO) {
        mostrarPopup('validacion', {
          texto:  '!',
          titulo: 'La foto es muy pesada',
          cuerpo: 'Probá con otra foto o mandá el mensaje sin foto. Lo que escribiste no se perdió.'
        });
        submitBtn.disabled = false;
        submitBtn.classList.remove('sending');
        submitBtn.textContent = TEXTO_BOTON;
        isSending = false;
        return;
      }
      datos.set('foto', lista, lista.name);
    }

    const res = await fetch('/', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: datos
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    cerrarLibro();
    setTimeout(() => {
      mostrarPopup('exito', {
        icono:  ICONO_LAZO,
        titulo: '¡Tu mensaje ya es parte de su historia!',
        cuerpo: 'Gracias por dejarle un recuerdo tan especial a Cande. Tu mensaje quedó guardado para sorprenderla.'
      });
      lanzarFestejo();
    }, esMovil() ? 650 : 950);

  } catch (err) {
    console.error(err);
    // Se conserva todo lo escrito para poder reintentar
    mostrarPopup('error', {
      texto:  '!',
      titulo: 'No se pudo enviar',
      cuerpo: 'Tu mensaje sigue acá, no se perdió nada. Revisá la conexión y probá de nuevo en un ratito.'
    });
    submitBtn.disabled = false;
    submitBtn.classList.remove('sending');
    submitBtn.textContent = TEXTO_BOTON;
  } finally {
    isSending = false;
  }
});


// ══════════════════════════════════════════════════════════════════════
//  POPUP (gracias / validación / error)
// ══════════════════════════════════════════════════════════════════════

function mostrarPopup(modo, { icono, texto, titulo, cuerpo }) {
  modoPopup = modo;
  thanksIcon.classList.toggle('es-texto', !icono);
  thanksIcon.innerHTML = icono || '';
  if (!icono) thanksIcon.textContent = texto || '';
  thanksTitle.textContent = titulo;
  thanksText.textContent  = cuerpo;
  closeThanks.textContent = modo === 'exito' ? 'Cerrar' : 'Volver al mensaje';

  // reinicia la animación del ícono
  thanksIcon.style.animation = 'none';
  void thanksIcon.offsetWidth;
  thanksIcon.style.animation = '';

  thanksModal.classList.add('show');
  fondoInerte(true);
  setTimeout(() => closeThanks.focus({ preventScroll: true }), 350);
}

function cerrarPopup() {
  thanksModal.classList.remove('show');
  fondoInerte(false);
  if (modoPopup === 'exito') {
    reiniciarFormulario();
  } else if (!book.classList.contains('open')) {
    abrirLibro();
  }
  modoPopup = null;
}

function reiniciarFormulario() {
  form.reset();
  quitarFoto();
  textarea.style.height = '';
  charCount.textContent = '0';
  submitBtn.disabled = false;
  submitBtn.classList.remove('sending');
  submitBtn.textContent = TEXTO_BOTON;
  document.querySelectorAll('.field-float').forEach(w => w.classList.remove('filled', 'focused'));
  document.querySelector('.page').scrollTop = 0;
  clickText.classList.remove('hidden');
  document.getElementById('perritaWrap')?.classList.remove('peeking');
}

// ══════════════════════════════════════════════════════════════════════
//  PERRITA QUE ESPÍA — misma lógica que el "peek" del proyecto anterior:
//  sube, se sacude y vuelve a bajar despacio.
// ══════════════════════════════════════════════════════════════════════

(function () {
  const wrap = document.getElementById('perritaWrap');
  const peek = wrap?.querySelector('.perrita-peek');
  if (!wrap || !peek) return;

  // Cuánto sube: casi entera (12%) si entra debajo del libro; si no, lo justo
  // para no tapar campos ni botones.
  function calcularAsomo() {
    const alto  = peek.offsetHeight;
    if (!alto) return;
    const libro  = book.getBoundingClientRect();
    const campos = form.querySelector('.form-fields').getBoundingClientRect();
    const izq    = wrap.getBoundingClientRect().left;
    // ¿La perrita quedaría debajo de la columna de campos?
    const solapa = campos.left < izq + peek.offsetWidth && campos.right > izq;
    const lugar  = solapa ? window.innerHeight - libro.bottom - 6 : alto;
    const pct    = Math.min(60, Math.max(12, (1 - lugar / alto) * 100));   // 12%: el borde del recorte queda escondido
    wrap.style.setProperty('--asomo', pct.toFixed(1) + '%');
  }

  if (peek.complete) calcularAsomo();
  peek.addEventListener('load', calcularAsomo);
  window.addEventListener('resize', calcularAsomo);

  let seq            = 0;      // contador de secuencia — cancela callbacks huérfanos
  let descendHandler = null;   // referencia al transitionend de bajada activo

  function cancelarSecuencia() {
    seq++;
    wrap.style.transition = '';
    wrap.classList.remove('peeking');
    peek.classList.remove('angry');
    if (descendHandler) {
      wrap.removeEventListener('transitionend', descendHandler);
      descendHandler = null;
    }
  }

  peek.addEventListener('click', () => {
    if (peek.classList.contains('angry')) return;

    cancelarSecuencia();
    const currentSeq = seq;

    // Posición actual del wrapper
    const matrix = new DOMMatrix(window.getComputedStyle(wrap).transform);
    const pct    = (matrix.m42 / wrap.offsetHeight) * 100;
    wrap.style.transform = `translateY(${pct.toFixed(1)}%)`;

    calcularAsomo();
    const angryPos = 'translateY(var(--asomo))';

    // Subir hasta la posición de sacudida
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (seq !== currentSeq) return;
      wrap.style.transition = 'transform 0.7s ease-out';
      wrap.style.transform  = angryPos;
    }));

    // Sacudirse cuando termina la subida
    setTimeout(() => {
      if (seq !== currentSeq) return;
      wrap.style.transition = '';
      peek.classList.add('angry');

      peek.addEventListener('animationend', () => {
        if (seq !== currentSeq) return;
        peek.classList.remove('angry');

        // Bajar despacio
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (seq !== currentSeq) return;
          wrap.style.transition = 'transform 3.5s ease-in-out';
          wrap.style.transform  = 'translateY(110%)';
        }));

        descendHandler = function () {
          wrap.removeEventListener('transitionend', descendHandler);
          descendHandler = null;
          if (seq !== currentSeq) return;
          wrap.style.transition = '';
          wrap.style.transform  = '';
          wrap.classList.add('peeking');
        };
        wrap.addEventListener('transitionend', descendHandler);

      }, { once: true });
    }, 750); // espera los 700 ms de la subida + margen
  });
}());

closeThanks.addEventListener('click', cerrarPopup);
thanksModal.addEventListener('click', e => { if (e.target === thanksModal) cerrarPopup(); });


// ══════════════════════════════════════════════════════════════════════
//  MODAL DE INFORMACIÓN
// ══════════════════════════════════════════════════════════════════════

let infoPrimeraVez = true;

// Con un modal abierto, el resto de la página no recibe foco ni clics
let focoPrevio = null;

function fondoInerte(si) {
  [scene, infoBtn, document.getElementById('perritaWrap')].forEach(el => {
    if (!el) return;
    if (si) el.setAttribute('inert', ''); else el.removeAttribute('inert');
  });
}

function abrirInfo() {
  focoPrevio = document.activeElement;
  infoModal.classList.add('show');
  scene.classList.add('behind-modal');
  fondoInerte(true);
  setTimeout(() => infoOpen.focus({ preventScroll: true }), 350);   // tras la transición (visibility)
}

function cerrarInfo() {
  infoModal.classList.remove('show');
  scene.classList.remove('behind-modal');
  fondoInerte(false);
  if (focoPrevio && focoPrevio !== document.body && document.contains(focoPrevio)) focoPrevio.focus({ preventScroll: true });
  else cover.focus({ preventScroll: true });
  if (infoPrimeraVez) {
    infoPrimeraVez = false;
    scene.classList.add('visible');
  }
}

infoBtn.addEventListener('click', abrirInfo);
infoClose.addEventListener('click', cerrarInfo);

infoOpen.addEventListener('click', () => {
  cerrarInfo();
  setTimeout(abrirLibro, 320);
});

infoModal.addEventListener('click', e => {
  if (e.target === infoModal) {
    cerrarInfo();
    if (!esMovil()) setTimeout(abrirLibro, 320);
  }
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (thanksModal.classList.contains('show')) cerrarPopup();
  else if (infoModal.classList.contains('show')) cerrarInfo();
});

window.addEventListener('DOMContentLoaded', () => setTimeout(abrirInfo, 200));


// ══════════════════════════════════════════════════════════════════════
//  FESTEJO: confeti + lluvia de moños, corazones y flores
// ══════════════════════════════════════════════════════════════════════

function lanzarFestejo() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const COLORES = ['#741D35', '#501625', '#FAF8F4', '#A2AD91', '#69754D', '#527F98'];
  const cantidad = esMovil() ? 55 : 90;

  for (let i = 0; i < cantidad; i++) {
    const el   = document.createElement('div');
    const size = 4 + Math.random() * 8;
    el.className = 'confetti-piece';
    el.style.cssText = [
      `left:${Math.random() * 100}vw`,
      `width:${size}px`,
      `height:${Math.random() > 0.5 ? size : size * 0.45}px`,
      `background:${COLORES[i % COLORES.length]}`,
      `border-radius:${Math.random() > 0.5 ? '50%' : '2px'}`,
      `animation-duration:${1.3 + Math.random() * 1.8}s`,
      `animation-delay:${Math.random() * 0.7}s`
    ].join(';');
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  const ADORNOS = [
    ['i-lazo', '#741D35', 170 / 200], ['i-corazon-pintado', '', 184 / 200],
    ['i-flor-azul', '', 1], ['i-lazo', '#69754D', 170 / 200],
    ['i-lazo', '#501625', 170 / 200], ['i-corazon-pintado', '', 184 / 200]
  ];

  for (let i = 0; i < (esMovil() ? 16 : 26); i++) {
    const [icono, color, ratio] = ADORNOS[i % ADORNOS.length];
    const ancho = 18 + Math.random() * 22;
    const el = document.createElement('div');
    el.className = 'lluvia-pieza';
    el.style.cssText = [
      `left:${Math.random() * 96}vw`,
      `width:${ancho}px`,
      `height:${ancho * ratio}px`,
      `color:${color}`,
      `--centro:#7D1631`,
      `animation-duration:${2.6 + Math.random() * 2}s`,
      `animation-delay:${Math.random() * 1.2}s`
    ].join(';');
    el.innerHTML = `<svg><use href="#${icono}"/></svg>`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}
