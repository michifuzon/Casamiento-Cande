/* ══════════════════════════════════════════════════════════════════════
   cartas.js — cartas A4 para imprimir (solo se usa en libro.html)

   Cada mensaje se COMPONE una sola vez en milímetros (componer) y esa
   misma composición se dibuja:
     · en la vista previa, como SVG (svgDePagina), y
     · en el PDF, con texto vectorial y tipografías incrustadas (agregarCarta).
   Así la vista previa y el PDF son idénticos.

   Librerías (en /vendor, se cargan solo cuando hacen falta):
     · pdf-lib 1.17.1 + @pdf-lib/fontkit 1.1.1 → PDF con texto real
       (seleccionable) e incrustación/subconjunto de fuentes TTF.
     · fflate 0.8.2 → ZIP (lo usa libro.js).
   ══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const PT = 25.4 / 72;          // mm por punto
  const K  = 72 / 25.4;          // puntos por mm
  const HOJA = { w: 210, h: 297 };

  const COLOR = {
    bordo: '#741D35',
    oliva: '#69754D',
    tinta: '#3A2A2F',
    marco: '#FCFAF6',
    filete: '#E0D7CA',
    sombra: '#501625'
  };

  const FUENTES = {
    cuerpo:   { archivo: 'assets/fuentes/cormorant-500.ttf', familia: 'CartaCuerpo' },
    nombre:   { archivo: 'assets/fuentes/pinyon-script.ttf', familia: 'CartaNombre' },
    etiqueta: { archivo: 'assets/fuentes/dmsans-500.ttf',    familia: 'CartaEtiqueta' }
  };

  const STICKERS = {
    flor:    'assets/carta/flor.png',
    ramita:  'assets/carta/ramita.png',
    lazo:    'assets/carta/lazo.png',
    corazon: 'assets/carta/corazon.png'
  };

  // ── Diseño (mm, salvo tamaños de letra en pt) ──
  const D = {
    areaY0: 32,            // dónde empieza el contenido
    areaY1: 271,           // dónde termina (margen inferior + pie)
    columna: 136,          // ancho de la columna de texto
    cuerpo:   { size: 12, avance: 18.6 },   // 12 pt, interlineado 1,55
    blanco:   0.55,        // línea en blanco = 55 % de un renglón
    nombre:   { size: 28, minimo: 21 },
    etiqueta: { size: 7.5, track: 1.5 },
    pie:      { size: 6.5, track: 1.2, y: 284 },
    foto: {
      maxAncho: 128, maxAlto: 120, minAlto: 62, altoLargo: 100,
      borde: 3.2, bordeInf: 9, separacion: 10
    },
    dpiMinimo: 150
  };

  const VERSION_DATOS = 1;

  // Sin ligaduras ni alternativas contextuales (fi, fl, Qu…): pdf-lib las espacia mal. Se usan igual en la
  // medición, en el PDF y en la vista previa.
  const RASGOS = { liga: false, clig: false, dlig: false, calt: false };


  // ══════════════════════════════════════════════════════════════════
  //  RECURSOS
  // ══════════════════════════════════════════════════════════════════

  const scripts = {};
  function cargarScript(src) {
    if (!scripts[src]) {
      scripts[src] = new Promise((ok, mal) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = ok;
        s.onerror = () => { delete scripts[src]; mal(new Error('No se pudo cargar ' + src)); };
        document.head.appendChild(s);
      });
    }
    return scripts[src];
  }

  async function bytesDe(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('No se pudo cargar ' + url);
    return new Uint8Array(await r.arrayBuffer());
  }

  let recursos = null;

  function preparar() {
    if (!recursos) {
      recursos = (async () => {
        await Promise.all([cargarScript('vendor/pdf-lib.min.js'), cargarScript('vendor/fontkit.umd.min.js')]);

        const fuentes = {};
        await Promise.all(Object.entries(FUENTES).map(async ([clave, f]) => {
          const bytes = await bytesDe(f.archivo);
          fuentes[clave] = { clave, bytes, fk: window.fontkit.create(bytes), familia: f.familia };
        }));

        const stickers = {};
        await Promise.all(Object.entries(STICKERS).map(async ([clave, url]) => {
          const bytes = await bytesDe(url);
          const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          stickers[clave] = { clave: 'st-' + clave, bytes, tipo: 'png', w: bmp.width, h: bmp.height, url };
          bmp.close && bmp.close();
        }));

        // La vista previa usa los MISMOS archivos de fuente que el PDF
        const css = Object.values(FUENTES).map(f =>
          `@font-face{font-family:"${f.familia}";src:url("${f.archivo}") format("truetype");font-display:block;}`).join('');
        const st = document.createElement('style');
        st.textContent = css;
        document.head.appendChild(st);
        await Promise.all(Object.values(FUENTES).map(f => document.fonts.load(`20px "${f.familia}"`)));

        return { fuentes, stickers };
      })().catch(e => { recursos = null; throw e; });
    }
    return recursos;
  }


  // ══════════════════════════════════════════════════════════════════
  //  MEDICIÓN DE TEXTO (mismas métricas que usa pdf-lib)
  // ══════════════════════════════════════════════════════════════════

  const medidas = new Map();

  function anchoTexto(f, texto, size, track = 0) {
    const clave = f.clave + '|' + size + '|' + track + '|' + texto;
    let u = medidas.get(clave);
    if (u === undefined) {
      const { glyphs } = f.fk.layout(texto, RASGOS);
      let suma = 0;
      for (const g of glyphs) suma += g.advanceWidth;
      u = (suma / f.fk.unitsPerEm) * size + track * glyphs.length;
      if (medidas.size > 20000) medidas.clear();
      medidas.set(clave, u);
    }
    return u * PT;   // mm
  }

  function tieneGlifos(f, codigos) {
    return codigos.every(cp => f.fk.hasGlyphForCodePoint(cp));
  }

  const segmentador = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter('es', { granularity: 'grapheme' })
    : null;

  function grafemas(texto) {
    return segmentador ? Array.from(segmentador.segment(texto), s => s.segment) : Array.from(texto);
  }

  const RE_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;
  const RE_INVISIBLES = /[︀-️​-‍⁠﻿]/g;

  // Emojis y caracteres que no existen en las fuentes: se dibujan como
  // imagen en alta resolución con la fuente del sistema (iguales en la
  // vista previa y en el PDF).
  const glifos = new Map();

  function glifoImagen(g, color) {
    const clave = g + '|' + color;
    if (glifos.has(clave)) return glifos.get(clave);
    const S = 160;
    const fuente = `${Math.round(S * 0.84)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol","Segoe UI",system-ui,sans-serif`;
    const c = document.createElement('canvas');
    let ctx = c.getContext('2d');
    ctx.font = fuente;
    const ancho = Math.max(Math.round(S * 0.4), Math.ceil(ctx.measureText(g).width + S * 0.1));
    c.width = ancho;
    c.height = S;
    ctx = c.getContext('2d');
    ctx.font = fuente;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.fillText(g, S * 0.05, S * 0.8);
    const url = c.toDataURL('image/png');
    const bin = atob(url.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const res = { clave: 'g-' + clave, bytes, tipo: 'png', url, anchoEm: ancho / S, ascEm: 0.8 };
    glifos.set(clave, res);
    return res;
  }

  /** Divide un texto en tramos con la fuente que puede dibujarlos. */
  function tramos(texto, principal, R, color) {
    const out = [];
    for (const g of grafemas(texto)) {
      const cps = Array.from(g, c => c.codePointAt(0));
      const visibles = Array.from(g.replace(RE_INVISIBLES, ''), c => c.codePointAt(0));
      if (!visibles.length) continue;

      let fuente;
      const emoji = RE_EMOJI.test(g);
      if (emoji && (cps.length > 1 || !tieneGlifos(R.fuentes[principal], visibles))) fuente = null;
      else if (tieneGlifos(R.fuentes[principal], visibles)) fuente = principal;
      else if (tieneGlifos(R.fuentes.cuerpo, visibles)) fuente = 'cuerpo';
      else if (tieneGlifos(R.fuentes.etiqueta, visibles)) fuente = 'etiqueta';
      else fuente = null;

      const ultimo = out[out.length - 1];
      if (fuente) {
        const limpio = g.replace(RE_INVISIBLES, '');
        if (ultimo && ultimo.fuente === fuente) ultimo.texto += limpio;
        else out.push({ fuente, texto: limpio });
      } else {
        out.push({ glifo: glifoImagen(g, color) });
      }
    }
    return out;
  }

  function anchoTramos(lista, R, size, track = 0) {
    let w = 0;
    for (const t of lista) {
      w += t.glifo ? t.glifo.anchoEm * size * PT : anchoTexto(R.fuentes[t.fuente], t.texto, size, track);
    }
    return w;
  }

  /** Elementos de dibujo para una línea ya armada, con su línea base en y. */
  function dibujarLinea(lista, x, y, size, color, R, track = 0) {
    const els = [];
    for (const t of lista) {
      if (t.glifo) {
        const em = size * PT;
        const w = t.glifo.anchoEm * em;
        els.push({ t: 'img', ref: t.glifo, x, y: y - t.glifo.ascEm * em, w, h: em });
        x += w;
      } else {
        els.push({ t: 'texto', f: t.fuente, x, y, size, color, texto: t.texto, track });
        x += anchoTexto(R.fuentes[t.fuente], t.texto, size, track);
      }
    }
    return els;
  }


  // ══════════════════════════════════════════════════════════════════
  //  CORTE EN LÍNEAS (sin cortar palabras)
  // ══════════════════════════════════════════════════════════════════

  function normalizar(texto) {
    return String(texto || '')
      .normalize('NFC')
      .replace(/\r\n?/g, '\n')
      .replace(/[\t ]/g, ' ')
      .replace(/[^\S\n]+/g, ' ')
      .split('\n').map(l => l.trim()).join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Corta el texto en líneas que entran en "ancho". Respeta los saltos de línea. */
  function lineasDeTexto(texto, principal, size, ancho, R, color, track = 0) {
    const lineas = [];
    const renglones = normalizar(texto).split('\n');
    const espacio = anchoTexto(R.fuentes[principal], ' ', size, track);

    renglones.forEach((renglon, r) => {
      if (!renglon) { lineas.push({ blanco: true, renglon: r }); return; }

      const palabras = [];
      for (const p of renglon.split(' ')) {
        const w = anchoTramos(tramos(p, principal, R, color), R, size, track);
        if (w <= ancho) { palabras.push({ texto: p, w }); continue; }
        // Palabra imposible de entrar (un enlace larguísimo): se parte por letras
        let trozo = '';
        for (const g of grafemas(p)) {
          const prueba = trozo + g;
          if (trozo && anchoTramos(tramos(prueba, principal, R, color), R, size, track) > ancho) {
            palabras.push({ texto: trozo, w: anchoTramos(tramos(trozo, principal, R, color), R, size, track) });
            trozo = g;
          } else trozo = prueba;
        }
        if (trozo) palabras.push({ texto: trozo, w: anchoTramos(tramos(trozo, principal, R, color), R, size, track) });
      }

      const grupo = [];
      let actual = [], w = 0;
      for (const p of palabras) {
        const nuevo = actual.length ? w + espacio + p.w : p.w;
        if (actual.length && nuevo > ancho) {
          grupo.push(actual.join(' '));
          actual = [p.texto]; w = p.w;
        } else {
          actual.push(p.texto); w = nuevo;
        }
      }
      if (actual.length) grupo.push(actual.join(' '));

      grupo.forEach((txt, i) => {
        const lista = tramos(txt, principal, R, color);
        lineas.push({
          tramos: lista,
          ancho: anchoTramos(lista, R, size, track),
          renglon: r,
          primera: i === 0,
          ultima: i === grupo.length - 1,
          largo: grupo.length
        });
      });
    });
    return lineas;
  }


  // ══════════════════════════════════════════════════════════════════
  //  COMPOSICIÓN DE UNA CARTA
  // ══════════════════════════════════════════════════════════════════

  function sticker(R, clave, cx, cy, ancho, giro, opacidad = 1) {
    const s = R.stickers[clave];
    const alto = ancho * s.h / s.w;
    return { t: 'grupo', cx, cy, rot: giro, hijos: [{ t: 'img', ref: s, x: -ancho / 2, y: -alto / 2, w: ancho, h: alto, op: opacidad }] };
  }

  function decoracion(R, pagina, total, numero) {
    const els = [
      // Florcita arriba a la derecha y ramita abajo a la izquierda (dentro del margen de seguridad)
      sticker(R, 'flor', 179, 21, 19, 14 + (numero % 3) * 6),
      sticker(R, 'ramita', 21, 265, 9.5, -16)
    ];
    const pie = 'Cande · 05.12.2026' + (total > 1 ? `  ·  ${pagina}/${total}` : '');
    const lista = tramos(pie, 'etiqueta', R, COLOR.oliva);
    const w = anchoTramos(lista, R, D.pie.size, D.pie.track) - D.pie.track * PT;
    els.push(...dibujarLinea(lista, (HOJA.w - w) / 2, D.pie.y, D.pie.size, COLOR.oliva, R, D.pie.track));
    return els;
  }

  /** Encabezado: N.º + moño, nombre en letra manuscrita y un filete. */
  function cabecera(R, numero, nombre) {
    const col = D.columna;
    const etiqueta = 'N.º ' + String(numero).padStart(2, '0');
    const lEt = tramos(etiqueta, 'etiqueta', R, COLOR.oliva);
    const wEt = anchoTramos(lEt, R, D.etiqueta.size, D.etiqueta.track) - D.etiqueta.track * PT;

    // Nombre: se achica un poco si no entra; si igual no entra, pasa a dos líneas
    let size = D.nombre.size, lineas;
    for (; size >= D.nombre.minimo; size -= 1) {
      lineas = lineasDeTexto(nombre, 'nombre', size, col, R, COLOR.bordo).filter(l => !l.blanco);
      if (lineas.length === 1) break;
    }
    if (size < D.nombre.minimo) {
      size = D.nombre.minimo;
      lineas = lineasDeTexto(nombre, 'nombre', size, col, R, COLOR.bordo).filter(l => !l.blanco);
    }
    const em = size * PT;

    const yEt = 2.6;                         // línea base de la etiqueta
    const yNombre0 = yEt + 4 + em * 0.78;    // primera línea base del nombre
    const yUltimo = yNombre0 + (lineas.length - 1) * em * 1.05;
    const yFilete = yUltimo + em * 0.34 + 3.6;
    const alto = yFilete + 0.3 + 9.5;

    function dibujar(y0) {
      const xEt = (HOJA.w - wEt) / 2 - 3.2;
      const els = dibujarLinea(lEt, xEt, y0 + yEt, D.etiqueta.size, COLOR.oliva, R, D.etiqueta.track);
      els.push(sticker(R, 'lazo', xEt + wEt + 4.6, y0 + yEt - 1.3, 6.2, 18));
      lineas.forEach((l, i) => {
        els.push(...dibujarLinea(l.tramos, (HOJA.w - l.ancho) / 2, y0 + yNombre0 + i * em * 1.05, size, COLOR.bordo, R));
      });
      els.push({ t: 'rect', x: HOJA.w / 2 - 8, y: y0 + yFilete, w: 16, h: 0.3, fill: COLOR.oliva, op: 0.7 });
      return els;
    }
    return { alto, dibujar };
  }

  /** Cabecera chica de las hojas que continúan una carta. */
  function cabeceraContinua(R, numero, nombre) {
    const texto = 'N.º ' + String(numero).padStart(2, '0') + '  ·  ' + nombre + '  ·  continuación';
    const size = 7, track = 0.8;
    let lista = tramos(texto, 'etiqueta', R, COLOR.oliva);
    let w = anchoTramos(lista, R, size, track) - track * PT;
    if (w > D.columna) {
      lista = tramos('N.º ' + String(numero).padStart(2, '0') + '  ·  continuación', 'etiqueta', R, COLOR.oliva);
      w = anchoTramos(lista, R, size, track) - track * PT;
    }
    return {
      alto: 11,
      dibujar: y0 => dibujarLinea(lista, (HOJA.w - w) / 2, y0 + 2.5, size, COLOR.oliva, R, track)
    };
  }

  // Altura de un tramo de líneas de cuerpo
  const EM = D.cuerpo.size * PT;
  const AVANCE = D.cuerpo.avance * PT;
  const ASC = EM * 0.74, DESC = EM * 0.26;

  function avanceDe(l) { return l.blanco ? AVANCE * D.blanco : AVANCE; }

  function altoLineas(lineas) {
    if (!lineas.length) return 0;
    let h = ASC + DESC;
    for (let i = 1; i < lineas.length; i++) h += avanceDe(lineas[i - 1]);
    return h;
  }

  function dibujarLineas(R, lineas, x0, y0) {
    const els = [];
    let y = y0 + ASC;
    lineas.forEach((l, i) => {
      if (i > 0) y += avanceDe(lineas[i - 1]);
      if (!l.blanco) els.push(...dibujarLinea(l.tramos, x0, y, D.cuerpo.size, COLOR.tinta, R));
    });
    return els;
  }

  /** Medidas de la foto dentro de un máximo, sin deformarla ni recortarla. */
  function medidaFoto(foto, maxAlto) {
    const a = foto.w / foto.h;
    let w = Math.min(D.foto.maxAncho, maxAlto * a);
    let h = w / a;
    return {
      w, h,
      marcoW: w + D.foto.borde * 2,
      marcoH: h + D.foto.borde + D.foto.bordeInf,
      dpi: foto.w / (w / 25.4)
    };
  }

  function marcoFoto(R, foto, m, cx, yTop, numero) {
    const giro = [-1.4, 1.2, -0.9, 1.6][numero % 4];
    const cy = yTop + m.marcoH / 2;
    const x0 = -m.marcoW / 2, y0 = -m.marcoH / 2;
    const cinta = 'M-12 -3.6 L12 -3.6 L11.1 -2.2 L12.1 -0.8 L11.2 0.6 L12 2.1 L11.3 3.6 L-12 3.6 L-11.2 2.3 L-12.1 0.9 L-11.2 -0.6 L-12 -2.2 Z';
    const s = R.stickers.flor;
    return {
      t: 'grupo', cx: HOJA.w / 2 + (cx || 0), cy, rot: giro, hijos: [
        { t: 'rect', x: x0 + 0.5, y: y0 + 0.9, w: m.marcoW, h: m.marcoH, fill: COLOR.sombra, op: 0.07 },
        { t: 'rect', x: x0, y: y0, w: m.marcoW, h: m.marcoH, fill: COLOR.marco, stroke: COLOR.filete, sw: 0.25 },
        { t: 'img', ref: foto, x: x0 + D.foto.borde, y: y0 + D.foto.borde, w: m.w, h: m.h },
        { t: 'grupo', cx: 0, cy: y0 + 0.4, rot: -3, hijos: [{ t: 'ruta', d: cinta, x: 0, y: 0, fill: COLOR.oliva, op: 0.86 }] },
        { t: 'grupo', cx: -x0 - 3, cy: -y0 - 3.5, rot: 12, hijos: [{ t: 'img', ref: s, x: -6, y: -6 * s.h / s.w, w: 12, h: 12 * s.h / s.w }] }
      ]
    };
  }

  /** Reparte las líneas en hojas, sin dejar renglones sueltos. */
  function cortarEn(lineas, desde, alturaDisponible) {
    let h = 0, i = desde;
    while (i < lineas.length) {
      const extra = i === desde ? ASC + DESC : avanceDe(lineas[i - 1]);
      if (h + extra > alturaDisponible) break;
      h += extra;
      i++;
    }
    if (i < lineas.length && i > desde + 1) {
      // viuda: la última línea de un renglón quedaría sola arriba de la hoja siguiente
      const sig = lineas[i];
      if (!sig.blanco && sig.ultima && !sig.primera && i - 1 > desde) i--;
      // huérfana: la primera línea de un renglón quedaría sola abajo
      const ant = lineas[i - 1];
      if (!ant.blanco && ant.primera && !ant.ultima && i - 1 > desde) i--;
    }
    if (i === desde) i = desde + 1;   // por las dudas, siempre avanza
    return i;
  }

  /**
   * Compone una carta.
   * @param msg    { nombre, mensaje }
   * @param numero número en el libro (1, 2, 3…)
   * @param foto   foto preparada (prepararFoto) o null
   * @returns { paginas: [[elementos]], avisos: [texto], archivo }
   */
  function componer(R, msg, numero, foto, avisosFoto = []) {
    const nombre = normalizar(msg.nombre).replace(/\n+/g, ' ') || 'Alguien que te quiere';
    const avisos = [...avisosFoto];
    const x0 = (HOJA.w - D.columna) / 2;
    const util = D.areaY1 - D.areaY0;

    const cab = cabecera(R, numero, nombre);
    const lineas = lineasDeTexto(msg.mensaje, 'cuerpo', D.cuerpo.size, D.columna, R, COLOR.tinta);
    const altoTexto = altoLineas(lineas);

    // ── ¿Entra todo en una hoja? ──
    let medida = null;
    if (foto) {
      for (let maxAlto = D.foto.maxAlto; maxAlto >= D.foto.minAlto; maxAlto -= 2) {
        const m = medidaFoto(foto, maxAlto);
        const total = cab.alto + m.marcoH + (lineas.length ? D.foto.separacion : 0) + altoTexto;
        if (total <= util) { medida = m; break; }
      }
    }
    const entra = foto ? !!medida : cab.alto + altoTexto <= util;

    const paginas = [];

    if (entra) {
      const mFoto = medida;
      const total = cab.alto + (mFoto ? mFoto.marcoH + (lineas.length ? D.foto.separacion : 0) : 0) + altoTexto;
      // Centrada en la hoja, apenas por encima del centro óptico
      let y = D.areaY0 + (util - total) * 0.44;
      const els = [...cab.dibujar(y)];
      y += cab.alto;
      if (mFoto) {
        els.push(marcoFoto(R, foto, mFoto, 0, y, numero));
        y += mFoto.marcoH + D.foto.separacion;
      }
      els.push(...dibujarLineasCentradas(R, lineas, x0, y));
      paginas.push(els);
      if (mFoto) avisoDpi(avisos, mFoto);
    } else {
      // ── Varias hojas: la primera con encabezado (y foto), después el texto sigue ──
      let y = D.areaY0;
      const primera = [...cab.dibujar(y)];
      y += cab.alto;
      if (foto) {
        const m = medidaFoto(foto, D.foto.altoLargo);
        primera.push(marcoFoto(R, foto, m, 0, y, numero));
        y += m.marcoH + D.foto.separacion;
        avisoDpi(avisos, m);
      }
      let i = 0;
      let fin = lineas.length ? cortarEn(lineas, 0, D.areaY1 - y) : 0;
      // Si en la primera hoja entrarían menos de 3 líneas, el texto empieza en la siguiente
      if (fin < Math.min(3, lineas.length)) fin = 0;
      primera.push(...dibujarLineas(R, lineas.slice(0, fin), x0, y));
      paginas.push(primera);
      i = fin;

      const cont = cabeceraContinua(R, numero, nombre);
      while (i < lineas.length) {
        while (i < lineas.length && lineas[i].blanco) i++;
        if (i >= lineas.length) break;
        const yy = D.areaY0 + 2;
        const els = [...cont.dibujar(yy)];
        const f = cortarEn(lineas, i, D.areaY1 - (yy + cont.alto));
        els.push(...dibujarLineas(R, lineas.slice(i, f), x0, yy + cont.alto));
        paginas.push(els);
        i = f;
      }
    }

    // Decoración y pie en cada hoja
    const conDeco = paginas.map((els, p) => [...decoracion(R, p + 1, paginas.length, numero), ...els]);

    return { paginas: conDeco, avisos, archivo: nombreArchivo(numero, nombre), numero, nombre };
  }

  // Mensajes muy cortos (una o dos líneas) quedan centrados; el resto, alineado a la izquierda
  function dibujarLineasCentradas(R, lineas, x0, y0) {
    const reales = lineas.filter(l => !l.blanco);
    if (reales.length && reales.length <= 2) {
      const els = [];
      let y = y0 + ASC;
      lineas.forEach((l, i) => {
        if (i > 0) y += avanceDe(lineas[i - 1]);
        if (!l.blanco) els.push(...dibujarLinea(l.tramos, (HOJA.w - l.ancho) / 2, y, D.cuerpo.size, COLOR.tinta, R));
      });
      return els;
    }
    return dibujarLineas(R, lineas, x0, y0);
  }

  function avisoDpi(avisos, m) {
    if (m.dpi < D.dpiMinimo) {
      avisos.push(`La foto tiene poca resolución para imprimir a este tamaño (≈ ${Math.round(m.dpi)} ppp; lo ideal es 200 o más). Se va a ver algo borrosa en papel.`);
    }
  }

  function nombreArchivo(numero, nombre) {
    const limpio = String(nombre || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40).replace(/_+$/, '') || 'Anonimo';
    return `Carta_${String(numero).padStart(3, '0')}_${limpio}.pdf`;
  }


  // ══════════════════════════════════════════════════════════════════
  //  FOTOS
  // ══════════════════════════════════════════════════════════════════

  function esJpg(b) { return b[0] === 0xFF && b[1] === 0xD8; }
  function esPng(b) { return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47; }

  // Orientación EXIF de un JPEG (1 = normal). Los PDF no la respetan,
  // así que una foto girada se vuelve a codificar derecha (solo para el PDF).
  function orientacionExif(b) {
    try {
      const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
      let o = 2;
      while (o + 4 < v.byteLength) {
        if (v.getUint8(o) !== 0xFF) return 1;
        const marca = v.getUint8(o + 1);
        const largo = v.getUint16(o + 2);
        if (marca === 0xE1 && v.getUint32(o + 4) === 0x45786966) {
          const t = o + 10;
          const le = v.getUint16(t) === 0x4949;
          const ifd = t + v.getUint32(t + 4, le);
          const n = v.getUint16(ifd, le);
          for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12;
            if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le);
          }
          return 1;
        }
        if (marca === 0xDA) return 1;
        o += 2 + largo;
      }
    } catch { /* sin EXIF legible */ }
    return 1;
  }

  /**
   * Descarga y prepara una foto para la carta. No modifica el original:
   * JPEG y PNG se incrustan tal cual (máxima calidad). Solo se vuelven a
   * codificar (JPEG 95 %) los formatos que el PDF no admite o las fotos
   * con rotación EXIF.
   */
  async function prepararFoto(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    const blob = await r.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());

    let bmp;
    try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch { bmp = null; }
    if (!bmp) {
      const e = new Error('formato');
      e.formato = true;
      throw e;
    }

    const w = bmp.width, h = bmp.height;
    let tipo = esJpg(bytes) ? 'jpg' : esPng(bytes) ? 'png' : 'otro';
    let datos = bytes;

    if (tipo === 'otro' || (tipo === 'jpg' && orientacionExif(bytes) > 1)) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0);
      const out = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.95));
      datos = new Uint8Array(await out.arrayBuffer());
      tipo = 'jpg';
      c.width = c.height = 0;
    }
    bmp.close && bmp.close();

    const objeto = URL.createObjectURL(new Blob([datos], { type: tipo === 'png' ? 'image/png' : 'image/jpeg' }));
    return { clave: 'foto-' + url, bytes: datos, tipo, w, h, url: objeto, liberar() { URL.revokeObjectURL(objeto); } };
  }


  // ══════════════════════════════════════════════════════════════════
  //  VISTA PREVIA (SVG en mm, misma composición que el PDF)
  // ══════════════════════════════════════════════════════════════════

  function xml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function svgElemento(el, R) {
    switch (el.t) {
      case 'texto':
        return `<text x="${el.x.toFixed(3)}" y="${el.y.toFixed(3)}" font-family="${R.fuentes[el.f].familia}" font-size="${(el.size * PT).toFixed(4)}"` +
          (el.track ? ` letter-spacing="${(el.track * PT).toFixed(4)}"` : '') +
          ` fill="${el.color}" xml:space="preserve">${xml(el.texto)}</text>`;
      case 'img':
        return `<image href="${xml(el.ref.url)}" x="${el.x.toFixed(3)}" y="${el.y.toFixed(3)}" width="${el.w.toFixed(3)}" height="${el.h.toFixed(3)}" preserveAspectRatio="none"${el.op != null ? ` opacity="${el.op}"` : ''}/>`;
      case 'rect':
        return `<rect x="${el.x.toFixed(3)}" y="${el.y.toFixed(3)}" width="${el.w.toFixed(3)}" height="${el.h.toFixed(3)}" fill="${el.fill || 'none'}"` +
          (el.op != null ? ` fill-opacity="${el.op}"` : '') +
          (el.stroke ? ` stroke="${el.stroke}" stroke-width="${el.sw}"` : '') + '/>';
      case 'ruta':
        return `<path d="${el.d}" transform="translate(${el.x} ${el.y})" fill="${el.fill}"${el.op != null ? ` fill-opacity="${el.op}"` : ''}/>`;
      case 'grupo':
        return `<g transform="translate(${el.cx.toFixed(3)} ${el.cy.toFixed(3)}) rotate(${el.rot || 0})">${el.hijos.map(h => svgElemento(h, R)).join('')}</g>`;
    }
    return '';
  }

  function svgDePagina(R, elementos) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${HOJA.w} ${HOJA.h}" class="hoja-svg" role="img" aria-label="Vista previa de la hoja A4" style="font-kerning:none;font-variant-ligatures:none;font-feature-settings:&quot;calt&quot; 0;text-rendering:geometricPrecision">` +
      `<rect width="${HOJA.w}" height="${HOJA.h}" fill="#FFFFFF"/>` +
      elementos.map(e => svgElemento(e, R)).join('') + '</svg>';
  }


  // ══════════════════════════════════════════════════════════════════
  //  PDF
  // ══════════════════════════════════════════════════════════════════

  function rgbDe(hex) {
    const n = parseInt(hex.slice(1), 16);
    return PDFLib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }

  async function nuevoPDF(titulo) {
    const R = await preparar();
    const doc = await PDFLib.PDFDocument.create();
    doc.registerFontkit(window.fontkit);
    doc.setTitle(titulo);
    doc.setAuthor('Familia y amigos de Cande');
    doc.setSubject('Libro de recuerdos · Casamiento de Cande · 05.12.2026');
    doc.setCreator('Libro de Cande');
    doc.setProducer('pdf-lib');
    doc.setLanguage('es-AR');
    return { doc, R, fuentes: {}, imagenes: new Map() };
  }

  async function fuentePDF(ctx, clave) {
    // Fuente completa: el subconjunto de pdf-lib pierde letras de Cormorant
    if (!ctx.fuentes[clave]) ctx.fuentes[clave] = ctx.doc.embedFont(ctx.R.fuentes[clave].bytes, { subset: false, features: RASGOS });
    return ctx.fuentes[clave];
  }

  async function imagenPDF(ctx, ref) {
    if (!ctx.imagenes.has(ref.clave)) {
      ctx.imagenes.set(ref.clave, ref.tipo === 'png' ? ctx.doc.embedPng(ref.bytes) : ctx.doc.embedJpg(ref.bytes));
    }
    return ctx.imagenes.get(ref.clave);
  }

  // Precarga (embebe) todo lo que usa una lista de elementos
  async function embeberTodo(ctx, els) {
    for (const el of els) {
      if (el.t === 'texto') await fuentePDF(ctx, el.f);
      else if (el.t === 'img') await imagenPDF(ctx, el.ref);
      else if (el.t === 'grupo') await embeberTodo(ctx, el.hijos);
    }
  }

  function dibujarPDF(ctx, page, el, P) {
    const L = PDFLib;
    switch (el.t) {
      case 'texto': {
        const [x, y] = P(el.x, el.y);
        if (el.track) page.pushOperators(L.setCharacterSpacing(el.track));
        page.drawText(el.texto, { x, y, size: el.size, font: ctx.fuentesListas[el.f], color: rgbDe(el.color) });
        if (el.track) page.pushOperators(L.setCharacterSpacing(0));
        break;
      }
      case 'img': {
        const [x, y] = P(el.x, el.y + el.h);
        page.drawImage(ctx.imagenesListas.get(el.ref.clave), { x, y, width: el.w * K, height: el.h * K, opacity: el.op != null ? el.op : 1 });
        break;
      }
      case 'rect': {
        const [x, y] = P(el.x, el.y + el.h);
        page.drawRectangle({
          x, y, width: el.w * K, height: el.h * K,
          color: el.fill ? rgbDe(el.fill) : undefined,
          opacity: el.op != null ? el.op : 1,
          borderColor: el.stroke ? rgbDe(el.stroke) : undefined,
          borderWidth: el.stroke ? el.sw * K : 0
        });
        break;
      }
      case 'ruta': {
        const [x, y] = P(el.x, el.y);
        page.drawSvgPath(el.d, { x, y, scale: K, color: rgbDe(el.fill), opacity: el.op != null ? el.op : 1, borderWidth: 0 });
        break;
      }
      case 'grupo': {
        const [x, y] = P(el.cx, el.cy);
        page.pushOperators(L.pushGraphicsState(), L.concatTransformationMatrix(1, 0, 0, 1, x, y), L.rotateDegrees(-(el.rot || 0)));
        const Pg = (a, b) => [a * K, -b * K];
        for (const h of el.hijos) dibujarPDF(ctx, page, h, Pg);
        page.pushOperators(L.popGraphicsState());
        break;
      }
    }
  }

  /** Agrega todas las hojas de una carta compuesta al documento. */
  async function agregarCarta(ctx, carta) {
    ctx.fuentesListas = ctx.fuentesListas || {};
    ctx.imagenesListas = ctx.imagenesListas || new Map();
    for (const els of carta.paginas) await embeberTodo(ctx, els);
    for (const [k, p] of Object.entries(ctx.fuentes)) ctx.fuentesListas[k] = await p;
    for (const [k, p] of ctx.imagenes) ctx.imagenesListas.set(k, await p);

    const Ptop = (x, y) => [x * K, (HOJA.h - y) * K];
    for (const els of carta.paginas) {
      const page = ctx.doc.addPage(PDFLib.PageSizes.A4);
      for (const el of els) dibujarPDF(ctx, page, el, Ptop);
    }
  }

  async function guardar(ctx) {
    return ctx.doc.save({ objectsPerTick: 40 });
  }

  /** Atajo: PDF de una sola carta. */
  async function pdfDeCarta(carta) {
    const ctx = await nuevoPDF(`Carta N.º ${String(carta.numero).padStart(2, '0')} · ${carta.nombre}`);
    await agregarCarta(ctx, carta);
    return guardar(ctx);
  }


  window.Cartas = {
    version: VERSION_DATOS,
    preparar,
    cargarScript,
    prepararFoto,
    componer: async (msg, numero, foto, avisosFoto) => componer(await preparar(), msg, numero, foto, avisosFoto),
    svgDePagina: async els => svgDePagina(await preparar(), els),
    nuevoPDF,
    agregarCarta,
    guardar,
    pdfDeCarta,
    nombreArchivo,
    HOJA
  };
}());
