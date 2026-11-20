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

Sitio: **casamientocande.netlify.app** (sitio propio, separado del cumpleaños). Netlify despliega solo con cada push a `main`.

1. **Forms → Enable form detection.** Sin esto Netlify rechaza los envíos ("No se pudo enviar"). Se aplica recién en el próximo deploy.
2. *Site configuration → Environment variables*:
   - `NETLIFY_TOKEN` (**obligatoria**): token personal (*User settings → Applications → Personal access tokens*). Sin ella el libro responde "Falta NETLIFY_TOKEN".
   - `NETLIFY_SITE_ID` (**recomendada**): el *Site ID* de este sitio (*Site configuration → General*).
   - `LIBRO_CLAVE` (**muy recomendada**): una palabra secreta. Sin ella cualquiera que entre a `/libro.html` puede leer todos los mensajes. Con ella, el libro se abre con `/libro.html?clave=ESA_PALABRA`.
3. *Deploys → Trigger deploy* (o hacer un push).
4. Probar: en *Forms* tiene que aparecer `mensajes-candela`. Mandar un mensaje de prueba, abrir el libro con la clave y después borrar el envío de prueba desde *Forms*.

La vista previa al compartir por WhatsApp usa `assets/og-miniatura.jpg` (280×280: WhatsApp la muestra como miniatura chica al costado; una imagen grande la mostraría gigante) con la dirección absoluta del sitio. Si cambia el dominio, actualizar `og:url` y `og:image` en `index.html`. WhatsApp guarda la vista previa en caché un tiempo.

## Vista previa local

`python -m http.server` en esta carpeta y abrir `http://localhost:8000/`.
El envío del formulario y la lectura real de mensajes solo funcionan publicados en Netlify.
Para ver el diseño del libro sin mensajes reales: `libro.html?demo` (mensajes de ejemplo, no se guardan).
