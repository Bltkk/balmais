# OpenClaw Integration Guide

## 🔗 Integración con tu Agente de OpenClaw

Esta guía te muestra cómo conectar tu agente de OpenClaw con la API de inventario.

---

## 📋 Configuración Inicial

### 1. Obtener API Key
```
API_KEY: balmais-api-key-2025-secure
BASE_URL: https://tu-dominio.com/api/v1
```

### 2. Configurar en OpenClaw
```python
# En tu agente de OpenClaw
INVENTORY_API_KEY = "balmais-api-key-2025-secure"
INVENTORY_BASE_URL = "https://tu-dominio.com/api/v1"
```

---

## 🚀 Ejemplos de Uso

### 1. Obtener Todos los Productos

```python
import requests

def get_all_products():
    """Obtiene lista de todos los productos"""
    headers = {"Authorization": f"Bearer {INVENTORY_API_KEY}"}
    
    response = requests.get(
        f"{INVENTORY_BASE_URL}/products",
        headers=headers,
        params={
            "limit": 50,
            "offset": 0,
            "status": "active"
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        products = data["data"]
        
        for product in products:
            print(f"Código: {product['code']}")
            print(f"Nombre: {product['name']}")
            print(f"Precio: ${product['price']}")
            print(f"Stock: {product['totalStock']} unidades")
            print(f"Margen: {product['marginPercent']}%")
            print("---")
        
        return products
    else:
        print(f"Error: {response.status_code}")
        return None

# Usar
products = get_all_products()
```

### 2. Buscar Producto Específico

```python
def search_product(code_or_name):
    """Busca un producto por código o nombre"""
    headers = {"Authorization": f"Bearer {INVENTORY_API_KEY}"}
    
    response = requests.get(
        f"{INVENTORY_BASE_URL}/products",
        headers=headers,
        params={"search": code_or_name}
    )
    
    if response.status_code == 200:
        data = response.json()
        products = data["data"]
        
        if products:
            product = products[0]
            print(f"Encontrado: {product['name']}")
            print(f"Stock: {product['totalStock']} unidades")
            print(f"Valor: ${product['stockValue']}")
            return product
        else:
            print("Producto no encontrado")
            return None
    else:
        print(f"Error: {response.status_code}")
        return None

# Usar
product = search_product("P001")
```

### 3. Obtener Detalles de Producto

```python
def get_product_details(product_id):
    """Obtiene detalles completos de un producto"""
    headers = {"Authorization": f"Bearer {INVENTORY_API_KEY}"}
    
    response = requests.get(
        f"{INVENTORY_BASE_URL}/products/{product_id}",
        headers=headers
    )
    
    if response.status_code == 200:
        product = response.json()["data"]
        
        print(f"Producto: {product['name']}")
        print(f"Código: {product['code']}")
        print(f"Precio: ${product['price']}")
        print(f"Costo: ${product['cost']}")
        print(f"Margen: ${product['margin']} ({product['marginPercent']}%)")
        print(f"Stock Total: {product['totalStock']} unidades")
        print(f"Valor Total: ${product['stockValue']}")
        print("\nVariantes:")
        
        for variant in product['variants']:
            print(f"  - {variant['size']}: {variant['current_stock']} unidades")
        
        return product
    else:
        print(f"Error: {response.status_code}")
        return None

# Usar
product = get_product_details("550e8400-e29b-41d4-a716-446655440000")
```

### 4. Consultar Stock Actual

```python
def get_stock_status():
    """Obtiene estado actual del stock"""
    headers = {"Authorization": f"Bearer {INVENTORY_API_KEY}"}
    
    response = requests.get(
        f"{INVENTORY_BASE_URL}/stock",
        headers=headers
    )
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"Total de productos: {data['totals']['totalProducts']}")
        print(f"Stock total: {data['totals']['totalStock']} unidades")
        print(f"Valor total: ${data['totals']['totalValue']}")
        print(f"Productos sin stock: {data['totals']['outOfStock']}")
        print(f"Productos con bajo stock: {data['totals']['lowStock']}")
        
        # Mostrar productos con bajo stock
        print("\nProductos con bajo stock:")
        for product in data['data']:
            if product['status'] == 'low_stock':
                print(f"  - {product['name']}: {product['totalStock']} unidades")
        
        return data
    else:
        print(f"Error: {response.status_code}")
        return None

# Usar
stock = get_stock_status()
```

### 5. Actualizar Stock

