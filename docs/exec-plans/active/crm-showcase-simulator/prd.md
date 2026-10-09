# PRD: Simulador de Actividad Comercial CRM y Enriquecimiento de Storefront

Status: Draft — In Review

## 1. Visión General y Contexto

El catálogo real de EntrenAR (649 productos, 1.119 variantes, 3.790 imágenes y 60 categorías canónicas) ya se encuentra completamente importado, consolidado y verificado. Sin embargo, tras la limpieza de los datos mock anteriores, el sistema carece de actividad transaccional: no existen órdenes, clientes, movimientos de inventario, cupones ni carritos abandonados.

Asimismo, todos los productos tienen `isBestSeller: false` e `isFeatured: false`, por lo que la sección "Más vendidos" de la Home y los "Productos relacionados" en el detalle de producto se encuentran vacíos.

El objetivo de esta funcionalidad es implementar un **simulador de actividad comercial orgánica** que pueble el CRM con datos realistas basados en los 649 productos existentes, alimente las estadísticas del panel de administración y configure el storefront garantizando disponibilidad de stock en secciones destacadas.

---

## 2. Problema a Resolver

1. **CRM y estadísticas vacías:** Los módulos administrativos de Ventas, Clientes, Inventario, Órdenes de Compra y Estadísticas muestran 0 registros o estados en blanco, impidiendo una demostración profesional del panel de control.
2. **Storefront sin dinamismo:** La página principal y el detalle de productos no muestran productos destacados ni más vendidos.
3. **Riesgo de inconsistencia de stock:** Mostrar productos sin stock en carruseles de "Más vendidos" o en "Productos relacionados" perjudica la experiencia de compra y la credibilidad de la tienda.

---

## 3. Objetivos

1. **Generación de actividad comercial realista:** Poblar clientes, órdenes, pagos, recepciones de compras y movimientos de inventario reflejando un negocio fitness en funcionamiento.
2. **Cobertura exhaustiva de estados en CRM:** Incluir todos los estados de órdenes (`CONFIRMED`, `PENDING`, `CANCELLED`), estados de pago (`PAID`, `PENDING`, `REFUNDED`), flujos logísticos (`TO_PACK`, `TO_SHIP`, `SHIPPED`, `DELIVERED`, `PICKUP`) y tipos de movimientos de inventario.
3. **Distribución temporal creíble:** Distribuir las transacciones en una ventana de los últimos 60 días para que los gráficos temporales (diario, semanal, mensual) muestren curvas naturales de ventas y adquisición de clientes.
4. **Regla de oro de stock en storefront:**
   - **Más vendidos (`isBestSeller`):** Seleccionados automáticamente a partir de los productos con mayor volumen de ventas simuladas, **exclusivamente entre aquellos que aún tengan stock disponible** (`quantity > 0` o modo `INFINITE`).
   - **Destacados (`isFeatured`):** Asignados a productos representativos de alta rotación con stock positivo garantizado.
   - **Productos relacionados:** Algoritmo por categoría/marca que filtre y asegure que los productos sugeridos en la ficha de detalle cuenten con stock inmediato para comprar.
   - **Productos sin stock (`quantity = 0`):** No deben aparecer en "Más vendidos" ni en "Relacionados". Quedan reservados para el catálogo general con su badge correspondiente ("Sin stock") o como productos cuyo stock se agotó tras ventas simuladas.
5. **Comando reproducible:** El simulador debe exponerse como un comando CLI idempotente/controlado (ej. `npm run seed:crm-showcase`) que permita repoblar el CRM de forma consistente sin afectar los productos importados ni sus imágenes.

---

## 4. Historias de Usuario y Casos de Uso

### CU-01: Visualización de Home y Detalle con Stock
- **Como** visitante de la tienda,
- **Quiero** ver productos más vendidos en la Home y productos relacionados en la página de producto,
- **Para** descubrir artículos populares que pueda agregar al carrito y comprar de inmediato sin encontrarme con que están agotados.

### CU-02: Gestión Operativa en el Panel de Ventas
- **Como** administrador de EntrenAR,
- **Quiero** ingresar a `/admin/ventas` y ver ventas recientes en diferentes estados (por empaquetar, enviadas, entregadas, canceladas),
- **Para** poder operar los flujos de cambio de estado, notas y seguimiento de pedidos con datos que emulan operaciones reales.

### CU-03: Trazabilidad de Inventario y Abastecimiento
- **Como** encargado de stock,
- **Quiero** ingresar a `/admin/inventario` y ver el historial detallado de movimientos (deducciones por venta, cancelaciones, ingresos por compras a proveedores y ajustes),
- **Para** verificar que el libro mayor de inventario (`InventoryHistory`) concuerde exactamente con el stock remanente de cada variante.

