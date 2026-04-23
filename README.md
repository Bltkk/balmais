# Balmais — Gestión de Inventario para Indumentaria

Sistema web mono-tenant para control de stock de ropa por talla, con historial de movimientos, analíticas, reportes exportables e integración con WhatsApp Business.

**Demo en vivo:** [balmais-opal.vercel.app](https://balmais-opal.vercel.app)

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) |
| Lenguaje | TypeScript |
| Base de datos | Supabase (PostgreSQL + Auth) |
| Estilos | Tailwind CSS |
| Gráficas | Recharts |
| Validación | Zod |
| Deploy | Vercel |

---

## Funcionalidades

### Dashboard
- Totales en tiempo real: productos, stock total, valor de inventario, movimientos del día
- Gráfica de entradas vs salidas con filtros de período (semana / mes / 3 meses / año / todo)
- Toggle entre vista de unidades y valor monetario

### Productos
- Lista con búsqueda por código o nombre
- Filas expandibles con stock desglosado por talla
- Botones `+` / `−` por talla para registrar movimientos al instante
- Alta con tallas dinámicas y stock inicial
- Edición y eliminación con cascade

### Analíticas
- Gráficas de línea y barras: movimientos en el tiempo, por producto y stock actual

### Reportes
- Historial completo con columna de talla
- Filtros por rango de fechas y tipo (Entrada / Salida / Todos)
- Exportación a CSV compatible con Excel y Google Sheets

### WhatsApp Business
Comandos por mensaje directo para operar el inventario sin abrir la web:

| Comando | Descripción |
|---|---|
| `P<codigo> <cantidad>` | Restar stock — ej: `P001 5` |
| `+ <codigo> <cantidad>` | Sumar stock — ej: `+ P001 10` |
| `STOCK <codigo>` | Consultar stock de un producto |
| `LISTA` | Ver todos los productos |
| `AYUDA` | Mostrar comandos disponibles |

---

## Modelo de datos

```
products          → código, nombre, precio, user_id
product_variants  → product_id, talla, stock_actual   (UNIQUE por talla)
stock_movements   → variant_id, tipo in|out, cantidad, stock_after, fecha
```

El stock se modifica exclusivamente mediante la función `register_stock_movement` (RPC), que garantiza atomicidad, previene stock negativo y valida ownership mediante RLS.

---

## Instalación local

```bash
git clone https://github.com/Bltkk/balmais.git
cd balmais
npm install
cp .env.local.example .env.local
# Completar las variables con tus credenciales de Supabase
npm run dev
```

Acceso en `http://localhost:3000`

## Variables de entorno

```env
# Supabase (requeridas)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Solo para la integración WhatsApp (opcional)
SUPABASE_SERVICE_ROLE_KEY=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_DEFAULT_USER_ID=
```

---

## Seguridad

- Row Level Security (RLS) activo en las 3 tablas: cada usuario accede únicamente a sus datos
- Headers HTTP: CSP, HSTS, X-Frame-Options, Referrer-Policy
- `REVOKE ALL` al rol `anon`, permisos mínimos a `authenticated`
- CHECK constraints en base de datos (formato código, precio máximo, longitud notas)
- Protección contra CSV injection en exportaciones
- `search_path = ''` en funciones PL/pgSQL

---

## Comandos

```bash
npm run dev     # Servidor de desarrollo en :3000
npm run build   # Build de producción
npm start       # Servidor de producción
```
