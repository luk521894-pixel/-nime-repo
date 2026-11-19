# Addons de anime

Este repositorio contiene dos componentes independientes:

- `addon.js`: addon existente para Stremio, servido por `npm start` en el puerto 7000.
- `nuvio-provider/`: proveedor para Nuvio, compilado con `npm run build:nuvio`.

## Instalación

```bash
npm install
```

## Stremio

```bash
npm start
```

Manifiesto local: `http://127.0.0.1:7000/manifest.json`.

## Nuvio

```bash
npm run build:nuvio
PORT=3000 npm run serve:nuvio
```

Manifiesto local: `http://127.0.0.1:3000/manifest.json`.

La documentación específica del proveedor está en [`nuvio-provider/README.md`](nuvio-provider/README.md).
