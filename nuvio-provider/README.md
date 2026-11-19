# Proveedor Nuvio para anime

Este directorio contiene el proveedor Nuvio añadido al repositorio. El addon original de Stremio permanece en `../addon.js`.

## Compilar

Desde la raíz del repositorio:

```bash
npm install
npm run build:nuvio
```

El artefacto generado es `nuvio-provider/providers/mianime.js`.

## Probar en Nuvio

Sirve la raíz del repositorio con un servidor HTTP y usa el manifiesto:

```bash
npm run serve:nuvio
# http://TU_HOST:3000/nuvio-provider/manifest.json
```

Las búsquedas se basan en el identificador recibido por Nuvio. Si una fuente no responde o cambia su HTML, el proveedor la omite y continúa con las demás. Las expresiones de extracción están aisladas en `src/mianime/extractors.js` para facilitar su ajuste.

## Nota técnica

Las fuentes y los selectores deben mantenerse conforme a los permisos y a la estructura vigente de cada sitio. El build transpila el código a ES2016 para compatibilidad con Hermes.