### CU-04: Estadísticas y Métricas Comerciales
- **Como** gerente comercial,
- **Quiero** acceder a `/admin/estadisticas` y ver ingresos acumulados, ticket promedio, clientes recurrentes y uso de cupones con evolución en el tiempo,
- **Para** evaluar el rendimiento simulado del negocio a 7, 30 y 60 días.

---

## 5. Reglas de Negocio e Invariantes

1. **Inmutabilidad del catálogo base:** Los 649 productos, 1.119 variantes, 3.790 imágenes en R2 y las 60 categorías son de solo lectura; el simulador no debe crear, renombrar ni borrar productos o categorías.
2. **Conservación del libro mayor (`InventoryHistory`):** Todo movimiento de stock generado debe registrarse respetando el trigger de solo anexado (`append-only`) de PostgreSQL. Cada deducción de stock por orden confirmada debe tener su correspondiente registro en el historial.
3. **Consistencia de stock:**
   - La cantidad final de una variante en `ProductVariant.quantity` debe ser exactamente igual al stock inicial asignado más las recepciones de órdenes de compra menos las ventas confirmadas más las cancelaciones.
   - Las variantes en modo `INFINITE` no descuentan cantidad numérica pero sí generan eventos comerciales.
4. **Clientes realistas:** Los clientes creados deben tener nombres plausibles de Argentina, teléfonos, emails válidos únicos, DNI/CUIL y direcciones de envío asociadas.
5. **Proveedores y Órdenes de Compra:** Se deben crear proveedores de la industria fitness (suplementos, equipamiento, nutrición) con órdenes de compra en estados `RECEIVED` (las que dieron origen al stock inicial), `ORDERED` y `DRAFT`.
6. **Cupones de descuento:** Crear cupones de porcentaje y monto fijo (ej. `BIENVENIDA10`, `PROMOFIT15`), vinculando parte de las compras a redenciones reales (`CouponRedemption`).

---

## 6. Alcance

- Creación del generador/seeder de datos comerciales (`seed:crm-showcase`).
- Generación de:
  - 15 a 30 clientes con direcciones completas.
  - 60 a 100 pedidos con sus respectivos pagos, envíos e historial de eventos.
  - Proveedores y órdenes de compra de abastecimiento.
  - Movimientos de inventario (`InventoryHistory`) asociados a cada operación.
  - 5 a 10 cupones de descuento con historial de canjes.
  - 5 a 10 carritos abandonados.
- Marcado de banderas comerciales en `Product`:
  - Asignar `isBestSeller: true` a los 8 a 12 productos con mayor volumen de ventas simuladas que mantengan stock positivo.
  - Asignar `isFeatured: true` a 6 a 10 productos destacados con stock positivo.
- Actualización de la lógica del storefront para que "Productos relacionados" (`related`) priorice productos de la misma categoría/marca con stock disponible.

---

## 7. Fuera de Alcance (Non-Goals)

- No se realizarán cobros reales a través de MercadoPago u otras pasarelas.
- No se enviarán correos electrónicos transaccionales reales.
- No se modificará el esquema de Prisma (la base de datos ya cuenta con todos los modelos requeridos).
- No se tocarán los archivos estáticos de imágenes en Cloudflare R2.
- No se creará una interfaz gráfica en el admin para configurar el simulador (se ejecuta vía CLI).

---

## 8. Criterios de Aceptación

1. **Storefront:**
   - La Home muestra el carrusel de "Más vendidos" con productos reales y todos ellos cuentan con stock disponible para compra.
   - En la página de detalle de producto, los "Productos relacionados" muestran productos afines y ninguno de los sugeridos tiene stock en 0.
   - Los productos con stock en 0 aparecen con su estado "Sin stock" en los listados generales, pero no en "Más vendidos".
2. **Panel CRM:**
   - `/admin/ventas` lista pedidos en estados `CONFIRMED`, `PENDING` y `CANCELLED`, con líneas de pedido, pagos y direcciones asociadas.
   - `/admin/clientes` lista clientes con métricas de órdenes y montos gastados mayores a cero.
   - `/admin/inventario` muestra movimientos de venta, cancelación y recepción de compras con trazabilidad completa.
   - `/admin/estadisticas` renderiza gráficos de facturación, ticket promedio y productos líderes sin errores 500 ni datos vacíos.
   - `/admin/cupones` muestra cupones activos con su conteo de redenciones.
3. **Integridad de Base de Datos:**
   - Cero errores de foreign key o violaciones de restricciones de base de datos.
   - Trazabilidad perfecta entre órdenes, pagos, clientes e inventario.
