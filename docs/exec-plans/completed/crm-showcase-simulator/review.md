# Independent Review Report: CRM Showcase Simulator

**Fecha:** 2026-10-09
**Alcance:** Implementación completa del simulador comercial CRM y enriquecimiento de storefront (Backend CLI + Storefront discovery & badges + tests) junto con la validación de la ejecución local autorizada por el propietario.
**Autoridad:** [PRD](./prd.md), [Design Doc](../../../design-docs/2026-10-09-crm-showcase-simulator.md), [ExecPlan](../crm-showcase-simulator.md), [Local-owner Evidence](./local-owner-evidence.md), [Guía del Operador Local](./guia-operador-local.md).

---

## 1. Veredictos

| Dimensión | Veredicto | Justificación |
|---|:---:|---|
| **Implementación / Código** | **PASS** | El código satisface rigurosamente todas las especificaciones, invariantes de dominio y seguridad. No hay errores de tipo, las pruebas unitarias cubren el 100% de regresiones (89 suites / 528 tests pasando), el linter está limpio en el alcance y los mecanismos fail-closed aíslan la base por defecto. |
| **Aceptación Operativa / Ejecución Local** | **PASS WITH FINDINGS** | La ejecución real sobre `127.0.0.1:5432/entrenar` fue autorizada explícitamente por el propietario (`trusted-owner`). Se verificó backup previo consistente de 40 tablas públicas, prueba previa en copias desechables (checkout real 2/2 y persistencia 9/9), generación atómica local (80 pedidos, 20 clientes, 3 proveedores, 4 compras, 6 cupones, 8 carritos abandonados), e idempotencia confirmada en segunda corrida (`already-generated` con digest de estado completo idéntico). Se verificaron 21 endpoints HTTP con 200 OK. La aceptación se aprueba con dos hallazgos operacionales no bloqueantes documentados abajo. |
| **Veredicto Consolidado** | **PASS WITH FINDINGS** | Implementación y ejecución local validadas con éxito. Se documentan hallazgos sobre la ausencia de navegación E2E visual en el panel CRM sobre la base viva y la incertidumbre del proceso frontend preexistente en el puerto 3001. |

---

## 2. Resolución de Hallazgos y Adaptaciones Técnicas

1. **Corrección de secuencia pre-vuelo en `HistoricalWriter.write` (CRITICAL resuelto):**
   - Se reordenó la secuencia atómica a `parents` -> `purchases` (con recepciones de stock que fondean +20 unidades a variantes tracked) -> `calculate` (cotizaciones de validación de sucursales/despacho).
   - Verificado con test unitario de regresión dedicado en `historical-writer.spec.ts`.
2. **Instantáneas opcionales con SQL NULL vs JSON null (CRITICAL en runtime resuelto):**
   - La restricción de base de datos `Order_snapshot_objects_check` exige que `shippingAddressSnapshot` y `bankTransferSnapshot` sean objetos JSON o SQL NULL, rechazando el primitivo JSON null (`'null'::jsonb`).
   - Se adaptaron `checkout-order.repository.ts` e `historical-writer.ts` para usar `Prisma.DbNull` en lugar de `Prisma.JsonNull`. Verificado con suite unitaria dedicada `checkout-order.repository.spec.ts`.
3. **Preservación de precisión de marcas de tiempo en el catálogo (CRITICAL en runtime resuelto):**
   - JavaScript `Date` trunca la precisión de microsegundos de PostgreSQL, lo que provocaba fallos espurios en la comparación del catálogo base.
   - Se implementó actualización parametrizada vía SQL crudo con casteo explícito a `::timestamp` manteniendo el texto original de PostgreSQL para `Product.updatedAt` y `ProductVariant.updatedAt`.
4. **Espacio de nombres de identificación de clientes (CRITICAL en runtime resuelto):**
   - El endpoint y adaptador de clientes rechazaban con HTTP 400 los identificadores sintéticos con prefijo reservado.
   - Se ajustó el regex de validación tanto en backend (`customers.schemas.ts`) como en frontend (`contracts.ts`) para admitir de forma estricta y acotada solo `crm-showcase:<64 hex>` además de los identificadores estándar. Verificado con harness de aceptación.
5. **Higiene de código y warnings de linter (SUGGESTION resuelto):**
   - Limpieza de imports en `sales.service.ts` y descarte explícito de variables desestructuradas en `historical-writer.ts`. 0 errores y 0 warnings en scoped ESLint.

