# Plan de Implementación: Sistema de Gestión de Inventario

## Descripción General

Este plan implementa un sistema web de gestión de inventario usando Next.js 14 (App Router), Supabase (PostgreSQL + Auth), y TypeScript. La implementación sigue un enfoque incremental, construyendo desde la autenticación hasta las funcionalidades completas de gestión de productos, stock, y reportes.

## Tareas

- [x] 1. Configurar proyecto y estructura base
  - Inicializar proyecto Next.js 14 con TypeScript
  - Instalar dependencias: Supabase client, React Query, Zod, fast-check
  - Crear estructura de carpetas según diseño (app/, actions/, lib/, types/)
  - Configurar variables de entorno para Supabase
  - _Requisitos: 7.1, 7.2, 7.3_

- [ ] 2. Configurar base de datos y autenticación
  - [x] 2.1 Crear esquema de base de datos en Supabase
    - Ejecutar script SQL para crear tablas `products` y `stock_movements`
    - Crear índices para optimización de queries
    - Configurar trigger para `updated_at`
    - _Requisitos: 7.1, 7.2, 7.3_
  
  - [x] 2.2 Configurar Row Level Security policies
    - Habilitar RLS en tablas `products` y `stock_movements`
    - Crear políticas de SELECT, INSERT, UPDATE, DELETE para productos
    - Crear políticas para movimientos de stock
    - _Requisitos: 1.3, 1.4_
  
  - [x] 2.3 Implementar tipos TypeScript y esquemas de validación
    - Crear interfaces en `types/database.ts` (Product, StockMovement, etc.)
    - Crear schemas Zod en `lib/validations.ts` (productSchema, stockMovementSchema, loginSchema)
    - _Requisitos: 6.1, 6.2, 6.3, 6.4_

- [ ] 3. Implementar autenticación
  - [ ] 3.1 Crear Server Actions de autenticación
    - Implementar `signIn()` en `app/actions/auth.ts`
    - Implementar `signOut()` en `app/actions/auth.ts`
    - Implementar `getSession()` en `app/actions/auth.ts`
    - Manejar errores de credenciales inválidas
    - _Requisitos: 1.1, 1.2, 1.5_
  
  - [ ] 3.2 Crear middleware para gestión de sesiones
    - Implementar `middleware.ts` para refresh de sesión
    - Proteger rutas del dashboard
    - Redirigir usuarios no autenticados a login
    - _Requisitos: 8.1, 8.2, 8.3_
  
  - [ ] 3.3 Implementar componentes de login
    - Crear `LoginForm` (Client Component) en `app/(auth)/login/page.tsx`
    - Implementar validación de formulario con Zod
    - Mostrar errores de autenticación
    - _Requisitos: 1.1, 1.2_
  
  - [ ] 3.4 Crear AuthProvider y contexto de usuario
    - Implementar `AuthProvider` con contexto de sesión
    - Proveer `user`, `loading`, `signOut` a componentes
    - _Requisitos: 1.3, 8.1_

- [ ] 4. Checkpoint - Verificar autenticación
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 5. Implementar gestión de productos
  - [ ] 5.1 Crear Server Actions de productos
    - Implementar `createProduct()` con validación y manejo de errores
    - Implementar `updateProduct()` con validación de código único
    - Implementar `deleteProduct()` con cascade de movimientos
    - Implementar `getProducts()` con filtros y ordenamiento
    - Implementar `getProductById()`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.4_
  
  - [ ]* 5.2 Escribir property test para persistencia de productos
    - **Propiedad 1: Product Round-Trip Persistence**
    - **Valida: Requisitos 2.2, 7.1**
  
  - [ ]* 5.3 Escribir property test para códigos únicos
    - **Propiedad 2: Unique Product Code Enforcement**
    - **Valida: Requisitos 2.1, 2.3, 2.4**
  
  - [ ]* 5.4 Escribir property test para eliminación en cascada
    - **Propiedad 3: Cascade Deletion**
    - **Valida: Requisitos 2.5**
  
  - [ ]* 5.5 Escribir property test para validación de productos
    - **Propiedad 14: Product Validation Rules**
    - **Valida: Requisitos 6.1, 6.2, 6.3, 6.4**
  
  - [ ] 5.6 Crear componente ProductForm
    - Implementar formulario para crear/editar productos (Client Component)
    - Validación del lado del cliente con Zod
    - Manejo de errores por campo
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 6.1, 6.2, 6.3, 6.4_
  
  - [ ] 5.7 Crear componente ProductList
    - Implementar lista de productos (Server Component)
    - Mostrar código, nombre, precio, stock
    - Implementar ordenamiento por código por defecto
    - _Requisitos: 4.1, 4.4_
  
  - [ ] 5.8 Crear páginas de productos
    - Crear `app/(dashboard)/products/page.tsx` (lista)
    - Crear `app/(dashboard)/products/new/page.tsx` (crear)
    - Crear `app/(dashboard)/products/[id]/page.tsx` (detalle/editar)
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 4.1_

