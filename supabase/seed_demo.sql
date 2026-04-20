-- =============================================================================
-- Datos de demo — Tienda de ropa ficticia
-- -----------------------------------------------------------------------------
-- Instrucciones:
--   1. Ve a Supabase → Authentication → Users y copia tu UUID de usuario.
--   2. Reemplaza 'PASTE-YOUR-USER-UUID-HERE' con ese UUID.
--   3. Ejecuta en Supabase → SQL Editor → New query → Run.
--
-- Incluye: 6 productos, 4 tallas cada uno, ~100 movimientos en 6 meses.
-- =============================================================================

DO $$
DECLARE
  uid UUID := 'PASTE-YOUR-USER-UUID-HERE';

  -- Product IDs
  p1 UUID; p2 UUID; p3 UUID; p4 UUID; p5 UUID; p6 UUID;

  -- Variant IDs — product 1 (Polera)
  p1_xs UUID; p1_s UUID; p1_m UUID; p1_l UUID; p1_xl UUID;
  -- Variant IDs — product 2 (Jeans)
  p2_28 UUID; p2_30 UUID; p2_32 UUID; p2_34 UUID; p2_36 UUID;
  -- Variant IDs — product 3 (Parka)
  p3_s UUID; p3_m UUID; p3_l UUID; p3_xl UUID;
  -- Variant IDs — product 4 (Hoodie)
  p4_s UUID; p4_m UUID; p4_l UUID; p4_xl UUID;
  -- Variant IDs — product 5 (Shorts)
  p5_s UUID; p5_m UUID; p5_l UUID; p5_xl UUID;
  -- Variant IDs — product 6 (Chaqueta Denim)
  p6_s UUID; p6_m UUID; p6_l UUID; p6_xl UUID;

