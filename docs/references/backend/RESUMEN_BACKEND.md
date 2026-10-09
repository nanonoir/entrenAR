# EntrenAR — Guía del Backend y Estado del Proyecto (Fases 0 a 10)

Este documento resume la arquitectura, lo que construimos a lo largo de las 10 fases de backend, qué funcionalidades están listas y qué integraciones restan para el lanzamiento final.

---

## 1. La Arquitectura en Simple

EntrenAR utiliza un **Monolito Modular** estructurado en dos partes independientes:

```text
[ Frontend: Next.js 16 (App Router) ]
         │
         │  (Peticiones HTTP / REST con JWT)
         ▼
[ Backend: NestJS 11 ]
   ├── Controllers (Reciben la petición y validan datos con Zod / DTOs)
   ├── Services    (Reglas de negocio: stock, cupones, precios, validaciones)
   └── Prisma ORM  (Comunicación tipada con la base de datos)
         │
         ▼
[ Base de Datos: PostgreSQL 16 ] (Tablas relacionales, constraints, índices)
```

### Principio Fundamental:
**El frontend nunca decide precios, stock ni estados.**  
El frontend solo expresa intención (ej: *"quiero comprar esto"*); el backend autentica, calcula precios oficiales, valida disponibilidad en una transacción atómica y descuenta stock.

---

## 2. Lo que está Implementado (Fases 0 a 10)

| Fase | Módulo | ¿Qué hace? |
|---|---|---|
| **0 y 1** | **Infraestructura Base** | Servidor NestJS 11, conexión a PostgreSQL vía Prisma, Docker local, manejo centralizado de configuraciones y testing. |
| **2** | **Catálogo de Productos** | Gestión de productos, categorías jerárquicas, variantes (talle/color), imágenes y modos de inventario (ilimitado o con stock controlado). |
| **3** | **Cuentas y Autenticación** | Registro y login con tokens JWT seguros (Access y Refresh tokens en cookies seguras), libreta de hasta 6 direcciones por cliente, lista de deseos (*wishlist*) y recuperación de contraseña. |
| **4** | **Configuración Comercial** | Definición de medios de pago (efectivo, transferencia, MercadoPago), medios de envío (Andreani, Correo Argentino), puntos de retiro y motor de cupones de descuento. |
| **5** | **Motor de Checkout** | Cotización autoritativa del carrito (precios y descuentos oficiales), prevención de ventas duplicadas (idempotencia) y creación atómica de la orden descontando stock en la misma transacción. |
| **6** | **Ventas y Stock (CRM)** | Panel de administración de ventas: cambio de estados (Pendiente, Pagado, Enviado, Cancelado), reposición automática de stock en cancelaciones, registro de órdenes de compra a proveedores. |
| **7** | **Clientes (CRM)** | Panel administrativo de clientes: historial de compras, métricas individuales (gasto total, ticket promedio, última compra) y notas internas. |
| **8** | **Carritos Abandonados** | Detección automática de carritos sin finalizar, panel de seguimiento, generación de emails de recuperación y cupones de incentivo. |
| **9** | **Estadísticas y Reportes** | Métricas de negocio calculadas en base de datos: ventas por período, clientes recurrentes, productos más vendidos, alertas de stock bajo y efectividad de cupones. |
| **10** | **Hardening y Desacople** | Eliminación de fugas a datos falsos (*mocks*), switch del frontend a modo API por defecto, límites anti fuerza bruta (*rate limiting*), endpoints de salud (`/health`) y Docker multi-stage para producción. |

---

## 3. ¿Qué está Listo vs. Qué Falta para Producción Real?

### ✅ Listo y Operativo al 100%
- **Toda la lógica de negocio**: Catálogo, usuarios, roles (Admin / Cliente), carrito, órdenes, CRM y reportes.
- **Base de datos real**: Esquema completo en PostgreSQL con migraciones versionadas y datos de prueba (*seeds*).
- **Integración Frontend-Backend**: El panel de administración y la tienda ya consumen la API de NestJS por defecto.
- **Seguridad**: Contraseñas hasheadas con bcrypt, protección contra fuerza bruta en login, CORS multi-origen y sanitización de errores.
- **Infraestructura lista**: `Dockerfile` y `docker-compose.yml` listos para desplegar en un servidor o servicio cloud (Render, Railway, AWS, DigitalOcean).

