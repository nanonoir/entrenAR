# PRD: Simulador de Actividad Comercial CRM y Enriquecimiento de Storefront

Status: Approved — 2026-10-09

## 1. Objetivo y contexto

Poblar una base demo aislada con actividad comercial coherente y operable sobre el catálogo real importado, y mejorar el descubrimiento de productos disponibles en el storefront. Priorizar variedad y trazabilidad sobre una simulación económica compleja.

La baseline verificada contiene 649 productos, 1.119 variantes, 3.790 imágenes y 60 categorías. Estos números describen el catálogo importado, no autorizan recrearlo. El generador debe inspeccionar sus datos y validar los prerrequisitos antes de escribir. La Home usa `isBestSeller`; los relacionados actuales dependen de destacados globales. No existe una sección independiente de destacados en la Home.

## 2. Alcance y decisiones aprobadas

### Excepción local aprobada por el propietario — 2026-10-09

Se autoriza expresamente `127.0.0.1:5432/entrenar`, esquema público, NO producción, para configurar opciones manuales ficticias existentes de pago/envío/retiro e inyectar una única simulación. Antes de cualquier escritura local se exige backup privado nuevo con hash e identidad exacta y restauración verificada en copia aislada. La autorización trusted-owner debe vincular fingerprint exacto y evidencia del backup/restauración; no debilitar la política aislada por defecto ni introducir fallback implícito. Las cuentas ADMIN y sus tokens legítimos se conservan íntegros y no son contaminación bloqueante. Conservar catálogo real, estructura e imágenes; no borrar filas, resetear ni restaurar sobre la fuente local. Checkout real seguro y pruebas destructivas únicamente en copias restauradas. Registrar baseline después de configurar, validar integridad y segunda ejecución sin cambios. Si existe marcador válido, informar no-op sin limpiar. Sin pasarelas, llamadas externas, nuevos esquemas/migraciones ni commits. Esta aprobación sustituye restricciones anteriores incompatibles sobre fuente local, datos administrativos y configuración comercial, no las garantías de atomicidad, privacidad e idempotencia.

### Generador comercial

- CLI independiente `npm run seed:crm-showcase`, dentro del backend y desacoplada del seed y showcase-reset existentes.
- Generación inicial atómica y determinista para la misma baseline, semilla y fecha de referencia explícita. Una segunda ejecución sobre la base ya generada no modifica ningún dato, incluso si el administrador operó los registros.
- Identificación inequívoca de datos simulados mediante campos existentes; no agregar modelos ni migraciones. No actualizar snapshots comerciales inmutables ni borrar historial.
- Reconstruir el escenario únicamente restaurando un backup de la base demo. Sin reset selectivo, limpieza automática ni reconciliación destructiva.
- 15–30 clientes ficticios con direcciones, 60–100 pedidos con líneas, pagos, snapshots e historial comercial coherente.
- 2–4 proveedores ficticios y 3–5 compras que incluyan `DRAFT`, `ORDERED` y `RECEIVED`.
- 5–10 cupones de porcentaje y monto fijo, con descuentos, redenciones y contadores consistentes.
- 5–10 carritos abandonados visibles y sesiones de checkout coherentes para los pedidos de checkout y los abandonos. No generar miles de sesiones para perseguir una conversión arbitraria.
- Actividad distribuida en los últimos 60 días respecto de la fecha de referencia, incluyendo pedidos pagados no cancelados hoy, en la semana actual y en los últimos 30 días. Clientes con múltiples compras alimentan reportes existentes, sin introducir un KPI de recurrencia.
- Cobertura de estados de orden `PENDING`, `CONFIRMED`, `CANCELLED`; pago `PENDING`, `PAID`, `REFUNDED`; logística `TO_PACK`, `TO_SHIP`, `SHIPPED`, `DELIVERED`, `PICKUP` y cancelación cuando corresponda. Generar combinaciones válidas según la máquina de estados, no un producto cartesiano de estados. Los retiros permanecen en `PICKUP` según el comportamiento existente.
- Cubrir deducciones, recepciones y restituciones compensatorias pertinentes. No exigir todos los tipos posibles de movimiento.

### Storefront

