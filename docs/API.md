# API Documentation - Inventory Management System

## Base URL

```
https://tu-dominio.com/api/v1
```

## Authentication

Todas las rutas (excepto `/health`) requieren autenticación via Bearer token:

```
Authorization: Bearer <API_KEY>
```

Configura `API_KEY` en `.env.local`:

```env
API_KEY=tu-clave-secreta-aqui
```

## Endpoints

### Health Check

#### `GET /health`

Verifica que la API está disponible.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-05-12T10:30:00.000Z",
  "version": "1.0.0"
}
```

---

### Products

#### `GET /products`

Obtiene lista de productos con stock actual.

**Query Parameters:**
- `limit` (number, default: 50, max: 500) - Número de productos
- `offset` (number, default: 0) - Para paginación
- `search` (string) - Buscar por código o nombre
- `status` (string, default: 'active') - 'active' | 'discontinued'

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://tu-dominio.com/api/v1/products?limit=10&search=P001"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "P001",
      "name": "Camiseta Azul",
      "description": "Camiseta de algodón",
      "price": 25000,
      "cost": 10000,
      "margin": 15000,
      "marginPercent": "60.00",
      "status": "active",
      "totalStock": 45,
      "stockValue": 1125000,
      "variants": [
        {
          "id": "uuid",
          "size": "S",
          "current_stock": 10
        },
        {
          "id": "uuid",
          "size": "M",
          "current_stock": 15
        }
      ],
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-05-12T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 50,
    "hasMore": true
  }
}
```

---

#### `GET /products/[id]`

Obtiene detalles completos de un producto específico.

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://tu-dominio.com/api/v1/products/550e8400-e29b-41d4-a716-446655440000"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "P001",
    "name": "Camiseta Azul",
    "description": "Camiseta de algodón",
    "price": 25000,
    "cost": 10000,
    "margin": 15000,
    "marginPercent": "60.00",
    "status": "active",
    "totalStock": 45,
    "stockValue": 1125000,
    "variants": [
      {
        "id": "uuid",
        "size": "S",
        "current_stock": 10
      },
      {
        "id": "uuid",
        "size": "M",
        "current_stock": 15
      }
    ],
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-05-12T10:00:00Z"
  }
}
```

---

### Stock

#### `GET /stock`

Obtiene estado actual del stock de todos los productos.

**Query Parameters:**
- `productId` (string) - Filtrar por producto específico
- `includeVariants` (boolean, default: true) - Incluir detalles de variantes

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://tu-dominio.com/api/v1/stock"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "P001",
      "name": "Camiseta Azul",
      "price": 25000,
      "cost": 10000,
      "totalStock": 45,
      "stockValue": 1125000,
      "status": "in_stock",
      "variants": [
        {
          "id": "uuid",
          "size": "S",
          "stock": 10,
          "value": 250000
        }
      ]
    }
  ],
  "totals": {
    "totalProducts": 50,
    "totalStock": 2500,
    "totalValue": 62500000,
    "outOfStock": 5,
    "lowStock": 12
  }
}
```

---

#### `POST /stock`

Actualiza el stock de un producto (entrada o salida).

**Body:**
```json
{
  "variantId": "uuid",
  "quantity": 10,
  "type": "in",
  "notes": "Restock desde proveedor"
}
```

**Example:**
```bash
curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "variantId": "550e8400-e29b-41d4-a716-446655440000",
    "quantity": 5,
    "type": "out",
    "notes": "Venta online"
  }' \
  "https://tu-dominio.com/api/v1/stock"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "variantId": "uuid",
    "previousStock": 10,
    "newStock": 5,
    "quantity": 5,
    "type": "out",
    "movement": {
      "id": "uuid",
      "variant_id": "uuid",
      "type": "out",
      "quantity": 5,
      "stock_after": 5,
      "notes": "Venta online",
      "created_at": "2025-05-12T10:30:00Z"
    }
  }
}
```

---

### Analytics

#### `GET /analytics`

Obtiene métricas de analytics del inventario.

