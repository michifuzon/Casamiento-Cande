/* ══════════════════════════════════════════════════════════════════════
   decor.js — compartido por index.html y libro.html
   · Ilustraciones SVG con acabado de pintura (corazón, flor, moño…)
   · Detecta si la foto de portada cargó (agrega .con-foto a <html>)
   Se carga como PRIMER script dentro de <body>.
   ══════════════════════════════════════════════════════════════════════ */

(function () {

  const SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"
     style="position:absolute;width:0;height:0;overflow:hidden">
  <defs>

    <!-- Acabado "pintado a mano": bordes irregulares + pigmento disparejo -->
    <filter id="pintado" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="ondas"/>
      <feDisplacementMap in="SourceGraphic" in2="ondas" scale="6" xChannelSelector="R" yChannelSelector="G" result="borde"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.06 0.012" numOctaves="3" seed="11" result="veta"/>
      <feColorMatrix in="veta" type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -.55 1.2" result="vetaAlfa"/>
      <feComposite in="borde" in2="vetaAlfa" operator="in"/>
    </filter>

    <!-- Moño -->
    <symbol id="i-lazo" viewBox="0 0 200 170">
      <g filter="url(#pintado)">
        <path fill="currentColor" d="M93 72 C86 98 72 128 52 160 L68 153 L77 167 C92 136 101 106 106 76 Z"/>
        <path fill="currentColor" d="M107 72 C114 98 128 128 148 160 L132 153 L123 167 C108 136 99 106 94 76 Z"/>
        <path fill="currentColor" d="M100 62 C86 38 58 12 30 16 C8 19 2 50 16 70 C30 90 68 84 100 62 Z"/>
        <path fill="currentColor" d="M100 62 C114 38 142 12 170 16 C192 19 198 50 184 70 C170 90 132 84 100 62 Z"/>
        <path fill="#000" opacity=".22" d="M100 62 C78 50 46 46 22 56 C36 72 72 74 100 62 Z"/>
        <path fill="#000" opacity=".22" d="M100 62 C122 50 154 46 178 56 C164 72 128 74 100 62 Z"/>
        <rect x="87" y="48" width="26" height="28" rx="10" fill="currentColor"/>
        <rect x="87" y="48" width="26" height="28" rx="10" fill="#000" opacity=".18"/>
      </g>
    </symbol>

    <!-- Corazón pintado -->
    <symbol id="i-corazon-pintado" viewBox="0 0 200 184">
      <g filter="url(#pintado)">
        <path fill="#741D35" d="M100 176s-62-38-83-77C3 72 15 39 47 33c19-3 36 6 53 22 17-16 34-25 53-22 32 6 44 39 30 66-21 39-83 77-83 77z"/>
        <path fill="#501625" opacity=".55" d="M100 176s-62-38-83-77c-6-12-8-24-6-35 8 22 34 52 89 82 55-30 81-60 89-82 2 11 0 23-6 35-21 39-83 77-83 77z"/>
        <path fill="#A44A66" opacity=".55" d="M44 50c14-4 28 2 38 12-12-4-26-4-38 6-8 6-12 2 0-18z"/>
      </g>
    </symbol>

    <!-- Flor azul con centro oliva -->
    <symbol id="i-flor-azul" viewBox="0 0 200 200">
      <g filter="url(#pintado)">
        <g fill="#527F98">
          <ellipse cx="100" cy="52" rx="26" ry="42"/>
          <ellipse cx="100" cy="52" rx="26" ry="42" transform="rotate(60 100 100)"/>
          <ellipse cx="100" cy="52" rx="26" ry="42" transform="rotate(120 100 100)"/>
          <ellipse cx="100" cy="52" rx="26" ry="42" transform="rotate(180 100 100)"/>
          <ellipse cx="100" cy="52" rx="26" ry="42" transform="rotate(240 100 100)"/>
          <ellipse cx="100" cy="52" rx="26" ry="42" transform="rotate(300 100 100)"/>
        </g>
        <g fill="#3E6880" opacity=".55">
          <ellipse cx="100" cy="70" rx="9" ry="26"/>
          <ellipse cx="100" cy="70" rx="9" ry="26" transform="rotate(60 100 100)"/>
          <ellipse cx="100" cy="70" rx="9" ry="26" transform="rotate(120 100 100)"/>
          <ellipse cx="100" cy="70" rx="9" ry="26" transform="rotate(180 100 100)"/>
          <ellipse cx="100" cy="70" rx="9" ry="26" transform="rotate(240 100 100)"/>
          <ellipse cx="100" cy="70" rx="9" ry="26" transform="rotate(300 100 100)"/>
        </g>
        <circle cx="100" cy="100" r="22" fill="#69754D"/>
        <circle cx="94" cy="94" r="7" fill="#A2AD91" opacity=".8"/>
      </g>
    </symbol>

    <!-- Ramita oliva pintada -->
    <symbol id="i-ramita-pintada" viewBox="0 0 120 220">
      <g filter="url(#pintado)">
        <path d="M60 214 C58 160 56 100 66 12" fill="none" stroke="#69754D" stroke-width="5" stroke-linecap="round"/>
        <g fill="#69754D">
          <ellipse cx="40" cy="178" rx="22" ry="10" transform="rotate(-32 40 178)"/>
          <ellipse cx="80" cy="150" rx="22" ry="10" transform="rotate(30 80 150)"/>
          <ellipse cx="38" cy="122" rx="20" ry="9.5" transform="rotate(-36 38 122)"/>
          <ellipse cx="82" cy="96" rx="19" ry="9" transform="rotate(32 82 96)"/>
          <ellipse cx="44" cy="70" rx="17" ry="8" transform="rotate(-38 44 70)"/>
          <ellipse cx="82" cy="44" rx="15" ry="7.5" transform="rotate(35 82 44)"/>
        </g>
        <g fill="#A2AD91" opacity=".7">
          <ellipse cx="44" cy="174" rx="12" ry="4" transform="rotate(-32 44 174)"/>
          <ellipse cx="76" cy="146" rx="12" ry="4" transform="rotate(30 76 146)"/>
          <ellipse cx="42" cy="118" rx="11" ry="4" transform="rotate(-36 42 118)"/>
        </g>
      </g>
    </symbol>

    <!-- Cámara (ícono de interfaz, sin acabado pintado) -->
    <symbol id="i-camara" viewBox="0 0 24 24">
      <path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"
            d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
      <circle cx="12" cy="13.2" r="3.6" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </symbol>

  </defs>
</svg>`;

  document.body.insertAdjacentHTML('afterbegin', SPRITE);


  // ── STICKERS DEL FONDO ──────────────────────────────────────────────
  // Moños, flores, corazones y ramitas que asoman por detrás del libro.
  const STICKER = {
    lazo:    ['i-lazo',             '0 0 200 170'],
    flor:    ['i-flor-azul',        '0 0 200 200'],
    corazon: ['i-corazon-pintado',  '0 0 200 184'],
    ramita:  ['i-ramita-pintada',   '0 0 120 220']
  };

  const FONDO = ['flor', 'lazo', 'corazon', 'ramita', 'flor', 'lazo', 'corazon', 'flor', 'ramita', 'lazo'];

  const fondo = document.createElement('div');
  fondo.className = 'fondo-stickers';
  fondo.setAttribute('aria-hidden', 'true');
  fondo.innerHTML = FONDO.map((tipo, i) => {
    const [id, vb] = STICKER[tipo];
    return `<span class="sticker fs fs-${i + 1} st-${tipo}"><svg viewBox="${vb}"><use href="#${id}"/></svg></span>`;
  }).join('');
  document.body.insertAdjacentElement('afterbegin', fondo);


  // ── ¿CARGÓ LA FOTO DE PORTADA? ──────────────────────────────────────
  // Lee la URL de --foto-cande (portada.css). Si la imagen carga, oculta
  // el monograma de respaldo; si no existe, queda el monograma.
  const raw   = getComputedStyle(document.documentElement).getPropertyValue('--foto-cande');
  const match = raw && raw.match(/url\(\s*(['"]?)(.*?)\1\s*\)/);
  if (match && match[2]) {
    const img = new Image();
    img.onload = () => document.documentElement.classList.add('con-foto');
    img.src = match[2];
  }

}());
