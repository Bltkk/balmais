# Quick Start - OpenClaw Integration

**Guía rápida para conectar tu agente de OpenClaw con la API**

---

## 🚀 En 5 Minutos

### 1. Obtener Credenciales
```
API_KEY: balmais-api-key-2025-secure
BASE_URL: https://tu-dominio-vercel.vercel.app/api/v1
```

### 2. Configurar en OpenClaw
```python
import requests

API_KEY = "balmais-api-key-2025-secure"
BASE_URL = "https://tu-dominio-vercel.vercel.app/api/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}
```

### 3. Hacer Requests
```python
# Obtener productos
response = requests.get(f"{BASE_URL}/products", headers=headers)
products = response.json()["data"]

# Obtener analytics
response = requests.get(f"{BASE_URL}/analytics?period=30d", headers=headers)
analytics = response.json()["data"]

# Actualizar stock
response = requests.post(
    f"{BASE_URL}/stock",
    headers=headers,
    json={
        "variantId": "uuid",
        "quantity": 10,
        "type": "in"
    }
)
```

---

## 📋 Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Health check (sin auth) |
| GET | `/products` | Lista de productos |
| GET | `/products/[id]` | Detalles de producto |
| GET | `/stock` | Estado del stock |
| POST | `/stock` | Actualizar stock |
| GET | `/analytics` | Métricas de analytics |
| GET | `/movements` | Historial de movimientos |

---

## 🔑 Credenciales

### API Key
```
balmais-api-key-2025-secure
```

### Headers
```
Authorization: Bearer balmais-api-key-2025-secure
Content-Type: application/json
```

---

## 🧪 Prueba Rápida

```bash
# Health check
curl https://tu-dominio-vercel.vercel.app/api/v1/health

# Obtener productos
curl -H "Authorization: Bearer balmais-api-key-2025-secure" \
  https://tu-dominio-vercel.vercel.app/api/v1/products
```

---

## 📚 Documentación Completa

- `docs/API.md` - Documentación de endpoints
- `docs/OPENCLAW-INTEGRATION.md` - Ejemplos de integración
- `docs/VERCEL-DEPLOYMENT-GUIDE.md` - Guía de despliegue
- `docs/CREDENTIALS-SETUP.md` - Configuración de credenciales

---

## ✅ Checklist

- [ ] Vercel desplegado
- [ ] Variables de entorno configuradas
- [ ] Health check funcionando
- [ ] API key verificada
- [ ] OpenClaw conectado
- [ ] Pruebas ejecutadas

---

**¡Listo para usar!**
