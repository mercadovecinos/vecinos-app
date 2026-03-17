# Vecinos App — Contexto para Claude Code
> Iteración 14 — Marzo 2026

## El proyecto

**Mercado Vecinos** (`mercadovecinos.cl`) es un negocio de delivery agroecológico en Puerto Varas, Chile. JT es fundador y operador único. Conecta productores locales con consumidores en Los Lagos. Ciclo semanal: pedidos dom–mar, cosecha miércoles, entrega/retiro jueves.

Este repo es una **app de gestión de rutas de delivery** con 3 apps + backend GAS.

---

## Archivos del sistema

| Archivo | Descripción | Deploy |
|---|---|---|
| `vecinos-admin.html` | Dashboard admin, corre local vía `file://` | Local only |
| `vecinos-repartidor.html` | App del repartidor | GitHub Pages + Netlify |
| `vecinos-picker.html` | App del picker (bodega) | GitHub Pages |
| `vecinos-apps-script.js` | Backend Google Apps Script | GAS |

## URLs de deploy

- **GitHub Pages:** `https://mercadovecinos.github.io/vecinos-app/`
- **Netlify:** `vecinoscl.netlify.app`
- **GAS endpoint:** `https://script.google.com/macros/s/AKfycbxJ4dL0-hb8JcsIBNIokE11gyv3XPUHFBv6CgEG79FfdCwemVi0yF1kTkLKXAfs53Kc/exec`
- **Sheet ID:** `1FfHlmN8bAcoN_-sqoYKNni5GvDxAkiPVDoq-aOEWye4`

---

## Arquitectura GAS

**Sheets:** Progreso, Misiones, Vendors, Config, Km, MisionDone, ProdOverrides, ProductMeta, VendorMeta, PickerProgress

**doGet actions:** `paradas`, `misiones`, `vendors`, `km`, `prodOverrides`, `productMeta`, `vendorMeta`, `pickerProgress`, `stops`

**doPost actions:** `update`, `saveMisiones`, `saveVendors`, `newRuta`, `saveKm`, `saveMisionDone`, `saveProdOverrides`, `saveProductMeta`, `saveVendorMeta`, `savePickerProgress`, `resetRuta`

---

## Estado actual de cada app

### vecinos-admin.html
- Tab **Archivo**: sube CSV Shopify, extrae productores, genera ruta, sección de productores con estado recepción + tags C/R/nota por producto. Botón guardar al inicio y al final.
  - `vendorMeta` persiste entre semanas (no se resetea al subir CSV nuevo — solo agrega vendors nuevos con `'—'`).
  - Flag `_csvUploaded` evita race condition: bloquea callbacks async de GAS que podrían sobrescribir `vendorData` después de procesar el CSV.
  - Producto "Tip" (case insensitive) se filtra en todas las vistas.
- Tab **Misiones**: CRUD de misiones semanales.
- Tab **Ruta**: reordenar paradas con drag&drop / flechas. Eliminar parada la marca `sinReparto:true` en prodOverrides (el picker igual la ve y la prepara).
- Tab **Progreso**: fila compacta "Repartidor X/Y" + progreso del picker (preparados/incompletos/pendientes con barra) + misiones + km.
- Tab **Pedidos**: edición de productos por pedido (eliminar, cambiar qty, cambiar dirección).
- Dark mode: slider ☀/🌙 bajo el logo. Clase `html.theme-dark` / `html.theme-light` en `<html>`. Script inline en `<head>` para evitar FOUC.

### vecinos-repartidor.html
- Offline-first con localStorage cache (18h) y sync queue.
- Sistema de misiones con toggle done.
- Tracking de km con envío por WhatsApp. Al resetear ruta, limpia los campos km si GAS devuelve vacío.
- Prod overrides (productos editados/eliminados desde admin). Polling cada 60s — si cambia, muestra banner naranja "El admin actualizó los pedidos".
- Tab **Carga**: muestra estado de preparación del picker (✅ Preparado / ⏳ Incompleto / ❌ No iniciado) por pedido.
- Paradas filtradas (`!p._deleted`) y renumeradas secuencialmente al renderizar (no muestra IDs originales del CSV).
- Header muestra "actualizado HH:MM" al terminar de cargar datos.
- Banner rojo cuando sin conexión.
- Dark mode: slider ☀/🌙 bajo el logo (mismo patrón que admin/picker).

### vecinos-picker.html
- Tab **Resumen**: conteo preparados/pendientes/incompletos con números grandes, barra de progreso, productores por estado, lista "Vienen a dejar".
  - Vendors en lista "Vienen a dejar" son clickeables → confirm → cambia estado a "En bodega" y guarda en GAS.
