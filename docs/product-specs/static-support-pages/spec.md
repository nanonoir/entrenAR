# Static Support Pages Specification

## Purpose

Defines the structure, routing, content presentation, and quality standards for legal and support static pages within the ecommerce platform. Replaces previous loose specs with strict, verifiable requirements and explicit content constraints.

## Requirements

### Requirement: Global Page Presentation

The system MUST render legal and support pages with consistent, high-contrast, accessible typography, avoiding roadmap indicators or placeholder text.

#### Scenario: Visual Hierarchy
- GIVEN a user navigates to any legal or support page
- WHEN the page renders
- THEN the page MUST start with a clear H1 and readable introductory copy
- AND it MUST NOT contain a small accent/eyebrow label above the H1
- AND the body text MUST use high-contrast semantic tokens/classes (foreground/black-level) instead of light gray
- AND it MUST NOT use hardcoded colors

#### Scenario: Production-Ready Content Guard
- GIVEN a user navigates to any legal or support page
- WHEN the page renders
- THEN the page MUST NOT display "placeholder", "coming soon", "próximo flujo", or internal implementation language
- AND legal/policy pages MUST use "Última actualización: junio 2026" instead of placeholder dates like "[fecha]"

#### Scenario: Architecture
- GIVEN the application architecture
- WHEN a static support page is requested
- THEN it SHOULD be rendered as an SSR/static Server Component unless interactive client code is strictly required

### Requirement: Sobre nosotros (About Us) Content

The system MUST present the "Sobre nosotros" page with specific professional, modern ecommerce messaging.

#### Scenario: About Us Presentation
- GIVEN a user views `/nosotros`
- WHEN the content is rendered
- THEN it MUST present EntrenAR as a modern sports ecommerce for apparel/equipment
- AND it MUST focus on a simple, clear, reliable shopping experience with a curated selection
- AND it MUST use a professional, close, modern tone
- AND it MUST NOT invent fake history such as "since 1995"

### Requirement: Contacto (Contact) Portfolio Page

The system MUST render the Contact page as an explicit portfolio-oriented exception rather than ecommerce customer support.

#### Scenario: Contact Page Information
- GIVEN a user views `/contacto`
- WHEN the content is rendered
- THEN it MUST state "Nahuel Nicolas Noir" and "Full Stack Developer"
- AND it MUST include a short message thanking for visiting and inviting contact for similar ecommerce projects
- AND it MUST NOT invent biography, experience, claims, or services list

#### Scenario: Contact Channels
- GIVEN a user views `/contacto`
- WHEN the channel links are rendered
- THEN it MUST show a Portfolio link using `logoNR.svg` pointing to `https://noirnahuel.vercel.app/`
- AND a WhatsApp link using `whatsapp.svg` pointing to the exact provided API URL
- AND a LinkedIn link using `linkedin.svg` pointing to `https://www.linkedin.com/in/nahuelnicolasnoir/`
- AND a GitHub link using `github.svg` pointing to `https://github.com/nanonoir`
- AND all links MUST open in a new tab with safe `rel` attributes

### Requirement: Términos y condiciones Content

The system MUST structure the Terms and Conditions page with specific legal-like ecommerce sections.

#### Scenario: Terms Sections
- GIVEN a user views `/terminos-y-condiciones`
- WHEN the content is rendered
- THEN it MUST include the sections: Uso del sitio, Información de productos, Precios y promociones, Compras y confirmación, Pagos, Envíos, Cambios y devoluciones, Cuenta de usuario, Limitación de responsabilidad, Modificaciones, Última actualización
- AND it MUST NOT claim to provide finalized legal advice

### Requirement: Política de envíos Content

The system MUST structure the Shipping Policy page with specific sections.

#### Scenario: Shipping Sections
- GIVEN a user views `/politicas/envios`
- WHEN the content is rendered
- THEN it MUST include the sections: Cobertura de envíos, Cálculo de costos, Plazos de preparación, Plazos de entrega, Seguimiento del pedido, Datos de entrega, Recepción del pedido, Pedidos no entregados, Responsabilidad logística
- AND it MUST NOT invent specific courier names or false operational promises

### Requirement: Política de devoluciones Content

The system MUST structure the Returns Policy page with specific sections and a CTA.

#### Scenario: Returns Sections
- GIVEN a user views `/politicas/devoluciones`
- WHEN the content is rendered
- THEN it MUST include the sections: Condiciones generales, Plazos para solicitar una devolución, Productos con falla o defecto, Productos sin uso, Costos asociados, Evaluación del producto, Reintegros, Cómo iniciar una solicitud

#### Scenario: Returns CTA
- GIVEN a user views `/politicas/devoluciones`
- WHEN the CTA is rendered
- THEN it MUST display a strong CTA labeled "Iniciar cambio o devolución" pointing to `/cambios-y-devoluciones`
- AND it MUST be styled using semantic tokens equivalent to gray border, black background, and white text
- AND it MUST NOT display a visible "coming soon" or roadmap message (a tiny code comment is permitted)

### Requirement: Política de privacidad Content

The system MUST structure the Privacy Policy page with specific sections.

#### Scenario: Privacy Sections
- GIVEN a user views `/politicas/privacidad`
- WHEN the content is rendered
- THEN it MUST include the sections: Información que podemos recopilar, Uso de la información, Datos de pago, Cookies y tecnologías similares, Conservación de datos, Compartición con terceros, Seguridad de la información, Derechos del usuario, Menores de edad, Cambios en esta política, Última actualización
- AND it MUST NOT name specific third-party providers unless actually integrated

### Requirement: Política de calidad Content

The system MUST render the Quality Policy with a precise, concise focus.

#### Scenario: Quality Text
- GIVEN a user views `/politicas/calidad`
- WHEN the content is rendered
- THEN it MUST state: "Trabajamos con marcas reconocidas y productos que cumplen con las condiciones regulatorias aplicables. En el caso de suplementos, priorizamos productos registrados ante ANMAT, con fecha de vencimiento vigente, empaque en buen estado y almacenamiento adecuado para preservar su calidad."
- AND it MUST NOT make absolute claims like "únicamente" for supplements, as the catalog includes other categories

### Requirement: Footer Links and Socials

The system MUST render footer links accurately without 404s.

#### Scenario: Social Links
- GIVEN a user views the site footer
- WHEN the social section is rendered
- THEN it MUST include a Portfolio link using `logoNR.svg` pointing to `https://noirnahuel.vercel.app/` alongside LinkedIn and GitHub
- AND all social links MUST open in a new tab

#### Scenario: Link Safety
- GIVEN a user views the site footer
- WHEN the support and legal links are rendered
- THEN any out-of-scope or non-existent route links MUST be hidden or disabled to prevent 404 errors

### Requirement: Support Route Navigation

The system MUST link to correct support routes from the Footer Help area and remove deprecated routes.

#### Scenario: Footer Navigation Links
- GIVEN the user is viewing the Footer
- WHEN they look at the Help area
- THEN they MUST see links labeled exactly "Gestión de Pedidos", "Botón de Arrepentimiento", and "Cambios y Devoluciones" pointing to their canonical routes
- AND those Help links MUST use the same same-route scroll-to-top behavior as the other footer navigation links

#### Scenario: Legacy Route Handling
- GIVEN the legacy route `/ayuda/cambios-devoluciones`
- WHEN a user attempts to access `/ayuda/cambios-devoluciones`
- THEN the system MUST return a 404 Not Found
- AND it MUST NOT redirect to another page