### ⏳ Pendientes Futuros (Fase Post-Core)
1. **Pasarela de Pago Real (MercadoPago)**: El backend ya tiene los modelos y estados preparados, pero falta conectar el SDK oficial de MercadoPago (Checkout Pro / Webhooks) con credenciales de producción.
2. **Servicio de Emails Transaccionales**: Los templates de emails (recuperación de carrito, confirmación de compra, reset de contraseña) están listos en código; falta conectar un proveedor SMTP real como Resend, SendGrid o AWS SES.
3. **Tracking de Envíos en Tiempo Real**: Conectar las APIs reales de Andreani / Correo Argentino para generar etiquetas y actualizar números de guía automáticamente.
4. **Telemetría Web Real**: Integrar Google Analytics 4 o Mixpanel para reemplazar la simulación de visitas web (`visits.ts`).

---

## 4. Glosario de Términos Técnicos

- **Monolito Modular**: Estructura de backend donde todo el código corre en un único servidor/aplicación, pero está organizado internamente en módulos independientes y ordenados por dominio (catálogo, auth, ventas, clientes). Permite mantener el código simple sin la complejidad innecesaria de microservicios.
- **ORM (Object-Relational Mapping)**: Herramienta de software (en nuestro caso **Prisma**) que traduce tablas y filas de SQL a objetos y tipos de TypeScript en el código. Evita escribir SQL manual propenso a errores tipográficos o inyecciones maliciosas.
- **DTO (Data Transfer Object)**: Objeto plano que define y valida la forma exacta de los datos que viajan entre el cliente y el servidor en una petición HTTP.
- **Patrón Repository / Adapter**: Capa intermedia que desacopla la fuente de datos del resto de la aplicación. Gracias a esto, el frontend puede cambiar de origen (`mock` a `api`) sin modificar las pantallas de la UI.
- **RBAC (Role-Based Access Control)**: Control de acceso basado en roles. Permite restringir endpoints de la API para que solo usuarios con el rol `ADMIN` puedan acceder a las funciones del panel y ningún cliente común pueda consultar datos ajenos.
- **Idempotencia**: Propiedad por la cual una operación produce exactamente el mismo resultado aunque se ejecute múltiples veces. Por ejemplo: si el usuario hace doble clic en "Pagar", el backend procesa la orden una sola vez y no cobra dos veces.
- **Transacción Atómica (ACID)**: Operación de base de datos del tipo *"todo o nada"*. Si una orden requiere guardar la compra, guardar los ítems y descontar stock, y una de esas tres cosas falla, se cancela todo automáticamente (*rollback*) evitando inconsistencias.
- **JWT (JSON Web Token)**: Estándar para transmitir la identidad de un usuario en un token firmado criptográficamente. Usamos dos:
  - *Access Token*: De vida corta (minutos), para autorizar cada llamada a la API.
  - *Refresh Token*: De vida larga (días), guardado de forma segura en cookies `HttpOnly` para renovar la sesión sin pedir usuario y contraseña a cada momento.
- **Rate Limiting (Throttling)**: Mecanismo de defensa que limita la cantidad de peticiones que una misma IP puede hacer en un período de tiempo. Evita ataques de fuerza bruta en logins o saturación del servidor.
- **Soft Delete (Borrado Lógico)**: Técnica donde un registro no se elimina físicamente de la base de datos (con `DELETE`), sino que se marca con una fecha en una columna `deletedAt`. Mantiene el historial de ventas o auditorías intacto aunque un producto o cupón ya no esté activo.
- **Health Check (`/health`)**: Endpoint ligero que los sistemas de monitoreo o balanceadores de carga consultan periódicamente para verificar si el servidor está vivo y si la base de datos responde.
- **AST Guard (Abstract Syntax Tree Guard)**: Test automatizado que analiza el árbol sintáctico del código fuente antes de compilar para prohibir que los componentes importen archivos de prueba o datos falsos.
