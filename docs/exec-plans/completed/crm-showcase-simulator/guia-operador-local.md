# Demo CRM local: uso y verificación

**La simulación ya está generada en `127.0.0.1:5432/entrenar/public`.** No hay que volver a configurar ni cargar datos. Se conservaron los 42 administradores, sus 127 refresh tokens y el catálogo real. La segunda ejecución fue `already-generated` sin cambios. Evidencia completa: [local-owner-evidence.md](./local-owner-evidence.md).

## 1. Abrir la demo ahora

**Backend y frontend dedicados quedaron encendidos para tu prueba manual.** Abrí:

- **Ingresar al panel:** <http://localhost:3300/admin/login>.
- **Tienda:** <http://localhost:3300/>.
- **Producto real de ejemplo:** <http://localhost:3300/productos/adelgafit-colagenfit-limon-360-gs>.
- **Comprobar API:** <http://localhost:3228/api/v1/products?limit=1>.

Usá tu **cuenta ADMIN existente**. El arranque no crea usuarios ni cambia contraseñas; las credenciales no se imprimen ni están incluidas en esta guía. Usá siempre `localhost:3300`, sin alternar con `127.0.0.1`, para conservar el mismo origen/cookies.

El login, Home y producto de ejemplo devolvieron **HTTP 200**. Además, la comprobación de autenticación ya recorre el proxy real: payload vacío → **400 `VALIDATION_ERROR`**; una única solicitud con credenciales deliberadamente inválidas, en contexto aislado de navegador → **401 `INVALID_CREDENTIALS`**, sin tokens ni cookies ADMIN emitidos. **Esto no equivale a validar todas las pantallas CRM después de iniciar sesión ni a probar tus credenciales reales.**

### Si veías «The administrator API is unavailable»

Se corrigió un fallo del transporte compartido ADMIN: el `fetch` nativo del navegador se llamaba como método de un objeto, produciendo **`Illegal invocation` antes de enviar la solicitud**. Ahora se invoca como función independiente. El proxy y el entorno ya apuntaban a 3228; no se atribuyó el problema a un mismatch 3001/3228 sin evidencia.

Los procesos propios se reiniciaron. **Recargá el panel con `Ctrl+F5`** para descartar el código/estado anterior. No ejecutar seed ni reset. `status-manual` ahora comprueba el proxy de autenticación, no solamente el HTML del formulario: debe mostrar `authProxy.reachable: true`, status 400 y code `VALIDATION_ERROR`; ese 400 es esperado porque el chequeo no envía credenciales.

## 2. Encender, comprobar y apagar — PowerShell

Abrí PowerShell. Para comprobar los servidores actuales:

```powershell
$lanzador = Join-Path $env:LOCALAPPDATA "Temp\opencode\crm-owner-manual.cjs"
node $lanzador status-manual
```

Si los apagaste y querés volver a encenderlos:

```powershell
$lanzador = Join-Path $env:LOCALAPPDATA "Temp\opencode\crm-owner-manual.cjs"
node $lanzador serve-manual
```

Esperá el mensaje **`manual-gui-ready`** y abrí las URLs anteriores. El primer arranque puede tardar mientras Next compila. El comando devuelve el control: los servidores quedan en segundo plano, sin ventanas visibles. **No ejecutar seed, configurar datos ni restaurar un backup para encender la web.**

Cuando termines:

```powershell
$lanzador = Join-Path $env:LOCALAPPDATA "Temp\opencode\crm-owner-manual.cjs"
node $lanzador stop-manual
```

Solo detiene los árboles de procesos creados por ese lanzador, comprobando PID y firma de creación para no matar un PID reutilizado. No detiene Docker/PostgreSQL ni procesos preexistentes. Si 3228/3300 ya están ocupados, se niega a iniciar y no mata a sus ocupantes. También se niega a competir con otro `next dev` del mismo repositorio; no borrar su lock para forzar el arranque.

### Dónde mirar si algo falla

Archivos privados en `C:\Users\Nahuel\AppData\Local\Temp\opencode`:

| Archivo | Uso |
|---|---|
| `crm-owner-manual-backend.log` | Arranque/error del backend |
| `crm-owner-manual-frontend.log` | Compilación/error del frontend |
| `crm-owner-manual-processes.json` | PIDs y firma de los procesos propios |
| `crm-owner-manual.cjs` | Lanzador específico de esta máquina |

PIDs posteriores a la corrección verificada: backend **31012**, lanzador frontend **12400**; el frontend puede tener un proceso hijo de Next. Usar `stop-manual`, no comandos por nombre como `taskkill /IM node.exe`. Los PIDs cambian al reiniciar. No publicar logs ni archivos privados, especialmente después de usar autenticación.

### Qué entorno configura el lanzador

No modifica `.env`, `.env.local`, código de aplicación ni configuración de la base. Lee privadamente `backend/.env`, valida que `DATABASE_URL` identifique exactamente la base local aprobada y carga sus secretos JWT/gate antes de iniciar el backend compilado. Comparte **solo** `ADMIN_GATE_SIGNING_SECRET` con el frontend; nunca entrega JWT, contraseña de base o credenciales de storage al navegador.

