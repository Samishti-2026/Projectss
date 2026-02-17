-- SQL Script to create the Autosuggestion Materialized View
-- Run this in pgAdmin Query Tool

-- 1. Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS mv_search_suggestions CASCADE;

-- 2. Create the Materialized View
-- This query aggregates text columns from customers, products, and categories
CREATE MATERIALIZED VIEW mv_search_suggestions AS
 SELECT DISTINCT customers.email AS value,
    'customers'::text AS collection,
    'email'::text AS field
   FROM customers
  WHERE (customers.email IS NOT NULL)
UNION
 SELECT DISTINCT customers.phone AS value,
    'customers'::text AS collection,
    'phone'::text AS field
   FROM customers
  WHERE (customers.phone IS NOT NULL)
UNION
 SELECT DISTINCT customers.region AS value,
    'customers'::text AS collection,
    'region'::text AS field
   FROM customers
  WHERE (customers.region IS NOT NULL)
UNION
 SELECT DISTINCT customers.zone AS value,
    'customers'::text AS collection,
    'zone'::text AS field
   FROM customers
  WHERE (customers.zone IS NOT NULL)
UNION
 SELECT DISTINCT products.name AS value,
    'products'::text AS collection,
    'name'::text AS field
   FROM products
  WHERE (products.name IS NOT NULL)
UNION
 SELECT DISTINCT categories.name AS value,
    'categories'::text AS collection,
    'name'::text AS field
   FROM categories
  WHERE (categories.name IS NOT NULL);

-- 3. Create Indexes for Performance
-- Enable pg_trgm for GIN index (trigrams)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable btree_gin to allow standard columns (collection, field) in GIN index
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Composite GIN Index: fast filtering by collection/field AND text search in one go
CREATE INDEX idx_mv_suggestions_combined 
ON mv_search_suggestions USING GIN (collection, field, value gin_trgm_ops);

-- UNIQUE Index (Required for CONCURRENT refresh)
CREATE UNIQUE INDEX idx_mv_suggestions_unique 
ON mv_search_suggestions (collection, field, value);

-- 4. Refresh Command (Usage)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_suggestions;

-- 4. Verify Creation
SELECT * FROM mv_search_suggestions LIMIT 20;