- Tab **Pedidos**: lista de pedidos con checkbox por producto, filtro por estado, tags C/R/nota visibles, auto-save a GAS (debounce 1.5s).
- Tab **Productores**: tabla por productor con sus productos (de `vendorData`), estado badge, columnas Producto / Etiqueta (Congelar/Refrigerar/nota desde `productMeta`).
- Carga: `paradas` + `vendors` + `vendorMeta` + `productMeta` + `pickerProgress` (5 requests paralelos con timeout 12s de seguridad).
- Polling cada 90s de `prodOverrides` — si cambia, muestra banner naranja "El admin modificó pedidos — Actualizar" (no recarga automático).
- Producto "Tip" filtrado en todas las vistas.
- Dark mode: slider ☀/🌙 bajo el logo (mismo patrón que admin/repartidor).

---

## Estructuras de datos clave

```js
// productMeta keys: "2x Nombre producto||NombreVendor"
// (incluye prefijo de cantidad del CSV de Shopify)
productMeta = { "2x Leche entera||Borlone": { c: false, r: true, nota: "fría" } }

// vendorData: viene de ?action=vendors
vendorData = { "Borlone": ["2x Leche entera", "1x Queso chanco"] }

// vendorMeta: estado recepción
vendorMeta = { "Borlone": "Vienen a dejar" }

// prodOverrides: ediciones del admin sobre pedidos
// sinReparto:true = pedido existe pero NO va en ruta del repartidor (otro canal de entrega)
prodOverrides = { "#1234": { deleted:[0,2], qty:{1:"2 unid."}, sinReparto:true, direccion:"CASA RUDA" } }

// pickerProgress: índices chequeados por pedido
pickerProgress = { "#1234": [0, 2], "#1235": [0, 1, 2] }
```

---

## Patrones de código importantes

### gasGet (fetch + JSONP fallback para móvil)
```js
function gasGet(action, cb) {
  var url = SCRIPT_URL + '?action=' + action + ...;
  var cbDone = false;

  function doJsonp() { /* JSONP fallback con timeout 10s */ }

  // Si fetch no responde en 5s, cae a JSONP
  var fetchTimer = setTimeout(function() {
    if (!cbDone) doJsonp();
  }, 5000);

  fetch(url)
    .then(function(r){ return r.json(); })
    .then(function(data){ clearTimeout(fetchTimer); if(!cbDone){ cbDone=true; cb(data); } })
    .catch(function(){ clearTimeout(fetchTimer); if(!cbDone) doJsonp(); });
}
```

### gasPost (no-cors para móvil)
```js
function gasPost(payload, cb) {
  fetch(SCRIPT_URL, { method:'POST', mode:'no-cors', body: JSON.stringify(payload) })
    .then(function(){ if(cb) cb({ok:true}); })
    .catch(function(){ if(cb) cb(null); });
}
```

---

## Brand

- **Colores:** `--gd:#3d5a40` (verde oscuro), `--gm:#5a8e7d` (verde medio), `--gl:#cdece2` (verde claro), `--or:#f4a259` (naranja), `--ol:#7a9645` (oliva)
- **Tipografía:** Readex Pro (todo) — Yusei Magic solo en títulos del brand, NO en las apps
- **Logo URL:** `https://cdn.shopify.com/s/files/1/0669/2968/8745/files/Logos_Presentation_2.png?v=1772739099`
- **Dark mode:** variables `--bg:#111a11`, `--bg-card:#1b251b`, `--ch:#d8ead8`, `--gl:#1e3028`, `--gp:#1a2e1a`, `--pc:#2e1d08`. Se activa con clase `html.theme-dark` (forzado) o `@media(prefers-color-scheme:dark)` (sistema). Toggle slider ☀/🌙 persiste en `localStorage('vecinos_theme')`.

---

## Workflow semanal

1. Admin → Archivo → subir CSV Shopify
2. Admin → Archivo → setear estado y C/R/nota por productor → Guardar
3. Admin → Pedidos → editar productos si necesario
4. Admin → Ruta → reordenar si necesario
5. Admin → Misiones → agregar misiones
6. Picker abre picker app → chequea productos mientras los prepara
7. Repartidor abre GitHub Pages → completa ruta
8. Admin → Progreso → monitoreo en tiempo real

---

## Notas críticas de deploy

- **GAS:** siempre desplegar como "Nueva versión" + correr `autorizar()`
- **Admin:** corre local desde `file://`, no necesita deploy
- **GitHub:** `git add`, `git commit`, `git push` desde CLI (el repo está en `/Users/jtpetour/Desktop/VecinOPS`)
- **Mobile cache:** hard refresh si la app muestra versión vieja

---

## Validación de sintaxis JS (patrón crítico)

```bash
python3 -c "
import re
with open('archivo.html') as f: content = f.read()
scripts = re.findall(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
with open('/tmp/check.js', 'w') as f: f.write('\n'.join(scripts))
"
node --check /tmp/check.js
```

Siempre correr esto después de editar los HTML.