```python
def update_stock(variant_id, quantity, movement_type, notes=""):
    """Actualiza el stock de una variante"""
    headers = {
        "Authorization": f"Bearer {INVENTORY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "variantId": variant_id,
        "quantity": quantity,
        "type": movement_type,  # "in" o "out"
        "notes": notes
    }
    
    response = requests.post(
        f"{INVENTORY_BASE_URL}/stock",
        headers=headers,
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()["data"]
        print(f"Stock actualizado exitosamente")
        print(f"Stock anterior: {data['previousStock']}")
        print(f"Stock nuevo: {data['newStock']}")
        print(f"Cambio: {data['quantity']} unidades ({data['type']})")
        return data
    else:
        error = response.json()
        print(f"Error: {error['error']}")
        return None

# Usar - Agregar stock
update_stock(
    variant_id="550e8400-e29b-41d4-a716-446655440000",
    quantity=10,
    movement_type="in",
    notes="Restock desde proveedor"
)

# Usar - Restar stock
update_stock(
    variant_id="550e8400-e29b-41d4-a716-446655440000",
    quantity=5,
    movement_type="out",
    notes="Venta online"
)
```

### 6. Obtener Analytics

```python
def get_analytics(period="30d"):
    """Obtiene métricas de analytics"""
    headers = {"Authorization": f"Bearer {INVENTORY_API_KEY}"}
    
    response = requests.get(
        f"{INVENTORY_BASE_URL}/analytics",
        headers=headers,
        params={"period": period}
    )
    
    if response.status_code == 200:
        data = response.json()["data"]
        kpis = data["kpis"]
        
        print(f"Período: {period}")
        print(f"\nKPIs:")
        print(f"  Salidas: {kpis['totalOutQty']} unidades")
        print(f"  Entradas: {kpis['totalInQty']} unidades")
        print(f"  Valor de salidas: ${kpis['totalOutValue']}")
        print(f"  Stock actual: {kpis['currentStock']} unidades")
        print(f"  Valor del stock: ${kpis['currentStockValue']}")
        print(f"  Rotación: {kpis['rotation']}x")
        print(f"  Días de inventario: {kpis['daysInventory']} días")
        
        print(f"\nProductos ABC (Top 5):")
        for item in data["abc"][:5]:
            print(f"  {item['classification']} - {item['productName']}: {item['quantity']} unidades")
        
        print(f"\nProductos con bajo stock:")
        for product in data["lowStockProducts"]:
            print(f"  - {product['name']}: {product['stock']} unidades")
        
        return data
    else:
        print(f"Error: {response.status_code}")
        return None

# Usar
analytics = get_analytics(period="30d")
```

### 7. Obtener Historial de Movimientos

```python
def get_movements(movement_type=None, limit=20):
    """Obtiene historial de movimientos"""
    headers = {"Authorization": f"Bearer {INVENTORY_API_KEY}"}
    
    params = {
        "limit": limit,
        "offset": 0
    }
    
    if movement_type:
        params["type"] = movement_type  # "in" o "out"
    
    response = requests.get(
        f"{INVENTORY_BASE_URL}/movements",
        headers=headers,
        params=params
    )
    
    if response.status_code == 200:
        data = response.json()
        movements = data["data"]
        
        print(f"Últimos {len(movements)} movimientos:")
        for movement in movements:
            print(f"\nFecha: {movement['createdAt']}")
            print(f"Tipo: {movement['type'].upper()}")
            print(f"Producto: {movement['product']['name']} ({movement['product']['code']})")
            print(f"Talla: {movement['variant']['size']}")
            print(f"Cantidad: {movement['quantity']} unidades")
            print(f"Stock después: {movement['stockAfter']} unidades")
            print(f"Valor: ${movement['value']}")
            if movement['notes']:
                print(f"Notas: {movement['notes']}")
        
        print(f"\nTotales:")
        print(f"  Cantidad total: {data['totals']['quantity']} unidades")
        print(f"  Valor total: ${data['totals']['value']}")
        print(f"  Margen total: ${data['totals']['margin']}")
        
        return data
    else:
        print(f"Error: {response.status_code}")
        return None

# Usar
movements = get_movements(movement_type="out", limit=10)
```

---

## 🤖 Integración con OpenClaw

### Ejemplo: Agente que Monitorea Stock

