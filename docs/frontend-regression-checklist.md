# Frontend QA Regression Plan

Usa este documento después de cualquier cambio en frontend, plantillas o JavaScript. La regla es simple: no se da un cambio por bueno hasta pasar al menos `Smoke`, y cualquier refactor amplio debe pasar también `Core Regression`.

## Cómo usarlo

- Ejecuta `npm run build`.
- Sirve `dist` en `http://localhost:8000`.
- Haz las pruebas en navegador real o automatizado revisando consola.
- Registra hallazgos por severidad: `bloqueante`, `alta`, `media`, `baja`.

## Smoke

### QA-001 Portada carga sin roturas

- Ruta: `/`
- Pasos:
  1. Abrir portada.
  2. Confirmar que carga el header, listados y footer.
  3. Revisar consola.
- Esperado:
  - La portada renderiza completa.
  - No hay errores de consola atribuibles al código propio.

### QA-002 Menú móvil

- Ruta: `/`
- Pasos:
  1. Abrir menú.
  2. Comprobar que el panel se muestra.
  3. Cerrar con segundo click o `Escape`.
- Esperado:
  - El menú abre y cierra sin glitches.
  - `aria-expanded` cambia correctamente.
  - El scroll del fondo queda bloqueado al abrir y se restaura al cerrar.

### QA-003 Búsqueda

- Ruta: `/buscar/?q=valladolid`
- Pasos:
  1. Abrir búsqueda con query.
  2. Verificar resultados.
  3. Cambiar el texto de búsqueda.
- Esperado:
  - Se muestran resultados.
  - Hay resaltado de términos.
  - Cambia el estado entre `idle/loading/results/empty` cuando corresponde.

### QA-004 Artículo

- Ruta: cualquier artículo publicado
- Pasos:
  1. Abrir un artículo.
  2. Verificar acciones principales.
  3. Revisar consola.
- Esperado:
  - Cargan acciones de compartir, guardar, audio si existe y comentarios.
  - No hay errores de JS propios.

### QA-005 Lista de lectura

- Ruta: artículo + `/lista-de-lectura/`
- Pasos:
  1. Guardar un artículo.
  2. Ir a lista de lectura.
  3. Confirmar que aparece.
  4. Eliminarlo.
- Esperado:
  - El estado del botón cambia.
  - Los badges se actualizan.
  - La lista refleja altas y bajas.

### QA-006 Boletín

- Ruta: `/boletin/`
- Pasos:
  1. Abrir página del boletín.
  2. Verificar carga del formulario embebido.
  3. Probar botón de compartir.
- Esperado:
  - La página renderiza correctamente.
  - El iframe o embed se muestra.
  - El botón de compartir responde.

### QA-007 Build y assets

- Pasos:
  1. Ejecutar `npm run build`.
  2. Abrir varias páginas desde `dist`.
- Esperado:
  - Build sin errores.
  - Los assets fingerprinted resuelven correctamente.

## Core Regression

### QA-010 Header auto-hide

- Ruta: artículo o portada larga
- Pasos:
  1. Hacer scroll hacia abajo.
  2. Hacer scroll hacia arriba.
- Esperado:
  - El header se oculta al bajar.
  - El header reaparece al subir.
  - No se oculta si el menú está abierto.

### QA-011 Scroll to top

- Ruta: artículo
- Pasos:
  1. Hacer scroll suficiente.
  2. Pulsar “Volver arriba”.
- Esperado:
  - El botón aparece solo tras cierto scroll.
  - El desplazamiento es correcto.

### QA-012 Compartir

- Ruta: portada, artículo, boletín, contacto gracias
- Pasos:
  1. Pulsar botones de compartir.
  2. Observar feedback visual.
- Esperado:
  - Funciona `navigator.share` o fallback a portapapeles.
  - El texto del botón cambia y luego se restaura.

### QA-013 RSS dialog

- Ruta: una página con trigger RSS
- Pasos:
  1. Abrir diálogo RSS.
  2. Probar copia.
  3. Cerrar por botón y backdrop.
- Esperado:
  - El diálogo abre y cierra bien.
  - El foco vuelve al trigger.
  - La copia muestra feedback.

### QA-014 Install dialog

- Ruta: una página con trigger de instalación
- Pasos:
  1. Abrir diálogo de instalación.
  2. Cerrar por botón y backdrop.
- Esperado:
  - El diálogo funciona.
  - El foco vuelve al trigger.

### QA-015 Tema oscuro

- Ruta: portada y artículo
- Pasos:
  1. Alternar tema.
  2. Navegar a otra página.
- Esperado:
  - El tema se aplica al documento.
  - La preferencia persiste.
  - El icono cambia correctamente.

### QA-016 Carruseles

- Ruta: artículo con relacionados o más leídas
- Pasos:
  1. Usar controles siguiente/anterior.
  2. Revisar en viewport ancho.
- Esperado:
  - Los carruseles se desplazan.
  - Los controles solo aparecen cuando hay overflow.

### QA-017 Lightbox de imágenes

- Ruta: artículo con imágenes
- Pasos:
  1. Pulsar una imagen.
  2. Cerrar con botón, backdrop y `Escape`.
- Esperado:
  - La imagen se amplía.
  - El cierre funciona en todas las vías.
  - El foco se restaura.

### QA-018 Nuevo para ti

- Ruta: `/nuevo/`
- Pasos:
  1. Abrir página.
  2. Revisar badges y listado.
  3. Marcar una pieza como leída.
- Esperado:
  - La página muestra pendientes o estado vacío correcto.
  - Los contadores se actualizan.

### QA-019 Populares

- Ruta: `/populares/`
- Pasos:
  1. Abrir página.
  2. Verificar listado y estado.
- Esperado:
  - El listado se carga sin romper layout.
  - Los comentarios por pieza aparecen cuando hay datos.

### QA-020 Comentarios

- Ruta: artículo con comentarios
- Pasos:
  1. Abrir artículo.
  2. Revisar bloque de comentarios.
  3. Volver a la pestaña tras cambiar visibilidad.
- Esperado:
  - Se muestra conteo o estado vacío correcto.
  - El enlace de añadir comentario apunta al post correcto.
  - El bloque reintenta sincronizar al volver.

### QA-021 Audio artículo

- Ruta: artículo con audio
- Pasos:
  1. Pulsar reproducir.
  2. Probar pausa, seek y velocidad.
- Esperado:
  - El reproductor funciona.
  - Los controles responden.
  - El estado visual cambia correctamente.

### QA-022 Audio hub

- Ruta: `/audios/`
- Pasos:
  1. Abrir página de audios.
  2. Reproducir una pieza.
  3. Probar siguiente, anterior, velocidad y filtros.
- Esperado:
  - El hub funciona sin errores.
  - El progreso y la UI responden.

## Release Risk

### QA-030 Contacto gracias

- Ruta: `/contacto/gracias/`
- Pasos:
  1. Abrir página.
  2. Probar compartir.
- Esperado:
  - Carga standalone correcta.
  - El botón de compartir funciona.

### QA-031 Páginas de soporte

- Rutas: `/404.html`, `/temas/`, una página de autor
- Pasos:
  1. Abrir cada página.
  2. Revisar que no falten scripts ni estilos.
- Esperado:
  - No hay errores de render o JS.

## Regla mínima por tipo de cambio

- Cambio pequeño de contenido o estilos locales:
  - `QA-001` a `QA-007`
- Cambio de JS o layout global:
  - `QA-001` a `QA-020`
- Cambio en audio:
  - `QA-001` a `QA-022`
- Cambio antes de release:
  - Ejecutar todo el documento
