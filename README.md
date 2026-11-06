# AnimeNuvio 1.0.1

Proveedor de AnimeAV1 para Nuvio.

## Fuentes
- Voe HLS
- HLS de PlayerZilla / HLS-Zilla (AnimeAV1 suele etiquetar esta fuente simplemente como `HLS`).

## Flujo
TMDB ID -> TMDB external_ids (IMDb) -> API AnimeAV1 antigua (`/resolve?imdb=...`) -> episodio AnimeAV1 -> extracción Voe / PlayerZilla.

## Instalación
Aloja la carpeta del repositorio en un servidor estático y añade en Nuvio la URL RAW/pública del `manifest.json`.

## Configuración
Edita `providers/animenuvio.js` y coloca tu TMDB API Key v3 en `TMDB_API_KEY`.

## Diagnóstico
Los logs usan el prefijo `[AnimeNuvio]`. Si `__data.json` no encuentra fuentes, el proveedor intenta el scraping HTML de respaldo.