```python
class InventoryAgent:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {api_key}"}
    
    def check_low_stock(self):
        """Verifica productos con bajo stock"""
        response = requests.get(
            f"{self.base_url}/stock",
            headers=self.headers
        )
        
        if response.status_code == 200:
            data = response.json()
            low_stock = [p for p in data['data'] if p['status'] == 'low_stock']
            
            if low_stock:
                print(f"⚠️ {len(low_stock)} productos con bajo stock:")
                for product in low_stock:
                    print(f"  - {product['name']}: {product['totalStock']} unidades")
                return low_stock
            else:
                print("✅ Todos los productos tienen stock suficiente")
                return []
        else:
            print(f"Error: {response.status_code}")
            return []
    
    def get_sales_report(self, period="30d"):
        """Obtiene reporte de ventas"""
        response = requests.get(
            f"{self.base_url}/analytics",
            headers=self.headers,
            params={"period": period}
        )
        
        if response.status_code == 200:
            data = response.json()["data"]
            kpis = data["kpis"]
            
            report = {
                "period": period,
                "total_sales": kpis['totalOutQty'],
                "total_value": kpis['totalOutValue'],
                "rotation": kpis['rotation'],
                "days_inventory": kpis['daysInventory'],
                "top_products": data["abc"][:5]
            }
            
            return report
        else:
            print(f"Error: {response.status_code}")
            return None
    
    def process_sale(self, variant_id, quantity):
        """Procesa una venta"""
        payload = {
            "variantId": variant_id,
            "quantity": quantity,
            "type": "out",
            "notes": "Venta procesada por agente"
        }
        
        response = requests.post(
            f"{self.base_url}/stock",
            headers={**self.headers, "Content-Type": "application/json"},
            json=payload
        )
        
        if response.status_code == 200:
            return response.json()["data"]
        else:
            print(f"Error: {response.json()['error']}")
            return None

# Usar
agent = InventoryAgent(
    api_key="balmais-api-key-2025-secure",
    base_url="https://tu-dominio.com/api/v1"
)

# Verificar bajo stock
low_stock = agent.check_low_stock()

# Obtener reporte
report = agent.get_sales_report(period="30d")
print(f"Ventas del mes: {report['total_sales']} unidades")
print(f"Valor: ${report['total_value']}")

# Procesar venta
result = agent.process_sale(
    variant_id="550e8400-e29b-41d4-a716-446655440000",
    quantity=5
)
```

---

## 🔄 Flujos de Trabajo Comunes

### 1. Monitoreo Diario
```python
def daily_monitoring():
    """Ejecuta monitoreo diario"""
    agent = InventoryAgent(API_KEY, BASE_URL)
    
    # Verificar bajo stock
    low_stock = agent.check_low_stock()
    
    # Obtener reporte del día
    report = agent.get_sales_report(period="7d")
    
    # Alertar si hay problemas
    if low_stock:
        send_alert(f"⚠️ {len(low_stock)} productos con bajo stock")
    
    if report['rotation'] < 0.5:
        send_alert(f"⚠️ Rotación baja: {report['rotation']}x")
```

### 2. Procesamiento de Ventas
```python
def process_order(order_items):
    """Procesa un pedido"""
    agent = InventoryAgent(API_KEY, BASE_URL)
    
    for item in order_items:
        result = agent.process_sale(
            variant_id=item['variant_id'],
            quantity=item['quantity']
        )
        
        if result:
            print(f"✅ Venta procesada: {item['quantity']} unidades")
        else:
            print(f"❌ Error procesando venta")
```

### 3. Restock Automático
```python
def auto_restock():
    """Restock automático de productos"""
    agent = InventoryAgent(API_KEY, BASE_URL)
    
    # Obtener productos con bajo stock
    low_stock = agent.check_low_stock()
    
    for product in low_stock:
        # Calcular cantidad a reabastecer
        restock_qty = 50  # Cantidad fija
        
        # Actualizar stock
        result = agent.process_sale(
            variant_id=product['id'],
            quantity=restock_qty,
            movement_type="in"
        )
        
        if result:
            print(f"✅ Restock: {product['name']} +{restock_qty}")
```

---

## 🔒 Seguridad

### Mejores Prácticas
1. **Guardar API key de forma segura**
   ```python
   import os
   API_KEY = os.getenv("INVENTORY_API_KEY")
   ```

2. **Usar HTTPS siempre**
   ```python
   BASE_URL = "https://tu-dominio.com/api/v1"  # ✅
   # NO: BASE_URL = "http://tu-dominio.com/api/v1"  # ❌
   ```

3. **Manejar errores**
   ```python
   try:
       response = requests.get(url, headers=headers)
       response.raise_for_status()
   except requests.exceptions.RequestException as e:
       print(f"Error: {e}")
   ```

4. **Validar respuestas**
   ```python
   if response.status_code == 200:
       data = response.json()
       if data.get("success"):
           # Procesar datos
   ```

---

## 📞 Soporte

### Documentación
- `docs/API.md` - Documentación completa
- `docs/SECURITY.md` - Guía de seguridad

### Errores Comunes

**401 Unauthorized**
- Verificar API_KEY
- Verificar formato: `Bearer <key>`

**429 Too Many Requests**
- Esperar 1 minuto
- Implementar retry logic

**400 Bad Request**
- Verificar parámetros
- Verificar formato JSON

**404 Not Found**
- Verificar ID del recurso
- Verificar endpoint

---

## 🎉 Conclusión

Tu agente de OpenClaw ahora puede:
- ✅ Consultar productos
- ✅ Verificar stock
- ✅ Obtener analytics
- ✅ Procesar ventas
- ✅ Monitorear inventario

¡Listo para integrar!