| Proceso | Configuración efectiva |
|---|---|
| Backend | `node backend/dist/src/main.js`, entorno ya cargado; `NODE_ENV=development`, `PORT=3228`, `FRONTEND_URL=http://localhost:3300`, `CORS_ORIGIN=http://localhost:3300`, `CORS_ORIGINS=http://localhost:3300,http://127.0.0.1:3300` |
| Frontend | `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3300`; salida de desarrollo normal `.next/dev` |
| Datos | `NEXT_PUBLIC_DATA_SOURCE`, `NEXT_PUBLIC_COMMERCE_DATA_SOURCE`, `NEXT_PUBLIC_CHECKOUT_DATA_SOURCE`, `NEXT_PUBLIC_ADMIN_DATA_SOURCE` = `api` |
| Mocks | `NEXT_PUBLIC_USE_MOCK=false` y los flags reales `NEXT_PUBLIC_USE_MOCK_ADMIN_SALES`, `_CUSTOMERS`, `_ABANDONED_CARTS`, `_STATISTICS` = `false` |
| API | Todos los dominios de la lista siguiente apuntan a `http://localhost:3228/api/v1`, prevaleciendo sobre `.env.local` |

Variables de URL establecidas explícitamente: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_CATALOG_API_BASE_URL`, `NEXT_PUBLIC_ACCOUNT_API_BASE_URL`, `NEXT_PUBLIC_COMMERCE_API_BASE_URL`, `NEXT_PUBLIC_CHECKOUT_API_BASE_URL`, `NEXT_PUBLIC_ADMIN_API_BASE_URL`, `NEXT_PUBLIC_ADMIN_SALES_API_BASE_URL`, `NEXT_PUBLIC_ADMIN_CUSTOMERS_API_BASE_URL`, `NEXT_PUBLIC_ADMIN_ABANDONED_CARTS_API_BASE_URL` y `NEXT_PUBLIC_ADMIN_STATISTICS_API_BASE_URL`.

**No iniciar el backend con `node backend/dist/src/main.js` a secas:** su bootstrap valida el entorno antes de que el módulo pueda cargar dotenv. El lanzador ya resuelve esto de forma privada. El equivalente de carga en Node es `node --env-file=backend/.env backend/dist/src/main.js`, pero requiere además los overrides de puerto/CORS y cargar el mismo gate en el frontend; por eso se recomienda el lanzador probado y no copiar secretos a comandos.

## Qué quedó preparado

| Opción | Comportamiento |
|---|---|
| Transferencia manual DEMO | Activa, opción `direct-transfer`; datos bancarios ficticios, **no transferir dinero** |
| Envío manual DEMO | Proveedor existente `andreani`, modalidad domicilio; tarifa ficticia de $100 por banda; sin despacho ni conexión al transportista |
| Retiro ficticio DEMO | Punto existente activo, gratuito; dirección ficticia, **no concurrir** |
| Datos comerciales | 20 clientes, 80 pedidos, 3 proveedores, 4 compras, 6 cupones, 8 abandonos |

Mercado Pago/Stripe no fueron activados. No se cobraron pagos, enviaron mensajes ni alteraron archivos de imágenes. La configuración manual se probó en copias antes de aplicarse localmente.

## Backup privado y protección

Backup anterior a configuración/seed:

`C:\Users\Nahuel\AppData\Local\Temp\opencode\crm-showcase-owner-20261009.backup`

SHA-256: `5c965ab3edaefcae2160decc5eee7e6a162175b103ecc5a2307234a578a0bac5`.

Es un dump PostgreSQL custom con datos privados de autenticación. **No subirlo a Git, compartirlo ni imprimir sus filas.** Guardar una copia privada duradera fuera de una carpeta temporal antes de su limpieza automática. La restauración aislada y la comparación de datos ya fueron verificadas. Nunca restaurar este archivo sobre la fuente local, ejecutar el seed legado, showcase-reset, borrar el marcador o limpiar filas para regenerar.

## Comandos utilizados en esta máquina

Desde la raíz del repositorio, sin incluir credenciales en argumentos:

```bash
npm run build:backend

# Carga manual local autorizada y dos invocaciones CLI.
# YA EJECUTADO: repetir ahora solo produce no-op; no vuelve a configurar con marcador presente.
node "C:/Users/Nahuel/AppData/Local/Temp/opencode/crm-owner-ops.cjs" local