- [ ] 6. Implementar búsqueda y filtrado de productos
  - [ ] 6.1 Agregar funcionalidad de búsqueda
    - Implementar búsqueda por código y nombre (case-insensitive)
    - Agregar input de búsqueda en ProductList
    - _Requisitos: 4.3_
  
  - [ ]* 6.2 Escribir property test para búsqueda
    - **Propiedad 9: Search Filtering Correctness**
    - **Valida: Requisitos 4.3**
  
  - [ ]* 6.3 Escribir property test para ordenamiento por defecto
    - **Propiedad 10: Product List Default Sorting**
    - **Valida: Requisitos 4.4**

- [ ] 7. Checkpoint - Verificar gestión de productos
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 8. Implementar control de stock
  - [ ] 8.1 Crear Server Actions de stock
    - Implementar `recordStockMovement()` con validación de stock negativo
    - Implementar actualización de `current_stock` en producto
    - Implementar `getStockHistory()` con filtros de fecha
    - Implementar `exportStockHistory()` para generar CSV
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 9.1, 9.2, 9.3, 9.5_
  
  - [ ]* 8.2 Escribir property test para movimientos de stock
    - **Propiedad 4: Stock Movement Updates Stock Correctly**
    - **Valida: Requisitos 3.2, 3.3**
  
  - [ ]* 8.3 Escribir property test para prevención de stock negativo
    - **Propiedad 5: Negative Stock Prevention**
    - **Valida: Requisitos 3.4**
  
  - [ ]* 8.4 Escribir property test para persistencia de movimientos
    - **Propiedad 6: Movement Persistence with Required Fields**
    - **Valida: Requisitos 3.5, 4.5, 7.2, 7.3, 9.1, 9.4**
  
  - [ ] 8.5 Crear componente StockMovementForm
    - Implementar formulario para registrar entradas/salidas (Client Component)
    - Validación de cantidad positiva
    - Prevención de stock negativo en UI
    - _Requisitos: 3.2, 3.3, 3.4_
  
  - [ ] 8.6 Crear componente StockHistory
    - Implementar historial de movimientos (Server Component)
    - Mostrar tipo, cantidad, stock_after, fecha, usuario
    - Ordenar por fecha descendente
    - _Requisitos: 4.5, 9.1, 9.2, 9.4_
  
  - [ ] 8.7 Agregar filtrado por rango de fechas
    - Implementar filtros de fecha en StockHistory
    - Agregar controles de fecha en UI
    - _Requisitos: 9.3_
  
  - [ ]* 8.8 Escribir property test para ordenamiento de historial
    - **Propiedad 11: Movement History Sorting**
    - **Valida: Requisitos 9.2**
  
  - [ ]* 8.9 Escribir property test para filtrado por fechas
    - **Propiedad 12: Date Range Filtering**
    - **Valida: Requisitos 9.3**
  
  - [ ] 8.10 Implementar exportación a CSV
    - Crear función para generar CSV desde movimientos
    - Agregar botón de exportación en UI
    - _Requisitos: 9.5_
  
  - [ ]* 8.11 Escribir property test para exportación CSV
    - **Propiedad 13: CSV Export Completeness**
    - **Valida: Requisitos 9.5**

- [ ] 9. Implementar cálculo de valor de inventario
  - [ ] 9.1 Crear funciones de cálculo de valor
    - Implementar cálculo de valor por producto (precio × stock)
    - Implementar cálculo de valor total de inventario
    - Agregar campo `inventory_value` en queries
    - _Requisitos: 4.2, 5.1, 5.2, 5.4_
  
  - [ ]* 9.2 Escribir property test para valor por producto
    - **Propiedad 7: Inventory Value Calculation Per Product**
    - **Valida: Requisitos 4.2**
  
  - [ ]* 9.3 Escribir property test para valor total
    - **Propiedad 8: Total Inventory Value Calculation**
    - **Valida: Requisitos 5.1, 5.4**
  
  - [ ] 9.4 Crear componente InventoryValueCard
    - Implementar card para mostrar valor total (Server Component)
    - Mostrar en dashboard principal
    - _Requisitos: 5.3_
  
  - [ ] 9.5 Agregar columna de valor en ProductList
    - Mostrar valor de inventario por producto
    - Calcular y mostrar en tabla
    - _Requisitos: 4.2_

- [ ] 10. Checkpoint - Verificar cálculos y stock
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 11. Implementar dashboard principal
  - [ ] 11.1 Crear layout del dashboard
    - Implementar `app/(dashboard)/layout.tsx` con navegación
    - Agregar protección de autenticación
    - Mostrar información de usuario
    - _Requisitos: 1.3, 8.1_
  
  - [ ] 11.2 Crear página principal del dashboard
    - Implementar `app/(dashboard)/page.tsx`
    - Mostrar InventoryValueCard
    - Mostrar resumen de productos
    - Agregar enlaces a secciones principales
    - _Requisitos: 4.1, 5.3_
  
  - [ ] 11.3 Implementar navegación y menú
    - Crear componente de navegación
    - Enlaces a productos, reportes, configuración
    - Botón de cerrar sesión
    - _Requisitos: 1.5_

