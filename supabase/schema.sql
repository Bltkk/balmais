-- =============================================================================
-- Sistema de Gestión de Inventario (ropa) — Esquema completo para Supabase
-- -----------------------------------------------------------------------------
-- Ejecuta este script en Supabase → SQL Editor → New query → Run.
-- Es idempotente y, para cambios de modelo, hace DROP + recreate de las tablas
-- de dominio (⚠️ borra todos los datos de productos y movimientos).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. LIMPIEZA (para re-ejecutar con cambios de schema)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS stock_movements  CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products         CASCADE;

-- -----------------------------------------------------------------------------
-- 2. TABLAS
-- -----------------------------------------------------------------------------

-- Producto: metadata común (no guarda stock — el stock vive en variants)
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  price       DECIMAL(10, 2) NOT NULL CHECK (price > 0),
  cost        DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  comision    INTEGER        NOT NULL DEFAULT 0 CHECK (comision >= 0),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ⚠️  En instalaciones existentes (sin re-ejecutar este script completo) correr:
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (cost >= 0);

-- Variante por talla: una fila por (producto, talla) con su stock propio
CREATE TABLE product_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size          VARCHAR(20) NOT NULL,
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, size)
);

-- Movimiento de stock: cada entrada/salida afecta a una variante puntual
CREATE TABLE stock_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('in', 'out')),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
  notes       TEXT,
  commission  INTEGER      NOT NULL DEFAULT 0 CHECK (commission >= 0),
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. ÍNDICES
-- -----------------------------------------------------------------------------
CREATE INDEX idx_products_user_id             ON products(user_id);
CREATE INDEX idx_products_code                ON products(code);
CREATE INDEX idx_products_created_at          ON products(created_at DESC);
CREATE INDEX idx_variants_product_id          ON product_variants(product_id);
CREATE INDEX idx_movements_variant_id         ON stock_movements(variant_id);
CREATE INDEX idx_movements_user_id            ON stock_movements(user_id);
CREATE INDEX idx_movements_created_at         ON stock_movements(created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. TRIGGER: updated_at en products
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 5. RPC: registro atómico de movimiento de stock
--    supabase.rpc('register_stock_movement', {
--      p_variant_id: <uuid>, p_type: 'in'|'out',
--      p_quantity: <int>,    p_notes: <text|null>,
--      p_commission: <int|0>
--    })
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_stock_movement(
  p_variant_id UUID,
  p_type       VARCHAR,
  p_quantity   INTEGER,
  p_notes      TEXT    DEFAULT NULL,
  p_commission INTEGER DEFAULT 0
)
RETURNS stock_movements
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_variant    product_variants%ROWTYPE;
  v_owner      UUID;
  v_new_stock  INTEGER;
  v_movement   stock_movements;
BEGIN
  IF p_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'type debe ser "in" o "out"';
  END IF;
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity debe ser mayor a 0';
  END IF;

  SELECT * INTO v_variant FROM product_variants WHERE id = p_variant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variante no encontrada';
  END IF;

  SELECT user_id INTO v_owner FROM products WHERE id = v_variant.product_id;
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_type = 'in' THEN
    v_new_stock := v_variant.current_stock + p_quantity;
  ELSE
    v_new_stock := v_variant.current_stock - p_quantity;
    IF v_new_stock < 0 THEN
      RAISE EXCEPTION 'Stock insuficiente (disponible: %, solicitado: %)',
        v_variant.current_stock, p_quantity;
    END IF;
  END IF;

  UPDATE product_variants SET current_stock = v_new_stock WHERE id = p_variant_id;

  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, commission, user_id)
  VALUES (p_variant_id, p_type, p_quantity, v_new_stock, p_notes, p_commission, auth.uid())
  RETURNING * INTO v_movement;

  RETURN v_movement;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5b. Pagos al vendedor
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendor_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount      INTEGER      NOT NULL CHECK (amount >= 0),
  period_from TIMESTAMPTZ  NOT NULL,
  period_to   TIMESTAMPTZ  NOT NULL,
  notes       TEXT,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vp_user_id ON vendor_payments(user_id);
-- ⚠️ En instalaciones existentes (sin re-ejecutar el script) correr:
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS comision INTEGER NOT NULL DEFAULT 0 CHECK (comision >= 0);
-- ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS commission INTEGER NOT NULL DEFAULT 0 CHECK (commission >= 0);
-- (luego pegar el bloque CREATE OR REPLACE FUNCTION y CREATE TABLE vendor_payments de arriba)

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements  ENABLE ROW LEVEL SECURITY;

-- Products -------------------------------------------------------------------
CREATE POLICY "products_select_own" ON products
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "products_insert_own" ON products
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "products_update_own" ON products
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "products_delete_own" ON products
  FOR DELETE USING (auth.uid() = user_id);

-- Variants (heredan del producto padre) --------------------------------------
CREATE POLICY "variants_select_own" ON product_variants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM products p
            WHERE p.id = product_variants.product_id AND p.user_id = auth.uid())
  );
CREATE POLICY "variants_insert_own" ON product_variants
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM products p
            WHERE p.id = product_variants.product_id AND p.user_id = auth.uid())
  );
CREATE POLICY "variants_update_own" ON product_variants
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM products p
            WHERE p.id = product_variants.product_id AND p.user_id = auth.uid())
  );
CREATE POLICY "variants_delete_own" ON product_variants
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM products p
            WHERE p.id = product_variants.product_id AND p.user_id = auth.uid())
  );

-- Movimientos ----------------------------------------------------------------
CREATE POLICY "movements_select_own" ON stock_movements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM product_variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.id = stock_movements.variant_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY "movements_insert_own" ON stock_movements
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM product_variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.id = stock_movements.variant_id AND p.user_id = auth.uid()
    )
  );

-- Vendor payments RLS ---------------------------------------------------------
ALTER TABLE vendor_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vp_select_own" ON vendor_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vp_insert_own" ON vendor_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vp_delete_own" ON vendor_payments FOR DELETE USING (auth.uid() = user_id);
