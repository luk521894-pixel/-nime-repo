# Proveedor Nuvio para anime

Este directorio contiene el proveedor Nuvio añadido al repositorio. El addon original de Stremio permanece en `../addon.js`.

## Compilar

Desde la raíz del repositorio:

```bash
npm install
npm run build:nuvio
```

El artefacto generado es `providers/mianime.js`.

## Probar en Nuvio

El repositorio se instala usando `nuvio-provider/manifest.json`. El provider compilado está en `nuvio-provider/providers/mianime.js`.

El extractor activo resuelve el título desde TMDB, localiza el anime y el episodio en Latanime, decodifica sus botones de reproductor y devuelve únicamente los reproductores reconocidos. Ya no devuelve iframes publicitarios ni enlaces genéricos como si fueran streams.

AnimeAV1 y TodoAnime quedan aislados hasta que sus endpoints y reproductores puedan validarse de forma específica. Es preferible devolver cero resultados de una fuente no verificada antes que mostrar servidores que no reproducen.

## Servir localmente

```bash
PORT=3000 npm run serve:nuvio
```

Para el Plugin Tester usa el manifiesto local `http://TU_IP_LOCAL:3000/manifest.json` o el archivo compilado `http://TU_IP_LOCAL:3000/providers/mianime.js`, según la pestaña que utilices.