**Query Parameters:**
- `period` (string, default: '30d') - '7d' | '30d' | '90d' | '365d' | 'all'
- `productId` (string) - Filtrar por producto específico

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://tu-dominio.com/api/v1/analytics?period=30d"
```

**Response:**
```json
{
  "success": true,
  "period": "30d",
  "data": {
    "kpis": {
      "totalOutQty": 150,
      "totalInQty": 200,
      "totalOutValue": 3750000,
      "totalInValue": 5000000,
      "currentStock": 2500,
      "currentStockValue": 62500000,
      "dailyOut": 5,
      "avgDailyValue": 125000,
      "daysInventory": 500,
      "rotation": 0.06,
      "periodDays": 30
    },
    "abc": [
      {
        "productId": "uuid",
        "productName": "Camiseta Azul",
        "quantity": 80,
        "percentage": 53.33,
        "cumulativePercent": 53.33,
        "classification": "A"
      },
      {
        "productId": "uuid",
        "productName": "Pantalón Negro",
        "quantity": 50,
        "percentage": 33.33,
        "cumulativePercent": 86.67,
        "classification": "B"
      }
    ],
    "lowStockProducts": [
      {
        "id": "uuid",
        "name": "Camiseta Roja",
        "stock": 2,
        "price": 25000,
        "value": 50000,
        "variants": [
          {
            "id": "uuid",
            "size": "M",
            "current_stock": 2
          }
        ]
      }
    ],
    "summary": {
      "totalProducts": 50,
      "activeProducts": 45,
      "outOfStockProducts": 5
    }
  }
}
```

---

### Movements

#### `GET /movements`

Obtiene historial de movimientos de stock.

**Query Parameters:**
- `limit` (number, default: 100, max: 1000) - Número de movimientos
- `offset` (number, default: 0) - Para paginación
- `type` (string) - 'in' | 'out'
- `productId` (string) - Filtrar por producto
- `variantId` (string) - Filtrar por variante
- `startDate` (string) - Fecha inicio (ISO format)
- `endDate` (string) - Fecha fin (ISO format)

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://tu-dominio.com/api/v1/movements?type=out&limit=20"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "out",
      "quantity": 5,
      "stockAfter": 40,
      "notes": "Venta online",
      "commission": 0,
      "createdAt": "2025-05-12T10:30:00Z",
      "product": {
        "id": "uuid",
        "code": "P001",
        "name": "Camiseta Azul",
        "price": 25000,
        "cost": 10000
      },
      "variant": {
        "id": "uuid",
        "size": "M"
      },
      "value": 125000,
      "costValue": 50000,
      "margin": 75000
    }
  ],
  "totals": {
    "quantity": 150,
    "value": 3750000,
    "costValue": 1500000,
    "margin": 2250000
  },
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 500,
    "hasMore": true
  }
}
```

---

## Error Handling

Todos los errores retornan un status HTTP apropiado y un JSON con el error:

```json
{
  "error": "Descripción del error"
}
```

**Common Status Codes:**
- `200` - OK
- `400` - Bad Request (parámetros inválidos)
- `401` - Unauthorized (API key inválida o faltante)
- `404` - Not Found (recurso no existe)
- `500` - Internal Server Error

---

## Rate Limiting

No hay rate limiting implementado actualmente. Se recomienda implementar en producción.

---

## Examples for OpenClaw Integration

### Get all products
```python
import requests

API_KEY = "your-api-key"
BASE_URL = "https://tu-dominio.com/api/v1"

headers = {"Authorization": f"Bearer {API_KEY}"}

# Get all products
response = requests.get(f"{BASE_URL}/products", headers=headers)
products = response.json()["data"]

for product in products:
    print(f"{product['code']} - {product['name']}: {product['totalStock']} units")
```

### Get analytics
```python
# Get analytics for last 30 days
response = requests.get(
    f"{BASE_URL}/analytics?period=30d",
    headers=headers
)
analytics = response.json()["data"]

print(f"Total sales: {analytics['kpis']['totalOutQty']} units")
print(f"Rotation: {analytics['kpis']['rotation']}x")
print(f"Days inventory: {analytics['kpis']['daysInventory']} days")
```

### Update stock
```python
# Add stock to a variant
response = requests.post(
    f"{BASE_URL}/stock",
    headers=headers,
    json={
        "variantId": "variant-uuid",
        "quantity": 10,
        "type": "in",
        "notes": "Restock from supplier"
    }
)

result = response.json()
print(f"New stock: {result['data']['newStock']}")
```

---

## Configuration

Agrega estas variables a `.env.local`:

```env
# API Configuration
API_KEY=tu-clave-secreta-aqui

# Supabase (ya existentes)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Changelog

### v1.0.0 (2025-05-12)
- Initial release
- Products endpoint
- Stock endpoint
- Analytics endpoint
- Movements endpoint
- Health check endpoint