- Marcar 8–12 productos como más vendidos según unidades de pedidos simulados `PAID` no cancelados, entre productos disponibles; desempate determinista.
- Marcar 6–10 productos representativos disponibles como destacados. No crear una nueva sección en la Home.
- Aplicar filtros permanentes de disponibilidad en más vendidos y relacionados, no solamente al generar datos.
- Relacionados: hasta cuatro productos distintos del actual, priorizando misma categoría y luego misma marca; sin duplicados, orden determinista y únicamente productos públicos vendibles. Si no existen suficientes afines disponibles, mostrar menos, sin completar con productos arbitrarios sin afinidad. El diseño precisará la comparación de categorías con la taxonomía real.
- Mantener productos agotados en el catálogo general y mostrar badge accesible «Sin stock» en las tarjetas. No impedir consultar su detalle.

## 3. Invariantes funcionales y de datos

### Preservación del catálogo

Conservar identidades, productos, variantes, relaciones, categorías, marcas, precios, slugs, descripciones, modos de stock e imágenes. Únicamente se autorizan modificaciones necesarias de `ProductVariant.quantity` y banderas `isBestSeller` / `isFeatured`. No modificar archivos en R2 ni reconstruir el catálogo mock.

### Inventario

- El stock importado es el saldo inicial; no atribuirlo retrospectivamente a compras ficticias ni ponerlo a cero para reconstruirlo.
- Cada compra recibida simulada incrementa realmente las existencias de sus variantes tracked y registra su recepción. Las compras no recibidas no afectan el saldo.
- Descontar según el flujo real: checkout descuenta al crear un pedido incluso `PENDING`; una venta manual confirmada descuenta al crearse. Confirmar un pendiente no vuelve a descontar.
- Una cancelación solo suma stock si se aplicó restitución. Registrar un movimiento compensatorio asociado a la deducción original, sin modificarla ni eliminarla.
- Para cada variante tracked afectada: saldo final = saldo importado + recepciones + ajustes netos − deducciones + restituciones aplicadas. No permitir saldo negativo ni movimientos ficticios para cuadrar cantidades.
- Las variantes `INFINITE` conservan cantidad nula y modo infinito. Sus ventas generan órdenes/líneas, pero no deducciones ni restituciones numéricas en `InventoryHistory`, conforme al servicio existente.
- Respetar el ledger append-only y todas las restricciones de snapshots. Los timestamps históricos definitivos se insertan desde el inicio; no retrofechar mediante actualizaciones posteriores.

### Órdenes, sesiones y descuentos

- Importes, precios de snapshot, cantidades, descuentos y totales coherentes con las reglas existentes; nunca confiar en cálculos del frontend.
- Fechas cronológicas: creación anterior o igual a confirmación, envío, entrega o cancelación, según corresponda; ninguna fecha futura respecto de la referencia.
- Direcciones de envío cuando corresponde y separación correcta de retiro/envío. Enlaces entre cliente, líneas, pago, eventos y sesión sin referencias huérfanas.
- Sesiones completas enlazadas a sus órdenes y sesiones abandonadas con snapshots compatibles con el lector actual. Datos de recuperación y hashes sintéticos válidos, sin envío de mensajes.
- Cupones válidos al momento de uso, snapshots de descuento consistentes y `usageCount` igual a redenciones conforme a las reglas existentes. No duplicar un canje por cupón/pedido.
- Estadísticas actuales califican pedidos por `Order.createdAt`, pago `PAID` y estado distinto de `CANCELLED`; la distribución y el ranking deben respetarlo. Las sesiones deben hacer explicable la conversión existente.

### Seguridad y atomicidad

- Solo permitir ejecución en una base local/demo explícitamente identificada y autorizada. Rechazar producción, destinos ambiguos y configuración incompleta antes de escribir; no basta confiar en `NODE_ENV`.
- No usar implícitamente la URL de la base habitual para las pruebas. Validación de persistencia sobre una copia demo aislada, preservando la fuente.
- Detectar simulación existente y evitar escrituras en la segunda ejecución. Detectar colisiones, estado parcial incompatible y prerrequisitos insuficientes antes de mutar; no repararlos automáticamente.
- Proteger contra ejecuciones concurrentes que dupliquen registros. Ante fallo, rollback completo de la generación, incluyendo stock y flags.
- Emails únicos en dominio reservado para ejemplos; teléfonos, DNI/CUIL y direcciones claramente sintéticos, sin reutilizar datos personales reales. Nombres plausibles de Argentina.
- Sin cobros, correos, notificaciones ni llamadas a R2. Evitar exponer credenciales en reportes/logs.
- Verificar que showcase-reset programado esté deshabilitado en la demo usada; no reutilizar restauradores ligados al catálogo mock.

