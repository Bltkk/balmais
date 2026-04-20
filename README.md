# Control Total

Sistema de gestión de inventario para tiendas de ropa, con control de stock por talla, analíticas y reportes exportables.

**Desarrollado por Tracta — Gestión TI**

**Demo en vivo:** https://balmais-opal.vercel.app

---

## Vistas principales

### Login
- Acceso con email y contraseña
- Sesión persistente — no requiere volver a entrar al cerrar el navegador
- Cada usuario ve **solo su propio inventario** (aislamiento total por RLS)

---

### Dashboard

- 4 tarjetas: productos, stock total, valor inventario, movimientos del día
- Filtro de período: **Semana / Mes / 3 meses / 1 año / Todo**
- Toggle **Valor ($) / Unidades**
- Gráfica de línea: Entradas (verde) vs Salidas (rojo)
- Resumen del período: unidades y valor monetario + diferencia neta

---

### Productos

- Lista con búsqueda por código o nombre
- Filas expandibles que muestran **stock por talla**
- Botones `+` / `−` por talla para registrar entradas/salidas al instante
- Crear, editar y eliminar productos

---

### Nuevo Producto

- Código, nombre, precio y descripción
- Tallas dinámicas: agregar filas S, M, L, XL o cualquier denominación
- Stock inicial por talla al momento de crear

---

### Analíticas

- Toggle **Linea / Barras**
- 3 gráficas:
  1. Movimientos en el tiempo (Entradas vs Salidas)
  2. Movimientos por producto en el período seleccionado
  3. Stock actual por producto en colores

---

### Reportes

- Historial completo: fecha, tipo, producto, talla, cantidad, stock final
- Filtros por rango de fechas y tipo (Entrada / Salida / Todos)
- Exportar a **CSV** compatible con Excel y Google Sheets

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Estilos | Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL + Auth) |
| Gráficas | Recharts |
| Validación | Zod |
| Deploy | Vercel |

---

## Modelo de datos

```
products          → código, nombre, precio, user_id
product_variants  → (product_id, talla, stock_actual)
stock_movements   → (variant_id, tipo in|out, cantidad, stock_final, fecha)
```

- El stock real vive en `product_variants.current_stock`
- Cada entrada/salida queda registrada en `stock_movements` con timestamp
- RLS activo: cada usuario accede únicamente a sus datos
- `register_stock_movement` es el único camino válido para modificar stock (atómico y validado)

---

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Correr localmente

```bash
npm install
npm run dev   # http://localhost:3000
```

---

## Seguridad aplicada

- Row Level Security (RLS) en las 3 tablas de datos
- Headers HTTP: CSP, HSTS, X-Frame-Options DENY, Referrer-Policy
- REVOKE ALL al rol `anon`, permisos mínimos a `authenticated`
- CHECK constraints en base de datos (formato código, precio máximo, longitud notas)
- Protección contra CSV injection en exportaciones
- `search_path = ''` en funciones PL/pgSQL

---

*by Tracta · 2026*
