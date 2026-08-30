# Integración de comentarios con Discourse fullApp

La web carga cada tema de Discourse dentro de la sección de conversación del
artículo. El navegador mantiene el iframe integrado también cuando el tema
todavía no tiene respuestas; el botón principal de respuesta lo aporta
Discourse dentro del modo fullApp.

## Configuración en Discourse

En la administración del foro:

1. Activa **Embedding** y la opción **Embed Discourse as a full comment system
   on your site** (la configuración embed_full_app).
2. Mantén autorizados estos orígenes:

   - aldeapucela.org
   - otrapucela.org
   - localhost:4000
   - localhost:4173
   - localhost:8000

3. Si las pruebas se hacen con http://127.0.0.1:8000, añade también
   127.0.0.1:8000. localhost y 127.0.0.1 son orígenes distintos.
4. Pega el contenido de discourse-full-app-theme.css en el CSS/SCSS del tema
   del foro y publica el cambio.

La configuración que debe producir el embed es equivalente a:

~~~
window.DiscourseEmbed = {
  discourseUrl: "https://foro.aldeapucela.org/",
  topicId: 2153,
  fullApp: true,
  dynamicHeight: true,
  embedMinHeight: "420",
  embedMaxHeight: "2400",
  embedHeight: "720px",
  lazyLoad: true,
  lazyLoadMargin: "1000",
  colorScheme: "light"
};
~~~

La web ya genera esta configuración desde src/assets/js/comments.js; no hay
que copiar el fragmento de cada artículo. La altura se adapta al contenido
entre 420 y 2400 píxeles: los temas cortos pueden mostrar su respuesta sin
scroll interno y, en los temas largos, el scroll queda dentro del iframe.

## Inicio de sesión y vuelta al tema

Discourse muestra su login/registro cuando una persona anónima intenta
responder. El flujo normal conserva el tema de origen al terminar la
autenticación. Conviene probarlo con una cuenta de prueba real: el navegador
puede abrir el login en una pestaña nueva y las políticas de cookies de
terceros pueden afectar a una sesión dentro de un iframe entre dominios.

Si el iframe no llega a cargar, la web muestra un enlace textual de recuperación
para que nadie quede bloqueado.

## Pruebas mínimas

Para cada origen autorizado, prueba en 390×844 y en escritorio:

- tema sin respuestas y tema con respuestas;
- tema claro y oscuro;
- botón de responder visible dentro del fullApp;
- login, registro y retorno al mismo tema;
- compositor visible después de pulsar responder;
- fallback tras bloquear o hacer fallar la carga del embed.