## 4. Casos de uso y superficies reales

| Caso | Superficie | Resultado esperado |
| --- | --- | --- |
| Descubrimiento | `/` y detalle de producto | Más vendidos y relacionados disponibles; afinidad simple en relacionados |
| Gestión comercial | `/admin/ventas` | Pedidos variados operables, pagos e historial coherentes |
| Clientes | `/admin/clientes` | Clientes ficticios con compras y métricas existentes |
| Inventario | `/admin/productos/inventario` y sus historiales | Deducciones, recepciones y restituciones trazables |
| Compras | Rutas existentes de órdenes de compra/proveedores | Borradores, pedidos y recepciones coherentes |
| Cupones | `/admin/descuentos/cupones` | Cupones activos y contadores de canjes |
| Abandonos | `/admin/ventas/carritos` | 5–10 abandonos visibles con snapshots válidos |
| Métricas | `/admin`, `/admin/estadisticas/ventas-clientes`, `/admin/estadisticas/productos`, `/admin/estadisticas/reporte-cupones` | Ingresos, ticket promedio, líderes y uso de cupones sin errores |

Usar los períodos existentes: semana actual, últimos 30 días, últimos 90 días y rango personalizado para 60 días. No agregar selectores de 7/60 días ni KPI de clientes recurrentes. No prometer poblar reportes de visitas ni todos los períodos históricos con actividad inexistente.

## 5. Fuera de alcance

Migraciones, nuevas tablas, nuevos KPIs, motor genérico de simulación o recomendaciones, interfaz de configuración del generador, reset selectivo, reconstrucción del historial de todo el catálogo, modificaciones del seed/reset legado, operaciones sobre producción, integraciones externas y sección nueva de destacados en Home.

## 6. Criterios de aceptación verificables

1. **Seguridad:** destinos no autorizados, producción y configuraciones ambiguas fallan antes de escribir. La ejecución de validación identifica una base demo distinta de la fuente sin revelar secretos.
2. **Atomicidad:** un fallo inyectado después de escrituras deja el mismo estado previo en entidades comerciales, stock y flags. Ejecuciones concurrentes no duplican actividad.
3. **Idempotencia:** segunda ejecución informa que el escenario ya existe y no altera filas, timestamps, cantidades, contadores ni operaciones posteriores del admin. No elimina `InventoryHistory` ni actualiza snapshots protegidos.
4. **Reproducibilidad:** misma baseline, semilla y fecha producen iguales identidades, distribución, importes y balances en dos bases aisladas limpias.
5. **Catálogo:** comparación antes/después confirma preservación de información estructural, relaciones, precios, modos de stock e imágenes; solo cambian existencias autorizadas y flags.
6. **Integridad:** 15–30 clientes y 60–100 pedidos; sin violaciones de FK/unique/triggers, referencias huérfanas ni totales inválidos. Incluye estados requeridos en combinaciones válidas.
7. **Inventario:** balances comprobados para todas las variantes afectadas; movimientos con referencias comerciales resolubles y compensaciones válidas; `INFINITE` intacto; compras no recibidas sin efecto en stock.
8. **Operabilidad CRM:** desde los servicios/endpoints reales se puede confirmar un pendiente sin doble descuento, cancelar una venta elegible con restitución única y recibir una compra pendiente con incremento correcto. Navegación real verifica listas y detalles sin errores 500.
9. **Estadísticas:** endpoints/reportes existentes muestran ingresos, ticket y líderes positivos para la distribución acordada; cupones con canjes visibles y conversión consistente con sesiones. Clientes con compras tienen métricas positivas según la calificación existente.
10. **Abandonos y cupones:** 5–10 abandonos visibles; 5–10 cupones, incluidos porcentaje/monto fijo, con snapshots y conteos consistentes. Ningún envío ni cobro real.
11. **Storefront:** Home excluye agotados aunque mantengan flag; relacionados excluyen producto actual/duplicados/agotados y respetan afinidad. Agotar todas las variantes de un producto lo excluye en la siguiente consulta fresca; una variante vendible mantiene elegibilidad. El catálogo conserva tarjetas agotadas con badge «Sin stock». La validación backend sigue siendo autoridad ante cambios concurrentes de stock.
12. **Entrega:** pruebas focalizadas y validación integral en demo aislada, revisión independiente sin bloqueantes, instrucciones del comando/backup/restauración y evidencia de resultados. No declarar éxito de validaciones no ejecutadas.