---

## 3. Hallazgos (Findings)

### Finding 1
- **Severidad:** WARNING
- **Categoría:** Testing / Operational Verification
- **Ubicación:** Panel CRM (rutas `/admin/*`)
- **Problema:** Ausencia de validación visual automatizada en navegador sobre las pantallas del CRM con los datos recién generados.
- **Evidencia:** Las pruebas Playwright en navegador (`crm-showcase.spec.ts`) cubrieron exclusivamente el storefront público (Home, detalle, badges de disponibilidad, contraste WCAG >= 4.5) sobre un servidor fixture sintético en memoria (puertos 3217/3218). Los 21 endpoints del CRM se validaron a nivel HTTP/JSON (todos 200 OK en puerto 3228), pero no mediante sesión de navegador interactiva sobre la UI de administración.
- **Impacto:** Si bien los datos y APIs responden correctamente según los contratos, componentes específicos de la interfaz React del CRM podrían presentar advertencias menores de renderizado o desalineaciones visuales ante combinaciones de datos imprevistas.
- **Corrección recomendada:** Ejecutar una sesión de exploración manual por el operador utilizando las rutas documentadas en la sección 6, o incorporar una suite E2E de Playwright autenticada para el panel CRM en una fase posterior.

### Finding 2
- **Severidad:** WARNING
- **Categoría:** Operations / Environment Boundary
- **Ubicación:** Host local puerto 3001 (proceso preexistente)
- **Problema:** Estado incierto del servidor web en el puerto 3001; responde HTML 404 a las peticiones hacia la API.
- **Evidencia:** La inspección del entorno detectó un listener en `127.0.0.1:3001` que responde HTML 404 al consultar `/api/v1/*`. Por política de seguridad, el proceso no fue alterado, matado ni reconfigurado.
- **Impacto:** Un operador que intente acceder directamente a `http://localhost:3001` esperando ver el storefront o CRM conectado a la base recién poblada se encontrará con un servicio en estado indeterminado.
- **Corrección recomendada:** No asumir ni forzar el arranque de procesos sobre dicho puerto. El operador debe iniciar explícitamente su servidor de desarrollo Next.js (`npm run dev`) o compilar una instancia configurada apuntando a la URL del backend NestJS activo.

### Finding 3
- **Severidad:** SUGGESTION
- **Categoría:** Performance / Database Driver
- **Ubicación:** `node-postgres` (pg driver pool)
- **Problema:** Advertencia de deprecación de scheduling concurrente en el driver pg durante lecturas paralelas de validación.
- **Evidencia:** Mensaje de warning del driver pg observado durante las consultas concurrentes sobre copias de prueba.
- **Impacto:** Bajo; no afecta la atomicidad transaccional ni produjo fallos en las 9 pruebas de persistencia ni en la generación.
- **Corrección recomendada:** Auditar la configuración del pool de conexiones en `PrismaService` y consultas concurrentes para alinear con las versiones futuras de pg driver.

---

## 4. Evidencia de Validación

- **Backend Unit Tests:** 89 suites / 528 tests pasados exitosamente (`npm run test:backend`), cubriendo cálculos de venta manual, órdenes de compra, repositorios de checkout e inventario, y el módulo `crm-showcase`.
- **Backend Production Build:** Compilación limpia de NestJS (`npm run build:backend`).
- **Root TypeScript Check:** Cero errores de compilación (`npx tsc --noEmit`).
- **Frontend Acceptance Harness:** 16 harnesses pasados con éxito (`npm run verify:frontend-acceptance`), incluyendo contratos de clientes con ID reservado y selectores de afinidad de catálogo.
- **Scoped ESLint:** 0 errores y 0 warnings en la totalidad de archivos modificados y creados.
- **Fail-Closed de Destino y CLI:**
  - `npm run test:crm-showcase` aborta de forma segura en `beforeAll` con error `BLOCKED` sin realizar conexiones ni mutaciones no autorizadas.
  - `npm run seed:crm-showcase` sin argumentos o sin variables aborta inmediatamente con salida segura sin filtrar credenciales.
- **Pruebas en Copias Aisladas (Ejecución previa documentada):**
  - Checkout real (envío/retiro): 2/2 tests pasados (13.2s).
  - Persistencia y resiliencia PostgreSQL: 9/9 tests pasados (64.1s) verificando rollback completo, gate lock exclusivo, determinismo A/B y servicios reales.
