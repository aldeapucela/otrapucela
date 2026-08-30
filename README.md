# La Otra Pucela

Medio digital estático construido con `Eleventy`, `Tailwind CSS` y `Vanilla JS`, alimentado por contenidos de `Discourse`.

El sitio toma los topics del foro de Aldea Pucela, los normaliza, genera páginas estáticas y se despliega automáticamente en `GitHub Pages`.

## Stack

- `Eleventy` como generador estático
- `Tailwind CSS` para toda la UI
- `Vanilla JS` para interacciones del cliente
- `Discourse API` como fuente de datos
- `GitHub Actions` + `GitHub Pages` para build y despliegue

## Licencia

El código de esta web se distribuye bajo la licencia `GNU AGPL v3.0`.

Consulta el texto completo en:

- `LICENSE`

## Fuente de datos

La fuente principal es la categoría de Discourse:

- `https://foro.aldeapucela.org/c/9.json`

Durante la build:

1. Se consulta la categoría para obtener la lista de topics.
2. Se enriquecen los artículos con datos del topic individual.
3. Se sanea el HTML del primer post para su renderizado editorial.
4. Se genera:
   - portada
   - páginas de tema
   - páginas de artículo
   - un JSON estático en `/api/articulos.json`

## Requisitos

- `Node.js >= 20`
- `npm`

## Instalación

```bash
npm install
```

## Desarrollo local

Servidor de desarrollo con Eleventy:

```bash
npm run start
```

Por defecto sirve en:

- [http://localhost:8080](http://localhost:8080)

Si necesitas levantar una preview simple de la carpeta `dist` en otro puerto, primero genera la build:

```bash
npm run build
python3 -m http.server 4000 -d dist
```

Esto es útil cuando se quiere probar integración con embeds o revisar el HTML final compilado.

## Build de producción

```bash
npm run build
```

La salida se genera en:

- `dist/`

## Scripts disponibles

- `npm run start`: arranca Eleventy en modo servidor
- `npm run build`: limpia `dist`, compila Tailwind y genera el sitio
- `npm run clean`: elimina `dist`
- `npm run build:css`: compila Tailwind a `dist/assets/styles/main.css`

## Estructura del proyecto

```text
.
├── .github/workflows/build.yml
├── eleventy.config.js
├── package.json
├── tailwind.config.js
├── src
│   ├── _data
│   │   └── articulos.js
│   ├── _includes
│   │   └── base.njk
│   ├── api
│   │   └── articulos.json.njk
│   ├── assets
│   │   ├── favicon.svg
│   │   ├── js
│   │   │   ├── main.js
│   │   │   └── matomo.js
│   │   └── styles
│   │       └── main.css
│   ├── articulo.njk
│   ├── etiqueta.njk
│   └── index.njk
└── dist
```

## Arquitectura de datos

El fichero clave es:

- `src/_data/articulos.js`

Responsabilidades:

- consultar la API de Discourse
- extraer `tags`, autor, fechas, extracto, imagen y HTML
- sanear el contenido HTML
- corregir elementos problemáticos del HTML de Discourse
  - lightboxes
  - emojis
  - captions de dimensiones
  - `onebox`
- ordenar artículos
  - primero fijados (`pinned`)
  - después por fecha de publicación descendente
- mantener caché local para evitar descargas innecesarias

## Caché local

Para reducir peticiones y evitar volver a bajar topics sin cambios, el proyecto guarda una caché local en:

- `.cache/articulos.json`
- `.cache/autores.json`
- `.cache/audio-manifest.json`

La caché reutiliza artículos ya descargados si no han cambiado según `updatedAt`.

Notas:

- no hace falta commitear esta caché
- si quieres forzar una reconstrucción completa desde Discourse, puedes borrarla manualmente

## Flujo de datos en build

En cada `npm run build` el proyecto hace esto:

1. consulta el índice de la categoría de Discourse (`/c/9.json`)
2. compara cada topic con la caché local por `updatedAt`
3. solo entra al JSON completo de los topics que han cambiado o no están cacheados
4. resuelve autores reutilizando caché cuando es posible
5. resuelve audio de una de estas dos formas:

- preferida: leyendo un manifiesto JSON único definido en `AUDIO_MANIFEST_URL`
- fallback: haciendo una petición `HEAD` por artículo al MP3 remoto

Eso significa que ya no se “bajan todos los artículos” en cada build: siempre se consulta el índice de la categoría, pero el detalle solo se pide para los topics nuevos o modificados.

## Manifiesto de audios

Para escalar mejor, el proyecto puede consumir un único manifiesto remoto en vez de hacer una comprobación por audio.

Variables opcionales:

- `AUDIO_MANIFEST_URL`: URL JSON del manifiesto de audios
- `AUDIO_MANIFEST_TTL_MS`: tiempo de caché local del manifiesto en milisegundos. Por defecto, `600000` (10 minutos)

Formato admitido del manifiesto:

```json
{
  "generatedAt": "2026-03-28T10:00:00.000Z",
  "items": [
    {
      "id": "123",
      "isAvailable": true,
      "src": "https://media.aldeapucela.org/audios/123.mp3",
      "downloadUrl": "https://media.aldeapucela.org/audios/123.mp3",
      "mimeType": "audio/mpeg",
      "sizeBytes": 1843200,
      "duration": "03:12"
    }
  ]
}
```

También se aceptan estas variantes:

- `audios` en lugar de `items`
- `itemsById` como objeto
- claves `articleId` o `topicId` en lugar de `id`

Si el manifiesto falla temporalmente, el build intenta usar la copia local en `.cache/audio-manifest.json`. Si tampoco existe, vuelve al modo anterior de `HEAD` por artículo.

## Salida JSON para frontend

Además de las páginas HTML, Eleventy genera:

- `dist/api/articulos.json`

Ese JSON puede usarse desde frontend para consultas ligeras o integraciones adicionales.

## Despliegue en GitHub Pages

El despliegue se hace con:

- `.github/workflows/build.yml`

Triggers configurados:

- push a `main`
- ejecución manual
- cron cada 15 minutos

La tarea:

1. instala dependencias
2. ejecuta `npm run build`
3. sube `dist/` como artefacto de Pages
4. despliega automáticamente

## Variables y dominio

El sitio está preparado para funcionar sin hardcodear el dominio público en la mayoría de rutas:

- los enlaces internos usan rutas relativas
- el embed de Discourse resuelve con la URL actual del navegador cuando hace falta

Variables opcionales relevantes para feeds:

- `SITE_URL`: URL pública base del sitio
- `PODCAST_FEED_URL`: URL pública final del feed de podcast
- `PODCAST_OWNER_NAME`: nombre público del propietario del podcast en el RSS
- `PODCAST_OWNER_EMAIL`: email público usado por Spotify/iTunes para verificar y mostrar la titularidad del podcast

Para compatibilidad con Spotify e iTunes, el feed de podcast publica el bloque `itunes:owner` con `name` y `email`, y usa una carátula cuadrada específica distinta de la imagen social general.

## Comentarios de Discourse

La página de artículo integra comentarios usando el embed oficial de Discourse
en modo fullApp.

Detalles relevantes:

- el iframe se carga también cuando el tema todavía no tiene respuestas
- la sección conserva únicamente su cabecera y deja la interacción al iframe
- si el iframe falla, queda un enlace textual de recuperación
- el contador se actualiza en cliente sin recargar el iframe

La configuración de Discourse y el override visual del tema están documentados
en docs/discourse-full-app-setup.md. En local, localhost:8000 y
127.0.0.1:8000 deben tratarse como orígenes distintos: usa el primero para
las pruebas previstas o autoriza también el segundo.

## Diseño y estilos

Reglas del proyecto:

- los estilos de componentes se importan dentro del flujo de Tailwind
- la UI se resuelve con utilidades de Tailwind y capas de componentes puntuales
- la lógica JS usa hooks `js-*` para no depender de clases visuales

## Problemas habituales

### El contenido del foro no se actualiza

Prueba a:

```bash
rm -f .cache/articulos.json
npm run build
```

### El embed de comentarios no se ve en local

Depende de la configuración de Discourse y de los orígenes permitidos para
embed. Consulta docs/discourse-full-app-setup.md y usa exactamente el mismo
host autorizado en el navegador.

Para algunas pruebas conviene servir `dist/` en:

- `http://localhost:4000`

### Se ve raro un bloque embebido del foro

Los `onebox` de Discourse se normalizan durante la build. Si un caso concreto sigue saliendo feo, revisa:

- el HTML original del topic
- el saneado en `src/_data/articulos.js`

## Flujo recomendado de trabajo

```bash
npm install
npm run build
npm run start
```

Y para revisar la salida final:

```bash
python3 -m http.server 4000 -d dist
```

## Licencia

Contenido y proyecto publicados bajo:

- [CC BY-SA 4.0 (es)](https://creativecommons.org/licenses/by-sa/4.0/deed.es)
