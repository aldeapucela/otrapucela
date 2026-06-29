# Matomo Events

La instrumentacion de modulos usa `trackEvent(category, action, name, value)` con:

- `category`: familia funcional (`modules`, `article_engagement`, `audio`, `share`, `subscription`)
- `action`: nombre estable del evento
- `name`: JSON compacto con contexto
- `value`: numero opcional

## Contexto comun en `name`

```json
{
  "page_type": "article",
  "device_type": "mobile",
  "article_slug": "slug-del-articulo",
  "article_length_bucket": "long"
}
```

Campos extra segun evento:

- `module_location`
- `module_variant`
- `destination`
- `subscription_source`
- `share_source`
- `share_target`
- `article_id`
- `audio_action`

## Modules

- `view_inline_mid_article`
- `click_inline_mid_article`
- `view_inline_end_article`
- `click_inline_end_article`
- `view_header_cta`
- `click_header_cta`
- `view_sticky_returning_prompt`
- `click_sticky_returning_prompt`
- `view_related`
- `click_related`
- `view_most_read`
- `click_most_read`
- `click_topic_chip`
- `click_next_article`

Las `view_*` se disparan con `IntersectionObserver` y se deduplican una vez por pageview.

## Article engagement

- `scroll_25`
- `scroll_50`
- `scroll_75`
- `scroll_90`
- `time_30s`
- `time_90s`

Todos se disparan una sola vez por pageview.

## Audio

- `play_article_top`
- `play_article_sticky`
- `play_audiohub`
- `complete_article_top`
- `complete_article_sticky`
- `complete_audiohub`
- `download_article_top`
- `download_article_sticky`
- `download_audiohub`

En audio hub se añade `audio_action` al contexto para diferenciar reproduccion, descarga y completado.