BEGIN
  -- Validación del UUID ingresado
  IF uid::text = 'PASTE-YOUR-USER-UUID-HERE' THEN
    RAISE EXCEPTION 'Debes reemplazar PASTE-YOUR-USER-UUID-HERE con tu UUID real de Supabase Auth.';
  END IF;

  -- ===========================================================================
  -- PRODUCTOS
  -- ===========================================================================
  INSERT INTO products (code, name, description, price, user_id, created_at, updated_at)
  VALUES ('POL-NEG-001', 'Polera Básica Negra', 'Algodón 100%, cuello redondo, unisex', 12990, uid,
          NOW() - INTERVAL '6 months', NOW() - INTERVAL '6 months')
  RETURNING id INTO p1;

  INSERT INTO products (code, name, description, price, user_id, created_at, updated_at)
  VALUES ('JNS-AZL-001', 'Jeans Slim Azul', 'Corte slim, denim 12 oz, cierre YKK', 24990, uid,
          NOW() - INTERVAL '6 months', NOW() - INTERVAL '6 months')
  RETURNING id INTO p2;

  INSERT INTO products (code, name, description, price, user_id, created_at, updated_at)
  VALUES ('PRK-GRS-001', 'Parka Cortaviento Gris', 'Cortaviento impermeable, capucha desmontable', 45990, uid,
          NOW() - INTERVAL '6 months', NOW() - INTERVAL '6 months')
  RETURNING id INTO p3;

  INSERT INTO products (code, name, description, price, user_id, created_at, updated_at)
  VALUES ('HOD-GRS-001', 'Hoodie Gris Jaspeado', 'Algodón/poliéster, bolsillo canguro', 19990, uid,
          NOW() - INTERVAL '6 months', NOW() - INTERVAL '6 months')
  RETURNING id INTO p4;

  INSERT INTO products (code, name, description, price, user_id, created_at, updated_at)
  VALUES ('SHR-NEG-001', 'Shorts Deportivo Negro', 'Microfibra secado rápido, elástico ajustable', 14990, uid,
          NOW() - INTERVAL '5 months', NOW() - INTERVAL '5 months')
  RETURNING id INTO p5;

  INSERT INTO products (code, name, description, price, user_id, created_at, updated_at)
  VALUES ('CHQ-DNM-001', 'Chaqueta Denim Vintage', 'Denim lavado, botones de metal', 35990, uid,
          NOW() - INTERVAL '6 months', NOW() - INTERVAL '6 months')
  RETURNING id INTO p6;

  -- ===========================================================================
  -- VARIANTES — Product 1: Polera Básica Negra
  -- Final stocks: XS=8, S=45, M=38, L=28, XL=15
  -- ===========================================================================
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p1, 'XS', 8,  NOW() - INTERVAL '6 months') RETURNING id INTO p1_xs;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p1, 'S',  45, NOW() - INTERVAL '6 months') RETURNING id INTO p1_s;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p1, 'M',  38, NOW() - INTERVAL '6 months') RETURNING id INTO p1_m;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p1, 'L',  28, NOW() - INTERVAL '6 months') RETURNING id INTO p1_l;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p1, 'XL', 15, NOW() - INTERVAL '6 months') RETURNING id INTO p1_xl;

  -- Movements — XS (final: 8)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p1_xs, 'in',  30,  30, 'Carga inicial temporada', uid, NOW() - INTERVAL '180 days'),
    (p1_xs, 'out',  4,  26, 'Venta mostrador',         uid, NOW() - INTERVAL '155 days'),
    (p1_xs, 'out',  6,  20, 'Venta online',             uid, NOW() - INTERVAL '130 days'),
    (p1_xs, 'in',  10,  30, 'Reposición proveedor',     uid, NOW() - INTERVAL '100 days'),
    (p1_xs, 'out',  8,  22, 'Venta mostrador',          uid, NOW() - INTERVAL '75 days'),
    (p1_xs, 'out',  7,  15, 'Venta online',             uid, NOW() - INTERVAL '45 days'),
    (p1_xs, 'out',  4,  11, 'Venta mostrador',          uid, NOW() - INTERVAL '20 days'),
    (p1_xs, 'out',  3,   8, 'Venta online',             uid, NOW() - INTERVAL '5 days');

  -- Movements — S (final: 45)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p1_s, 'in',  80,  80, 'Carga inicial temporada', uid, NOW() - INTERVAL '180 days'),
    (p1_s, 'out',  8,  72, 'Venta mostrador',         uid, NOW() - INTERVAL '165 days'),
    (p1_s, 'out', 12,  60, 'Venta online',             uid, NOW() - INTERVAL '150 days'),
    (p1_s, 'in',  30,  90, 'Reposición proveedor',     uid, NOW() - INTERVAL '120 days'),
    (p1_s, 'out', 10,  80, 'Venta mostrador',          uid, NOW() - INTERVAL '105 days'),
    (p1_s, 'out', 15,  65, 'Venta feria',              uid, NOW() - INTERVAL '90 days'),
    (p1_s, 'out', 12,  53, 'Venta online',             uid, NOW() - INTERVAL '60 days'),
    (p1_s, 'in',  20,  73, 'Reposición proveedor',     uid, NOW() - INTERVAL '45 days'),
    (p1_s, 'out', 14,  59, 'Venta mostrador',          uid, NOW() - INTERVAL '30 days'),
    (p1_s, 'out', 14,  45, 'Venta online',             uid, NOW() - INTERVAL '10 days');

  -- Movements — M (final: 38)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p1_m, 'in',  90,  90, 'Carga inicial temporada', uid, NOW() - INTERVAL '180 days'),
    (p1_m, 'out', 15,  75, 'Venta mostrador',         uid, NOW() - INTERVAL '160 days'),
    (p1_m, 'out', 12,  63, 'Venta online',             uid, NOW() - INTERVAL '140 days'),
    (p1_m, 'in',  25,  88, 'Reposición proveedor',     uid, NOW() - INTERVAL '120 days'),
    (p1_m, 'out', 18,  70, 'Venta feria',              uid, NOW() - INTERVAL '100 days'),
    (p1_m, 'out', 14,  56, 'Venta mostrador',          uid, NOW() - INTERVAL '75 days'),
    (p1_m, 'out', 10,  46, 'Venta online',             uid, NOW() - INTERVAL '45 days'),
    (p1_m, 'out',  8,  38, 'Venta mostrador',          uid, NOW() - INTERVAL '15 days');

  -- Movements — L (final: 28)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p1_l, 'in',  70,  70, 'Carga inicial temporada', uid, NOW() - INTERVAL '180 days'),
    (p1_l, 'out',  8,  62, 'Venta mostrador',         uid, NOW() - INTERVAL '165 days'),
    (p1_l, 'out', 10,  52, 'Venta online',             uid, NOW() - INTERVAL '145 days'),
    (p1_l, 'in',  20,  72, 'Reposición proveedor',     uid, NOW() - INTERVAL '120 days'),
    (p1_l, 'out', 12,  60, 'Venta mostrador',          uid, NOW() - INTERVAL '95 days'),
    (p1_l, 'out', 15,  45, 'Venta feria',              uid, NOW() - INTERVAL '70 days'),
    (p1_l, 'out', 10,  35, 'Venta online',             uid, NOW() - INTERVAL '45 days'),
    (p1_l, 'out',  7,  28, 'Venta mostrador',          uid, NOW() - INTERVAL '20 days');

  -- Movements — XL (final: 15)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p1_xl, 'in',  50,  50, 'Carga inicial temporada', uid, NOW() - INTERVAL '180 days'),
    (p1_xl, 'out',  5,  45, 'Venta mostrador',          uid, NOW() - INTERVAL '160 days'),
    (p1_xl, 'out',  8,  37, 'Venta online',              uid, NOW() - INTERVAL '140 days'),
    (p1_xl, 'in',  15,  52, 'Reposición proveedor',      uid, NOW() - INTERVAL '100 days'),
    (p1_xl, 'out', 12,  40, 'Venta mostrador',           uid, NOW() - INTERVAL '80 days'),
    (p1_xl, 'out', 10,  30, 'Venta feria',               uid, NOW() - INTERVAL '55 days'),
    (p1_xl, 'out',  8,  22, 'Venta online',              uid, NOW() - INTERVAL '25 days'),
    (p1_xl, 'out',  7,  15, 'Venta mostrador',           uid, NOW() - INTERVAL '7 days');

  -- ===========================================================================
  -- VARIANTES — Product 2: Jeans Slim Azul
  -- Final stocks: 28=12, 30=20, 32=18, 34=10, 36=5
  -- ===========================================================================
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p2, '28', 12, NOW() - INTERVAL '6 months') RETURNING id INTO p2_28;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p2, '30', 20, NOW() - INTERVAL '6 months') RETURNING id INTO p2_30;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p2, '32', 18, NOW() - INTERVAL '6 months') RETURNING id INTO p2_32;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p2, '34', 10, NOW() - INTERVAL '6 months') RETURNING id INTO p2_34;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p2, '36',  5, NOW() - INTERVAL '6 months') RETURNING id INTO p2_36;

  -- Movements — 28 (final: 12)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p2_28, 'in',  30,  30, 'Carga inicial',      uid, NOW() - INTERVAL '180 days'),
    (p2_28, 'out',  6,  24, 'Venta mostrador',     uid, NOW() - INTERVAL '150 days'),
    (p2_28, 'out',  5,  19, 'Venta online',        uid, NOW() - INTERVAL '110 days'),
    (p2_28, 'out',  4,  15, 'Venta mostrador',     uid, NOW() - INTERVAL '70 days'),
    (p2_28, 'out',  3,  12, 'Venta online',        uid, NOW() - INTERVAL '25 days');

  -- Movements — 30 (final: 20)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p2_30, 'in',  45,  45, 'Carga inicial',       uid, NOW() - INTERVAL '180 days'),
    (p2_30, 'out',  8,  37, 'Venta mostrador',     uid, NOW() - INTERVAL '155 days'),
    (p2_30, 'out',  7,  30, 'Venta online',        uid, NOW() - INTERVAL '120 days'),
    (p2_30, 'in',  10,  40, 'Reposición',          uid, NOW() - INTERVAL '90 days'),
    (p2_30, 'out', 10,  30, 'Venta feria',         uid, NOW() - INTERVAL '60 days'),
    (p2_30, 'out',  5,  25, 'Venta online',        uid, NOW() - INTERVAL '30 days'),
    (p2_30, 'out',  5,  20, 'Venta mostrador',     uid, NOW() - INTERVAL '8 days');

  -- Movements — 32 (final: 18)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p2_32, 'in',  40,  40, 'Carga inicial',       uid, NOW() - INTERVAL '180 days'),
    (p2_32, 'out',  7,  33, 'Venta mostrador',     uid, NOW() - INTERVAL '150 days'),
    (p2_32, 'out',  6,  27, 'Venta online',        uid, NOW() - INTERVAL '110 days'),
    (p2_32, 'out',  5,  22, 'Venta feria',         uid, NOW() - INTERVAL '65 days'),
    (p2_32, 'out',  4,  18, 'Venta mostrador',     uid, NOW() - INTERVAL '20 days');

  -- Movements — 34 (final: 10)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p2_34, 'in',  30,  30, 'Carga inicial',       uid, NOW() - INTERVAL '180 days'),
    (p2_34, 'out',  8,  22, 'Venta mostrador',     uid, NOW() - INTERVAL '140 days'),
    (p2_34, 'out',  7,  15, 'Venta online',        uid, NOW() - INTERVAL '90 days'),
    (p2_34, 'out',  5,  10, 'Venta feria',         uid, NOW() - INTERVAL '35 days');

  -- Movements — 36 (final: 5)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p2_36, 'in',  20,  20, 'Carga inicial',       uid, NOW() - INTERVAL '180 days'),
    (p2_36, 'out',  6,  14, 'Venta mostrador',     uid, NOW() - INTERVAL '130 days'),
    (p2_36, 'out',  5,   9, 'Venta online',        uid, NOW() - INTERVAL '80 days'),
    (p2_36, 'out',  4,   5, 'Venta mostrador',     uid, NOW() - INTERVAL '30 days');

  -- ===========================================================================
  -- VARIANTES — Product 3: Parka Cortaviento Gris (temporada fría, pico 3-4 meses atrás)
  -- Final stocks: S=10, M=15, L=12, XL=7
  -- ===========================================================================
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p3, 'S',  10, NOW() - INTERVAL '6 months') RETURNING id INTO p3_s;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p3, 'M',  15, NOW() - INTERVAL '6 months') RETURNING id INTO p3_m;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p3, 'L',  12, NOW() - INTERVAL '6 months') RETURNING id INTO p3_l;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p3, 'XL',  7, NOW() - INTERVAL '6 months') RETURNING id INTO p3_xl;

  -- S (final: 10) — pico de ventas entre mes 5 y 3
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p3_s, 'in',  30,  30, 'Carga inicial',           uid, NOW() - INTERVAL '180 days'),
    (p3_s, 'out',  5,  25, 'Venta mostrador',          uid, NOW() - INTERVAL '155 days'),
    (p3_s, 'out',  8,  17, 'Venta temporada invierno', uid, NOW() - INTERVAL '120 days'),
    (p3_s, 'out',  5,  12, 'Venta online',             uid, NOW() - INTERVAL '90 days'),
    (p3_s, 'out',  2,  10, 'Venta mostrador',          uid, NOW() - INTERVAL '40 days');

  -- M (final: 15)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p3_m, 'in',  40,  40, 'Carga inicial',            uid, NOW() - INTERVAL '180 days'),
    (p3_m, 'out',  6,  34, 'Venta mostrador',          uid, NOW() - INTERVAL '155 days'),
    (p3_m, 'out', 10,  24, 'Venta temporada invierno', uid, NOW() - INTERVAL '115 days'),
    (p3_m, 'in',  10,  34, 'Reposición invierno',      uid, NOW() - INTERVAL '100 days'),
    (p3_m, 'out', 12,  22, 'Venta feria invierno',     uid, NOW() - INTERVAL '85 days'),
    (p3_m, 'out',  7,  15, 'Venta online',             uid, NOW() - INTERVAL '50 days');

  -- L (final: 12)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p3_l, 'in',  35,  35, 'Carga inicial',            uid, NOW() - INTERVAL '180 days'),
    (p3_l, 'out',  5,  30, 'Venta mostrador',          uid, NOW() - INTERVAL '150 days'),
    (p3_l, 'out', 10,  20, 'Venta temporada invierno', uid, NOW() - INTERVAL '110 days'),
    (p3_l, 'out',  8,  12, 'Venta feria invierno',     uid, NOW() - INTERVAL '80 days');

  -- XL (final: 7)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p3_xl, 'in',  25,  25, 'Carga inicial',            uid, NOW() - INTERVAL '180 days'),
    (p3_xl, 'out',  5,  20, 'Venta mostrador',          uid, NOW() - INTERVAL '150 days'),
    (p3_xl, 'out',  8,  12, 'Venta temporada invierno', uid, NOW() - INTERVAL '105 days'),
    (p3_xl, 'out',  5,   7, 'Venta online',             uid, NOW() - INTERVAL '60 days');

  -- ===========================================================================
  -- VARIANTES — Product 4: Hoodie Gris Jaspeado
  -- Final stocks: S=20, M=30, L=25, XL=18
  -- ===========================================================================
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p4, 'S',  20, NOW() - INTERVAL '6 months') RETURNING id INTO p4_s;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p4, 'M',  30, NOW() - INTERVAL '6 months') RETURNING id INTO p4_m;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p4, 'L',  25, NOW() - INTERVAL '6 months') RETURNING id INTO p4_l;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p4, 'XL', 18, NOW() - INTERVAL '6 months') RETURNING id INTO p4_xl;

  -- S (final: 20)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p4_s, 'in',  60,  60, 'Carga inicial',       uid, NOW() - INTERVAL '180 days'),
    (p4_s, 'out', 10,  50, 'Venta mostrador',     uid, NOW() - INTERVAL '160 days'),
    (p4_s, 'out', 12,  38, 'Venta online',        uid, NOW() - INTERVAL '130 days'),
    (p4_s, 'in',  20,  58, 'Reposición',          uid, NOW() - INTERVAL '100 days'),
    (p4_s, 'out', 14,  44, 'Venta feria',         uid, NOW() - INTERVAL '75 days'),
    (p4_s, 'out', 12,  32, 'Venta online',        uid, NOW() - INTERVAL '50 days'),
    (p4_s, 'out',  8,  24, 'Venta mostrador',     uid, NOW() - INTERVAL '25 days'),
    (p4_s, 'out',  4,  20, 'Venta online',        uid, NOW() - INTERVAL '6 days');

  -- M (final: 30)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p4_m, 'in',  80,  80, 'Carga inicial',       uid, NOW() - INTERVAL '180 days'),
    (p4_m, 'out', 15,  65, 'Venta mostrador',     uid, NOW() - INTERVAL '160 days'),
    (p4_m, 'out', 14,  51, 'Venta online',        uid, NOW() - INTERVAL '130 days'),
    (p4_m, 'in',  30,  81, 'Reposición',          uid, NOW() - INTERVAL '100 days'),
    (p4_m, 'out', 18,  63, 'Venta feria',         uid, NOW() - INTERVAL '75 days'),
    (p4_m, 'out', 15,  48, 'Venta online',        uid, NOW() - INTERVAL '50 days'),
    (p4_m, 'out', 12,  36, 'Venta mostrador',     uid, NOW() - INTERVAL '25 days'),
    (p4_m, 'out',  6,  30, 'Venta online',        uid, NOW() - INTERVAL '4 days');

  -- L (final: 25)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p4_l, 'in',  70,  70, 'Carga inicial',       uid, NOW() - INTERVAL '180 days'),
    (p4_l, 'out', 12,  58, 'Venta mostrador',     uid, NOW() - INTERVAL '155 days'),
    (p4_l, 'out', 13,  45, 'Venta online',        uid, NOW() - INTERVAL '125 days'),
    (p4_l, 'in',  20,  65, 'Reposición',          uid, NOW() - INTERVAL '95 days'),
    (p4_l, 'out', 16,  49, 'Venta feria',         uid, NOW() - INTERVAL '70 days'),
    (p4_l, 'out', 14,  35, 'Venta online',        uid, NOW() - INTERVAL '45 days'),
    (p4_l, 'out', 10,  25, 'Venta mostrador',     uid, NOW() - INTERVAL '12 days');

  -- XL (final: 18)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p4_xl, 'in',  55,  55, 'Carga inicial',       uid, NOW() - INTERVAL '180 days'),
    (p4_xl, 'out', 10,  45, 'Venta mostrador',     uid, NOW() - INTERVAL '155 days'),
    (p4_xl, 'out',  9,  36, 'Venta online',        uid, NOW() - INTERVAL '120 days'),
    (p4_xl, 'in',  15,  51, 'Reposición',          uid, NOW() - INTERVAL '90 days'),
    (p4_xl, 'out', 13,  38, 'Venta feria',         uid, NOW() - INTERVAL '65 days'),
    (p4_xl, 'out', 12,  26, 'Venta online',        uid, NOW() - INTERVAL '35 days'),
    (p4_xl, 'out',  8,  18, 'Venta mostrador',     uid, NOW() - INTERVAL '9 days');

  -- ===========================================================================
  -- VARIANTES — Product 5: Shorts Deportivo Negro (temporada verano, pico reciente)
  -- Final stocks: S=22, M=28, L=20, XL=12
  -- ===========================================================================
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p5, 'S',  22, NOW() - INTERVAL '5 months') RETURNING id INTO p5_s;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p5, 'M',  28, NOW() - INTERVAL '5 months') RETURNING id INTO p5_m;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p5, 'L',  20, NOW() - INTERVAL '5 months') RETURNING id INTO p5_l;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p5, 'XL', 12, NOW() - INTERVAL '5 months') RETURNING id INTO p5_xl;

  -- S (final: 22) — pico de ventas en el último mes
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p5_s, 'in',  50,  50, 'Carga temporada verano', uid, NOW() - INTERVAL '150 days'),
    (p5_s, 'out',  5,  45, 'Venta mostrador',        uid, NOW() - INTERVAL '120 days'),
    (p5_s, 'out',  8,  37, 'Venta online',           uid, NOW() - INTERVAL '90 days'),
    (p5_s, 'in',  20,  57, 'Reposición verano',      uid, NOW() - INTERVAL '60 days'),
    (p5_s, 'out', 15,  42, 'Venta mostrador',        uid, NOW() - INTERVAL '45 days'),
    (p5_s, 'out', 10,  32, 'Venta online',           uid, NOW() - INTERVAL '25 days'),
    (p5_s, 'out',  7,  25, 'Venta mostrador',        uid, NOW() - INTERVAL '12 days'),
    (p5_s, 'out',  3,  22, 'Venta online',           uid, NOW() - INTERVAL '3 days');

  -- M (final: 28)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p5_m, 'in',  60,  60, 'Carga temporada verano', uid, NOW() - INTERVAL '150 days'),
    (p5_m, 'out',  6,  54, 'Venta mostrador',        uid, NOW() - INTERVAL '120 days'),
    (p5_m, 'out',  9,  45, 'Venta online',           uid, NOW() - INTERVAL '90 days'),
    (p5_m, 'in',  25,  70, 'Reposición verano',      uid, NOW() - INTERVAL '60 days'),
    (p5_m, 'out', 18,  52, 'Venta mostrador',        uid, NOW() - INTERVAL '45 days'),
    (p5_m, 'out', 12,  40, 'Venta online',           uid, NOW() - INTERVAL '25 days'),
    (p5_m, 'out',  8,  32, 'Venta mostrador',        uid, NOW() - INTERVAL '12 days'),
    (p5_m, 'out',  4,  28, 'Venta online',           uid, NOW() - INTERVAL '2 days');

  -- L (final: 20)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p5_l, 'in',  50,  50, 'Carga temporada verano', uid, NOW() - INTERVAL '150 days'),
    (p5_l, 'out',  5,  45, 'Venta mostrador',        uid, NOW() - INTERVAL '115 days'),
    (p5_l, 'out',  8,  37, 'Venta online',           uid, NOW() - INTERVAL '85 days'),
    (p5_l, 'in',  20,  57, 'Reposición verano',      uid, NOW() - INTERVAL '55 days'),
    (p5_l, 'out', 18,  39, 'Venta mostrador',        uid, NOW() - INTERVAL '35 days'),
    (p5_l, 'out', 12,  27, 'Venta online',           uid, NOW() - INTERVAL '15 days'),
    (p5_l, 'out',  7,  20, 'Venta mostrador',        uid, NOW() - INTERVAL '4 days');

  -- XL (final: 12)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p5_xl, 'in',  35,  35, 'Carga temporada verano', uid, NOW() - INTERVAL '150 days'),
    (p5_xl, 'out',  4,  31, 'Venta mostrador',        uid, NOW() - INTERVAL '110 days'),
    (p5_xl, 'out',  6,  25, 'Venta online',           uid, NOW() - INTERVAL '80 days'),
    (p5_xl, 'in',  15,  40, 'Reposición verano',      uid, NOW() - INTERVAL '50 days'),
    (p5_xl, 'out', 14,  26, 'Venta mostrador',        uid, NOW() - INTERVAL '30 days'),
    (p5_xl, 'out',  9,  17, 'Venta online',           uid, NOW() - INTERVAL '14 days'),
    (p5_xl, 'out',  5,  12, 'Venta mostrador',        uid, NOW() - INTERVAL '5 days');

  -- ===========================================================================
  -- VARIANTES — Product 6: Chaqueta Denim Vintage (bajo volumen, precio alto)
  -- Final stocks: S=8, M=12, L=10, XL=6
  -- ===========================================================================
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p6, 'S',   8, NOW() - INTERVAL '6 months') RETURNING id INTO p6_s;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p6, 'M',  12, NOW() - INTERVAL '6 months') RETURNING id INTO p6_m;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p6, 'L',  10, NOW() - INTERVAL '6 months') RETURNING id INTO p6_l;
  INSERT INTO product_variants (product_id, size, current_stock, created_at) VALUES (p6, 'XL',  6, NOW() - INTERVAL '6 months') RETURNING id INTO p6_xl;

  -- S (final: 8)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p6_s, 'in',  20,  20, 'Carga inicial',     uid, NOW() - INTERVAL '180 days'),
    (p6_s, 'out',  4,  16, 'Venta mostrador',   uid, NOW() - INTERVAL '140 days'),
    (p6_s, 'out',  4,  12, 'Venta online',      uid, NOW() - INTERVAL '90 days'),
    (p6_s, 'out',  4,   8, 'Venta mostrador',   uid, NOW() - INTERVAL '35 days');

  -- M (final: 12)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p6_m, 'in',  25,  25, 'Carga inicial',     uid, NOW() - INTERVAL '180 days'),
    (p6_m, 'out',  4,  21, 'Venta mostrador',   uid, NOW() - INTERVAL '145 days'),
    (p6_m, 'out',  5,  16, 'Venta online',      uid, NOW() - INTERVAL '95 days'),
    (p6_m, 'in',   5,  21, 'Reposición',        uid, NOW() - INTERVAL '70 days'),
    (p6_m, 'out',  5,  16, 'Venta mostrador',   uid, NOW() - INTERVAL '40 days'),
    (p6_m, 'out',  4,  12, 'Venta online',      uid, NOW() - INTERVAL '15 days');

  -- L (final: 10)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p6_l, 'in',  22,  22, 'Carga inicial',     uid, NOW() - INTERVAL '180 days'),
    (p6_l, 'out',  4,  18, 'Venta mostrador',   uid, NOW() - INTERVAL '140 days'),
    (p6_l, 'out',  5,  13, 'Venta online',      uid, NOW() - INTERVAL '85 days'),
    (p6_l, 'out',  3,  10, 'Venta mostrador',   uid, NOW() - INTERVAL '30 days');

  -- XL (final: 6)
  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, user_id, created_at) VALUES
    (p6_xl, 'in',  15,  15, 'Carga inicial',     uid, NOW() - INTERVAL '180 days'),
    (p6_xl, 'out',  3,  12, 'Venta mostrador',   uid, NOW() - INTERVAL '130 days'),
    (p6_xl, 'out',  4,   8, 'Venta online',      uid, NOW() - INTERVAL '75 days'),
    (p6_xl, 'out',  2,   6, 'Venta mostrador',   uid, NOW() - INTERVAL '28 days');

  RAISE NOTICE '✓ Demo cargado: 6 productos, 23 variantes, ~120 movimientos en 6 meses.';
END;
$$;
