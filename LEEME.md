# Casamiento Candela Conte · 05.12.2026

Libro digital de recuerdos para Cande (sorpresa). Copia independiente de
"Cumple Fau 2026", con su propio sitio de Netlify y su propio formulario.

## Páginas

| Archivo | Qué es |
|---|---|
| `index.html` | Página para los invitados: abren el libro y dejan nombre, mensaje y foto opcional. |
| `libro.html` | El libro para Cande: una página por mensaje, con foto. |

## Archivos

| Archivo | Para qué |
|---|---|
| `portada.css` | Base compartida: colores, tipografías, libro 3D, espiral y **portada** (incluye el bloque de configuración de la foto). |
| `index.css` / `index.js` | Formulario, modales, envío a Netlify Forms, compresión de fotos pesadas. |
| `libro.css` / `libro.js` | Libro de lectura: carga de mensajes, páginas, navegación (botones, flechas del teclado y deslizar en el celular). |
| `decor.js` | Ilustraciones SVG con acabado de pintura (moño, corazón, flor azul) y detección de la foto de portada. |
| `netlify/functions/mensajes.js` | Lee los envíos del formulario `mensajes-candela` y se los pasa al libro. |
| `assets/` | `candela-portada.webp` (versión liviana de `candesecasa.png`, la que usa la portada), `rayas-acuarela.webp` (rayas bordó en acuarela) y `papel.webp` (textura de papel). |

## Cambiar la foto de la portada

1. Poné la foto nueva en `assets/`.
2. En `portada.css`, bloque **FOTO DE CANDELA — CONFIGURACIÓN**, cambiá la ruta de `--foto-cande`.
3. Si es una foto recortada (PNG/WebP sin fondo) dejá `--foto-tamano: contain`; si es una foto común rectangular usá `cover`. En los dos casos se muestra como sticker con borde blanco.
4. Ajustá el encuadre con `--foto-x`, `--foto-y` y `--foto-zoom` (y las variantes `-movil` para celular).
5. Si cambiás el nombre del archivo, actualizá también el `<link rel="preload">` en `index.html` y `libro.html`.

## Publicación (Netlify)

1. Crear un **sitio nuevo** en Netlify conectado a este repositorio (no usar el sitio del cumpleaños).
2. Build: sin comando; publish directory `.` (ya está en `netlify.toml`).
3. En *Site configuration → Environment variables*:
   - `NETLIFY_TOKEN`: token personal de Netlify (*User settings → Applications → Personal access tokens*).
   - `LIBRO_CLAVE`: una palabra secreta (recomendado). El libro se abre con `/libro.html?clave=ESA_PALABRA`.
   - `NETLIFY_SITE_ID`: opcional (Netlify ya define `SITE_ID` del propio sitio).
4. En *Forms*, activar la detección de formularios y volver a desplegar. Tiene que aparecer el formulario `mensajes-candela`.
5. Probar: mandar un mensaje de prueba desde `index.html`, abrir el libro con la clave, y después borrar el envío de prueba en *Forms*.

## Vista previa local

`python -m http.server` en esta carpeta y abrir `http://localhost:8000/`.
El envío del formulario y la lectura real de mensajes solo funcionan publicados en Netlify.
Para ver el diseño del libro sin mensajes reales: `libro.html?demo` (mensajes de ejemplo, no se guardan).
