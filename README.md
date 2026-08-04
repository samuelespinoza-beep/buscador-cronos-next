# Buscador de Impresos Cronos

Buscador de texto sobre las ediciones impresas digitalizadas de Cronos. Permite buscar
por palabras o por frase exacta, filtrar por rango de fechas, y ver la página escaneada
del ejemplar con las coincidencias resaltadas y una lupa para leer el texto original.

Las coordenadas de cada coincidencia las provee el OCR del backend: vienen como valores
relativos (0..1) y la aplicación las convierte a píxeles sobre la imagen mostrada.

## Requisitos

| | Versión |
|---|---|
| Node.js | **22.x LTS** — está en [.nvmrc](.nvmrc); el mínimo que exige Next 16 es `>=20.9.0` |
| npm | 10.x o superior |
| PM2 | 6.x (sólo para desplegar) |

## Puesta en marcha

```bash
npm ci                  # instala exactamente lo del package-lock.json
cp .env.example .env    # y completar los valores del ambiente
npm run dev             # http://localhost:3000
```

El buscador está en la raíz: `http://localhost:3000`.

## Configuración

Todas las variables van en `.env`, sin excepción. Ver [.env.example](.env.example) para la
plantilla con las URLs de cada ambiente.

| Variable | Para qué sirve |
|---|---|
| `PRINTED_GRAPHQL_URL` | GraphQL de Cronos Printed, destino de las búsquedas |
| `PRINTED_REST_API_URL` | API REST de Cronos Printed, destino de las coordenadas del OCR |
| `PRINTED_TOKEN_ID` | Se envía como header `token_id` al GraphQL |
| `PRINTED_SEARCH_API_KEY` | Se envía como header `X-Api-Key` al REST |
| `PORT` | Puerto de la aplicación (3000 por defecto) |

**No hay valores por defecto en el código.** Si falta alguna variable, los endpoints
responden `503 Buscador mal configurado` y el log del servidor indica cuál falta. Es
deliberado: un valor por defecto apuntando a producción haría que un ambiente mal
configurado consultara datos reales sin que nadie se enterara.

**Ninguna variable lleva el prefijo `NEXT_PUBLIC_`.** Ese prefijo hace que Next escriba
el valor dentro del bundle del navegador, donde cualquiera puede leerlo con Ver código
fuente. Las credenciales se agregan del lado del servidor (ver Arquitectura).

## Arquitectura

El navegador nunca habla con el backend de Cronos ni conoce sus credenciales. Todo pasa
por dos route handlers que corren en el servidor y agregan las cabeceras:

| Ruta | Qué hace |
|---|---|
| `/` | El buscador (componente cliente) |
| `POST /api/search` | Recibe `{ mode, keyword, page, start, end }`, traduce `mode` a una de sus dos queries GraphQL y agrega el `token_id` |
| `POST /api/coordinates` | Recibe `{ mode, ocr_coordinates, keyword }`, traduce `mode` a un endpoint del REST y agrega la `X-Api-Key` |

Los dos aceptan un **modo**, no una query ni un path: el cliente no puede pedirle al
backend nada que no esté declarado en el route handler.

Las imágenes de las páginas son la excepción: el navegador las descarga **directo** del
bucket (`larepublica.cronosmedia.glr.pe`), sin pasar por la aplicación. La URL se deduce
del campo `document` reemplazando `_compress.pdf` por `.jpg`, porque el backend no
devuelve un campo con la URL de la imagen.

## Despliegue

```bash
nvm use          # toma la versión de .nvmrc
npm ci
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup      # ejecutar el comando que imprima, para que sobreviva reinicios
```

Comandos útiles: `pm2 logs search-printed-cronos`, `pm2 restart search-printed-cronos`,
`pm2 status`.

### Requisitos del ambiente

- **Nginx** como reverse proxy hacia `127.0.0.1:3000`, con certificado SSL.
- **Salida de red** desde el servidor hacia los hosts de `PRINTED_GRAPHQL_URL` y
  `PRINTED_REST_API_URL`.
- **Acceso desde el navegador del usuario** a `larepublica.cronosmedia.glr.pe`, porque las
  imágenes se descargan directo del bucket. Si el bucket no es legible públicamente, las
  páginas no se ven aunque las búsquedas funcionen.
- El archivo `.env` se crea en cada servidor o lo inyecta el pipeline: está en
  `.gitignore` y no viaja en el repositorio.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm start` | Sirve el build (requiere `npm run build` antes) |
| `npm run lint` | ESLint |