- [ ] 12. Implementar interfaz responsiva
  - [ ] 12.1 Agregar estilos responsivos con Tailwind CSS
    - Configurar breakpoints para desktop (>1024px), tablet (768-1024px), móvil (<768px)
    - Adaptar ProductList para diferentes tamaños
    - Adaptar formularios para móvil
    - _Requisitos: 10.1, 10.2, 10.3_
  
  - [ ] 12.2 Optimizar navegación móvil
    - Implementar menú hamburguesa para móvil
    - Asegurar accesibilidad de funcionalidades principales
    - _Requisitos: 10.4_
  
  - [ ] 12.3 Optimizar rendimiento de carga
    - Implementar lazy loading de componentes
    - Optimizar imágenes y assets
    - Verificar tiempo de carga <3s
    - _Requisitos: 10.5_

- [ ] 13. Implementar manejo de errores y retry logic
  - [ ] 13.1 Crear utilidad de retry
    - Implementar `withRetry()` en `lib/retry.ts`
    - Configurar 3 intentos con backoff exponencial
    - Excluir errores de validación y autenticación
    - _Requisitos: 7.4_
  
  - [ ] 13.2 Agregar manejo de errores en Server Actions
    - Implementar try-catch en todas las acciones
    - Clasificar errores (validation, business, auth, database)
    - Retornar errores estructurados
    - _Requisitos: 1.2, 2.3, 3.4, 6.4, 7.4_
  
  - [ ] 13.3 Implementar display de errores en cliente
    - Crear componente Toast para notificaciones
    - Mostrar errores por campo en formularios
    - Agregar opción de retry para errores transitorios
    - _Requisitos: 1.2, 2.3, 3.4, 6.4, 7.4_

- [ ] 14. Implementar gestión de sesiones avanzada
  - [ ] 14.1 Configurar expiración de sesión por inactividad
    - Implementar timeout de 30 minutos
    - Redirigir a login cuando expire
    - _Requisitos: 8.2, 8.3_
  
  - [ ] 14.2 Implementar sesión única por usuario
    - Invalidar sesiones previas al iniciar sesión
    - Manejar múltiples dispositivos
    - _Requisitos: 8.4, 8.5_

- [ ] 15. Implementar página de reportes
  - [ ] 15.1 Crear página de reportes de movimientos
    - Implementar `app/(dashboard)/reports/page.tsx`
    - Mostrar todos los movimientos con filtros
    - Agregar filtros por producto, tipo, rango de fechas
    - _Requisitos: 9.1, 9.2, 9.3_
  
  - [ ] 15.2 Agregar exportación de reportes
    - Botón para exportar movimientos filtrados a CSV
    - Incluir todas las columnas requeridas
    - _Requisitos: 9.5_

- [ ] 16. Configurar React Query para caché y sincronización
  - [ ] 16.1 Configurar QueryClient
    - Instalar y configurar React Query
    - Crear QueryClientProvider en layout
    - Configurar opciones de caché y refetch
    - _Requisitos: 5.2, 7.5_
  
  - [ ] 16.2 Implementar queries y mutations
    - Crear hooks personalizados para productos (useProducts, useProduct)
    - Crear hooks para stock (useStockHistory)
    - Implementar invalidación de caché después de mutaciones
    - _Requisitos: 5.2, 7.5_

- [ ] 17. Checkpoint final - Verificar integración completa
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ]* 18. Escribir tests de integración
  - [ ]* 18.1 Escribir tests de flujo de autenticación
    - Test de login exitoso y creación de sesión
    - Test de protección de rutas sin autenticación
    - _Requisitos: 1.1, 1.2, 1.3_
  
  - [ ]* 18.2 Escribir tests de Row Level Security
    - Test de aislamiento de datos entre usuarios
    - Verificar que usuarios no accedan a productos de otros
    - _Requisitos: 1.3, 1.4_
  
  - [ ]* 18.3 Escribir tests end-to-end
    - Test de flujo completo: crear producto → agregar stock → ver historial
    - Test de cálculo de valor total con múltiples productos
    - _Requisitos: 2.1, 3.2, 4.1, 5.1_

- [ ] 19. Integración final y documentación
  - [ ] 19.1 Verificar cobertura de requisitos
    - Revisar que todos los requisitos estén implementados
    - Verificar que todas las propiedades de corrección estén validadas
    - Ejecutar suite completa de tests
  
  - [ ] 19.2 Crear README con instrucciones
    - Documentar setup de proyecto
    - Documentar configuración de Supabase
    - Documentar comandos de desarrollo y testing
  
  - [ ] 19.3 Preparar para deployment
    - Configurar variables de entorno de producción
    - Verificar configuración de Supabase para producción
    - Documentar proceso de deployment

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los property tests validan propiedades universales de corrección
- Los tests unitarios validan ejemplos específicos y casos edge
- Los tests de integración validan flujos end-to-end y seguridad