# Comprobaciones SQL y estadísticas por servicios reales, solo lectura.
node "C:/Users/Nahuel/AppData/Local/Temp/opencode/crm-owner-ops.cjs" verify
```

El script operativo es privado, específico de esta máquina y no forma parte del código entregado. Obtiene credenciales sin imprimirlas, comprueba fingerprint y cambios de baseline, y mantiene manifests fuera del repositorio. No editar su estado privado para eludir validaciones. El manifest local está en `C:\Users\Nahuel\AppData\Local\Temp\opencode\crm-owner-local-authorization.json`.

La interfaz estable del proyecto sigue siendo:

```bash
# CRM_SHOWCASE_DATABASE_URL debe entregarse privadamente al proceso, explícitamente.
npm run seed:crm-showcase -- --seed local-owner-demo --reference-date 2026-10-09T15:00:00Z --authorization "<ruta privada absoluta al manifest>"
```

No existe fallback a `DATABASE_URL`. Un marcador válido devuelve `already-generated` aunque cambie la semilla/fecha o el administrador opere ventas. Un marcador inválido o namespace parcial causa rechazo, no reparación.

## Repetir pruebas sin tocar la fuente

Las pruebas consumen copias **desechables**. El contenedor de esta ejecución fue eliminado. Para repetirlas en esta máquina, con el backup y estado privado preservados:

```bash
# Solo restaura copias en un contenedor nuevo, puerto loopback 55439.
# Requiere que entrenar-crm-owner-validation no exista; no modifica la fuente.
node "C:/Users/Nahuel/AppData/Local/Temp/opencode/crm-owner-ops.cjs" prepare-tests

# Checkout real de envío/retiro y replay, sobre su propia copia.
node "C:/Users/Nahuel/AppData/Local/Temp/opencode/crm-owner-ops.cjs" checkout

# Rollback, concurrencia, A/B determinista, servicios reales y rerun.
node "C:/Users/Nahuel/AppData/Local/Temp/opencode/crm-owner-ops.cjs" suite

# Eliminar únicamente el contenedor de pruebas creado por estos comandos.
docker rm --force entrenar-crm-owner-validation
```

Cada suite debe comenzar sobre copias nuevas. Tras consumirlas, restaurar otras con nombres nuevos; no limpiar escenarios ni usar la fuente como fixture. No ejecutar el comando general de integración: esta suite utiliza `jest.crm-showcase.config.js`, sin fallback ni setup destructivo legado.

Para ejecutar sin el script específico, proporcionar privadamente estas variables y usar `npm run test:crm-showcase`:

- A/B: `CRM_SHOWCASE_DATABASE_URL`, `CRM_SHOWCASE_AUTHORIZATION`, sus versiones `_B`, y fingerprints exactos en `CRM_SHOWCASE_DISPOSABLE` / `_B`.
- Checkout: `CRM_SHOWCASE_CHECKOUT_DATABASE_URL`, `CRM_SHOWCASE_CHECKOUT_AUTHORIZATION`, `CRM_SHOWCASE_CHECKOUT_DISPOSABLE`.
- Escenario: `CRM_SHOWCASE_SEED=local-owner-demo`, `CRM_SHOWCASE_REFERENCE_DATE=2026-10-09T15:00:00Z`.

Todos los destinos de pruebas deben ser bases `entrenar_crm_demo_*` aisladas. La base `entrenar` se rechaza antes de construir clientes del fixture.

## Navegación manual

Después de ingresar por <http://localhost:3300/admin/login>, recorrer:

| Qué revisar | URL |
|---|---|
| Ventas/pedidos | <http://localhost:3300/admin/ventas> |
| Clientes | <http://localhost:3300/admin/clientes> |
| Stock e historial | <http://localhost:3300/admin/productos/inventario> |
| Abandonos | <http://localhost:3300/admin/ventas/carritos> |
| Cupones | <http://localhost:3300/admin/descuentos/cupones> |
| Ventas/clientes: métricas | <http://localhost:3300/admin/estadisticas/ventas-clientes> |
| Productos: métricas | <http://localhost:3300/admin/estadisticas/productos> |
| Cupones: métricas | <http://localhost:3300/admin/estadisticas/reporte-cupones> |

La ruta real de detalle del repositorio es **`/productos/<slug-real>`**, plural: se comprobó en `src/lib/data/shop-routes.ts` y con el producto enlazado arriba. No usar `/producto/<slug>`.

Para observar la distribución completa, seleccionar rango **10/08/2026–09/10/2026**. El escenario tiene fecha de referencia fija; no promete ventas "hoy" si se consulta otro día.

Los 21 endpoints reales de la fase operativa se verificaron con una API temporal que se cerró entonces. **Ahora hay un nuevo arranque dedicado en 3228/3300, retenido expresamente para tu prueba manual.** Los procesos preexistentes en 3000/3001 no se cambiaron ni se usan para esta demo. Se verificó arranque, formulario y autenticación inválida a través del proxy; el recorrido autenticado completo queda a tu prueba manual, sin afirmar nueva aceptación visual integral de CRM.

## Autorización y límites

La excepción local necesita `purpose=crm-showcase-trusted-owner-local`, `trustedOwner=true`, fingerprint exacto aprobado, hash de backup, evidencia de restauración aislada, scheduler y dirección conectada verificados, y digest canónico posterior a configuración. Las copias usan `purpose=crm-showcase-demo`, `separateInstance=true`, trusted-owner y la misma evidencia para conservar ADMIN/tokens. La evidencia es atestación del operador, no descubrimiento automático por el CLI.

Sin producción, otros destinos habituales, migraciones, reset o llamadas externas. Ante un rechazo, revisar la evidencia privada; **no borrar datos para intentar de nuevo**.
