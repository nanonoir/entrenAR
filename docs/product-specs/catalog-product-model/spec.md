# Catalog Product Model Specification

## Purpose

Define canonical product behavior.

## Requirements

### Requirement: Universal Sellable Variants

Every Product MUST have a ProductVariant. A simple Product MUST have exactly one `{}` variant and MUST NOT show a selector or `Default`. Products MAY define at most two generic properties. Variants MUST use declared property/value IDs, have unique combinations, and represent only real combinations.

#### Scenario: Simple product
- GIVEN a product without properties
- WHEN it is rendered
- THEN it has one `{}`-attribute variant without a customer selector

#### Scenario: Sparse configurable product
- GIVEN declared Color and Size properties with absent combinations
- WHEN variants are accepted
- THEN only supplied unique combinations exist and missing combinations are not synthesized

#### Scenario: Invalid configuration
- GIVEN zero variants, more than two properties, or an unknown/duplicate attribute combination
- WHEN the product is validated
- THEN validation MUST reject it

### Requirement: Product Pricing and Variant Inventory

Product MUST own positive `price` and optional greater `compareAtPrice`; variants MUST NOT own either. Product MUST NOT own SKU or stock. Variants MUST have globally unique non-empty SKU and own TRACKED non-negative integer quantity or INFINITE stock. Availability and savings MUST derive from variants and Product prices. Zero-stock variants MUST remain unavailable real variants.

#### Scenario: Derived savings
- GIVEN a Product priced 8000 with compare-at 10000
- WHEN listing, cart, or checkout presents it
- THEN it shows the charged price and derived 2000/20% catalog savings

#### Scenario: Inventory rejection
- GIVEN a Product SKU/stock field, a variant price field, duplicate SKU, or invalid tracked quantity
- WHEN the record is validated
- THEN validation MUST reject it

### Requirement: Gallery, Safe Description, and Categories

Imported Products MUST have a gallery of unique-position relative WebP keys `products/{product-slug}/{position}.webp`. A variant MAY reference one image from its Product gallery. Descriptions MUST be sanitized HTML and render safely. Products MAY have multiple existing categories; public and admin contracts MUST expose all.

#### Scenario: Gallery selection
- GIVEN a gallery and a variant primary image in that gallery
- WHEN the variant is selected
- THEN its gallery image is active and resolves from the asset base plus key

#### Scenario: Unsafe media or description
- GIVEN a traversal/foreign-gallery key, duplicate position, missing gallery, or unsafe HTML
- WHEN the product is validated
- THEN validation MUST reject or sanitize it before persistence

#### Scenario: Multiple categories
- GIVEN a Product associated with two categories
- WHEN public or admin catalog data is read
- THEN both categories are exposed
