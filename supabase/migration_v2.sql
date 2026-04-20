-- =============================================================================
-- Migración v2 — Categories, Status Labels, Ajuste de Inventario
-- -----------------------------------------------------------------------------
-- Ejecuta este script en Supabase → SQL Editor → New query → Run.
-- Es seguro correr sobre datos existentes: NO hace DROP de tablas.
-- Requisito: schema.sql y hardening.sql ya ejecutados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLA DE CATEGORÍAS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(7)   NOT NULL DEFAULT '#6b7280',
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, user_id)
);

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_own" ON categories;
DROP POLICY IF EXISTS "categories_insert_own" ON categories;
DROP POLICY IF EXISTS "categories_update_own" ON categories;
DROP POLICY IF EXISTS "categories_delete_own" ON categories;

CREATE POLICY "categories_select_own" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories_insert_own" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update_own" ON categories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_delete_own" ON categories FOR DELETE USING (auth.uid() = user_id);

-- Grants
REVOKE ALL ON categories FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- -----------------------------------------------------------------------------
-- 2. COLUMNAS NUEVAS EN PRODUCTS
-- -----------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status              VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER     NOT NULL DEFAULT 5;

-- Constraints nombrados (idempotentes)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check
  CHECK (status IN ('active', 'discontinued'));

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_threshold_check;
ALTER TABLE products ADD CONSTRAINT products_threshold_check
  CHECK (low_stock_threshold >= 0);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status      ON products(status);

-- -----------------------------------------------------------------------------
-- 3. AMPLIAR TIPO EN stock_movements (agregar 'adjustment')
-- -----------------------------------------------------------------------------
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_type_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN ('in', 'out', 'adjustment'));

-- quantity: positivo para 'in'/'out', puede ser negativo para 'adjustment' (bajada)
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_quantity_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_quantity_check
  CHECK (
    (type IN ('in', 'out') AND quantity > 0) OR
    (type = 'adjustment'  AND quantity <> 0)
  );

-- -----------------------------------------------------------------------------
-- 4. RPC: ajuste de inventario atómico con nota obligatoria
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_stock_adjustment(
  p_variant_id UUID,
  p_new_stock  INTEGER,
  p_notes      TEXT
)
RETURNS stock_movements
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_variant  product_variants%ROWTYPE;
  v_owner    UUID;
  v_diff     INTEGER;
  v_movement stock_movements;
BEGIN
  IF p_notes IS NULL OR length(btrim(p_notes)) = 0 THEN
    RAISE EXCEPTION 'La nota es obligatoria para ajustes de inventario';
  END IF;
  IF p_new_stock < 0 THEN
    RAISE EXCEPTION 'El stock no puede ser negativo';
  END IF;

  SELECT * INTO v_variant FROM product_variants WHERE id = p_variant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variante no encontrada';
  END IF;

  SELECT user_id INTO v_owner FROM products WHERE id = v_variant.product_id;
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_diff := p_new_stock - v_variant.current_stock;
  IF v_diff = 0 THEN
    RAISE EXCEPTION 'El conteo ingresado (%) es igual al stock actual', p_new_stock;
  END IF;

  UPDATE product_variants SET current_stock = p_new_stock WHERE id = p_variant_id;

  -- quantity es el delta firmado: positivo = subió, negativo = bajó
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id)
  VALUES (p_variant_id, 'adjustment', v_diff, p_new_stock, p_notes, auth.uid())
  RETURNING * INTO v_movement;

  RETURN v_movement;
END;
$$;

REVOKE EXECUTE ON FUNCTION register_stock_adjustment FROM anon;
GRANT  EXECUTE ON FUNCTION register_stock_adjustment TO authenticated;

-- -----------------------------------------------------------------------------
-- Verificación final
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '✓ Migración v2 aplicada: categories, status, low_stock_threshold, register_stock_adjustment.';
END;
$$;
