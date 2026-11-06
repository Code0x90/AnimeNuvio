# AnimeNuvio 1.0.3 — repositorio de plugins para Nuvio

Repositorio Nuvio con un proveedor: **AnimeAV1**.

## Contenido
- `manifest.json`: registro del proveedor para Nuvio.
- `providers/animenuvio.js`: implementación del proveedor.

## Flujo
TMDB ID recibido de Nuvio → TMDB external_ids para obtener IMDb → API AnimeAV1 antigua (`/resolve?imdb=...`) → slug → episodio → fuentes Voe y PlayerZilla/HLS-Zilla.

No requiere actualizar `server.mjs` ni instalar dependencias npm.

## Instalación
Para instalarlo como repositorio remoto, publica la carpeta manteniendo esta estructura y agrega la URL RAW de `manifest.json` en Nuvio → Ajustes → Plugins.

El ZIP sirve para revisar o alojar el repositorio; Nuvio normalmente instala repositorios mediante la URL del manifiesto, no importando el ZIP directamente.

## Variantes e idiomas

El proveedor recorre `embeds.SUB` y `embeds.DUB` de forma independiente. Cuando existen ambas variantes, devuelve HLS-Zilla primero y Voe como alternativa, conservando la etiqueta de idioma de cada stream. Si solo existe SUB o DUB, devuelve únicamente esa variante.

## Headers

Se conservan exactamente los headers de los extractores originales: `Referer`, `Sec-Fetch-Site`, `Sec-Fetch-Mode`, `Sec-Fetch-Dest` y el User-Agent de Chrome 120 en Windows. Para Voe, las peticiones al embed y a su redirección JS envían únicamente `User-Agent`; la URL HLS resultante conserva `Referer`, `Sec-Fetch-Site`, `Sec-Fetch-Mode`, `Sec-Fetch-Dest` y `User-Agent`, igual que el extractor original.