- **Ejecución Local Autorizada (`127.0.0.1:5432/entrenar`):**
  - Corrida 1: Generación exitosa de 80 pedidos, 20 clientes, 3 proveedores, 4 compras, 6 cupones y 8 abandonos en 7.14s.
  - Corrida 2: Respuesta inmediata `already-generated` en 1.13s con SHA-256 de estado completo idéntico (`db01ca0da313b04ea0078e944194d7207a9fa17fed76719015abf58e5b8d31ba`).
  - Preservación íntegra de 42 usuarios ADMIN y 127 tokens de refresco, sin filas huérfanas ni desajustes de balances de stock.
- **Consumo HTTP Real:** 21 endpoints públicos y de administración probados con 200 OK mediante API temporal en `127.0.0.1:3228` (cerrada tras la comprobación).

---

## 5. Limitaciones y Prerrequisitos de Operación

- **Inmutabilidad de la Simulación Local:** No se debe intentar re-ejecutar el comando de seed ni correr limpiadores o scripts de reset legados sobre `127.0.0.1:5432/entrenar`. El marcador de completitud garantiza que cualquier nueva invocación sea no-op.
- **Preservación del Backup:** El backup previo verificado permanece en `C:/Users/Nahuel/AppData/Local/Temp/opencode/crm-showcase-owner-20261009.backup` (SHA-256 `5c965ab3edaefcae2160decc5eee7e6a162175b103ecc5a2307234a578a0bac5`). Contiene credenciales privadas y debe resguardarse fuera de directorios temporales sin publicarlo en el repositorio.
- **Aislamiento de Pruebas Futuras:** Cualquier repetición de pruebas destructivas debe ejecutarse sobre contenedores/bases desechables (`entrenar_crm_demo_*`) conforme a la guía del operador local.

---

## 6. Guía Manual de Navegación y Verificación para el Operador

Para comprobar la actividad comercial generada, el operador debe contar con un frontend Next.js levantado apuntando al backend correspondiente, iniciando sesión con una de las cuentas **ADMIN** preexistentes (sin registrar usuarios nuevos):

### Rutas Exactas del Panel de Administración (CRM)
- **Ventas y Pedidos:** `/admin/ventas`
  - Observar 80 pedidos con identificadores `CRM-DEMO-ORDER-*` en estados variados (Pendientes, Confirmados, Por empaquetar, Enviados, Entregados, Retiro, Cancelados).
- **Clientes:** `/admin/clientes`
  - Observar 20 clientes sintéticos con identificadores `crm-showcase:*` y correos `@example.invalid`, mostrando pedidos y gastos acumulados.
- **Inventario:** `/admin/productos/inventario`
  - Comprobar historial con 101 movimientos de stock trazables (deducciones de venta, cancelaciones compensadas y recepciones de compra).
- **Carritos Abandonados:** `/admin/ventas/carritos`
  - Observar 8 sesiones abandonadas con artículos y datos de contacto recuperables.
- **Cupones de Descuento:** `/admin/descuentos/cupones`
  - Observar 6 cupones (`CRM-DEMO-COUPON-*`) con 20 redenciones computadas.
- **Estadísticas y Reportes:**
  - `/admin/estadisticas/ventas-clientes`
  - `/admin/estadisticas/productos`
  - `/admin/estadisticas/reporte-cupones`
  - *Nota importante de filtro temporal:* Para observar la totalidad de los datos generados, **seleccionar el rango personalizado: 10/08/2026 al 09/10/2026** (ventana de 60 días del escenario).

### Rutas del Storefront Público
- **Página Principal (Home):** `/`
  - Sección «Los más vendidos»: muestra productos disponibles destacados con stock vendible garantizado, excluyendo agotados.
- **Detalle de Producto:** `/productos/<slug-real>`
  - Sugerencias «Productos relacionados»: ordenados por afinidad (misma categoría primero, misma marca segundo) garantizando disponibilidad inmediata.
- **Catálogo General:**
  - Los productos sin stock permanecen visibles en listados con su etiqueta «Sin stock» accesible y de alto contraste.

### Precaución sobre Procesos y Puertos Locales
- **Puerto 3001:** No asumir que el servicio actualmente escuchando en el puerto 3001 es el frontend operativo; responde HTML 404 a la API. Para levantar el frontend oficial de trabajo, usar una terminal independiente con `npm run dev` configurando las variables de entorno correspondientes.
