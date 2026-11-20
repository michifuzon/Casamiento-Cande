# Casamiento Candela Conte · 05.12.2026

Libro digital de recuerdos para Cande (sorpresa). Copia independiente de
"Cumple Fau 2026", con su propio sitio de Netlify y su propio formulario.

## Páginas

| Archivo | Qué es |
|---|---|
| `index.html` | Página para los invitados: abren el libro y dejan nombre, mensaje y foto opcional. |
| `libro.html` | **Privado** (pide contraseña). El libro con un mensaje por página y las herramientas para imprimir: vista previa A4, carta en PDF, todas en ZIP o en un único PDF. |

## Archivos

| Archivo | Para qué |
|---|---|
| `portada.css` | Base compartida: colores, tipografías, libro 3D, espiral y **portada** (incluye el bloque de configuración de la foto). |
| `index.css` / `index.js` | Formulario, modales, envío a Netlify Forms, compresión de fotos pesadas. |
| `libro.css` / `libro.js` | Libro de lectura: inicio de sesión, carga de mensajes, páginas, navegación, vista previa A4 y descargas. |
| `cartas.js` | Arma cada carta A4 (medidas reales en mm) y la dibuja igual en la vista previa (SVG) y en el PDF (texto vectorial, fuentes incrustadas). |
| `vendor/` | pdf-lib 1.17.1 + fontkit (PDF) y fflate 0.8.2 (ZIP). Se cargan solo en el libro privado, cuando hacen falta. |
| `assets/fuentes/`, `assets/carta/` | Tipografías TTF que se incrustan en los PDF y florcitas en alta resolución para imprimir. |
| `decor.js` | Ilustraciones SVG con acabado de pintura (moño, corazón, flor azul) y detección de la foto de portada. |
| `netlify/functions/sesion.js` | Inicia y cierra la sesión del libro (cookie segura firmada, 7 días). |
| `netlify/functions/mensajes.js` | Lee los envíos del formulario `mensajes-candela` y se los pasa al libro. **Solo con sesión.** |
| `netlify/functions/foto.js` | Entrega las fotos de los mensajes. **Solo con sesión.** |
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
2. *Site configuration → Environment variables* (las tres con *Scopes* que incluya **Functions**):
   - `NETLIFY_TOKEN` (**obligatoria**, secreta): token personal (*User settings → Applications → Personal access tokens*).
   - `NETLIFY_SITE_ID` (**obligatoria**): el *Site ID* de este sitio (*Site configuration → General*).
   - `LIBRO_CLAVE` (**obligatoria**, secreta): la contraseña del libro. Sin ella el libro queda cerrado para todos.
     Si se cambia, se cierran todas las sesiones abiertas.
3. *Deploys → Trigger deploy* (o hacer un push).
4. Probar: en *Forms* tiene que aparecer `mensajes-candela`. Mandar un mensaje de prueba, abrir `/libro.html`, ingresar la contraseña y después borrar el envío de prueba desde *Forms*.

La vista previa al compartir por WhatsApp usa `assets/og-miniatura.jpg` (280×280: WhatsApp la muestra como miniatura chica al costado; una imagen grande la mostraría gigante) con la dirección absoluta del sitio. Si cambia el dominio, actualizar `og:url` y `og:image` en `index.html`. WhatsApp guarda la vista previa en caché un tiempo.

## Vista previa local

`python -m http.server` en esta carpeta y abrir `http://localhost:8000/`.
El envío del formulario y la lectura real de mensajes solo funcionan publicados en Netlify.
Para ver el diseño del libro sin mensajes reales: `libro.html?demo` (mensajes de ejemplo, no se guardan).

## Libro privado e impresión

1. Entrar a `casamientocande.netlify.app/libro.html` e ingresar la contraseña (`LIBRO_CLAVE`).
2. Arriba aparece la barra con la cantidad de mensajes, **Descargar todas las cartas** y **Cerrar sesión**.
3. En cada página del libro: **Vista previa A4** (la hoja tal cual se imprime, con avisos si una foto tiene poca resolución) y **Descargar carta PDF** (`Carta_001_Nombre_Apellido.pdf`).
4. **Descargar todas las cartas** ofrece:
   - **PDF completo** (`Libro_Candela_2026.pdf`): todas las cartas seguidas, cada una empezando en hoja nueva. Es el que va a la imprenta.
   - **ZIP** (`Cartas_Candela_2026.zip`): un PDF por carta.
5. Imprimir en A4, vertical, **escala 100 %** ("tamaño real", sin "ajustar a la página").

Los mensajes, las fotos y la lista solo se entregan con sesión iniciada; la contraseña se valida en el servidor y nunca está en el código de la página.
