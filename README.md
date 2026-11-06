# AnimeNuvio 1.0.2 — repositorio de plugins para Nuvio

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

## PlayerZilla

Se usa exactamente el bloque de headers de `extractZillaHLS` del archivo de referencia: `Referer`, `Sec-Fetch-Site`, `Sec-Fetch-Mode`, `Sec-Fetch-Dest` y el User-Agent de Chrome 120 en Windows. No se añade `Origin`, porque no forma parte de los headers de referencia.
