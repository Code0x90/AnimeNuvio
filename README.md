# AnimeNuvio — repositorio de plugins para Nuvio

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
