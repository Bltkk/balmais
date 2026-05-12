import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Period = '7d' | '30d' | '90d' | '365d' | 'all'

interface RawMovement {
  type: 'in' | 'out'
  quantity: number
  sale_price: number | null
  confirmed: boolean
  created_at: string
  variant: {
    size: string
    product: { id: string; name: string; price: number; cost: number }
  } | null
}

function getFromDate(period: Period): Date | null {
  if (period === 'all') return null
  const d = new Date()
  const days: Record<Exclude<Period, 'all'>, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '365d': 365,
  }
  d.setDate(d.getDate() - days[period])
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * GET /api/v1/analytics
 * 
 * Obtiene métricas de analytics del inventario
 * 
 * Query params:
 * - period: '7d' | '30d' | '90d' | '365d' | 'all' (default: '30d')
 * - productId: filtrar por producto específico (opcional)
 * 
 * Headers requeridos:
 * - Authorization: Bearer <API_KEY>
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')
    
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || '30d') as Period
    const productId = searchParams.get('productId')

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const from = getFromDate(period)

    // Obtener movimientos
    let movementsQuery = supabaseAdmin
      .from('stock_movements')
      .select(`
        type,
        quantity,
        sale_price,
        confirmed,
        created_at,
        variant:product_variants(
          size,
          product:products(id, name, price, cost)
        )
      `)
      .order('created_at', { ascending: true })

    if (from) {
      movementsQuery = movementsQuery.gte('created_at', from.toISOString())
    }

    const { data: movements } = await movementsQuery

    // Filtrar movimientos confirmados o anteriores a hoy
    const filteredMovements = ((movements || []) as unknown as RawMovement[]).filter(
      (m) => m.confirmed || new Date(m.created_at) < startOfToday
    )

    // Filtrar por producto si se especifica
    const relevantMovements = productId
      ? filteredMovements.filter((m) => m.variant?.product?.id === productId)
      : filteredMovements

    // Obtener stock actual
    let stockQuery = supabaseAdmin
      .from('products')
      .select(`
        id,
        name,
        price,
        cost,
        variants:product_variants(size, current_stock)
      `)

    if (productId) {
      stockQuery = stockQuery.eq('id', productId)
    }

    const { data: products } = await stockQuery

    // Calcular métricas
    const totalOutQty = relevantMovements
      .filter((m) => m.type === 'out')
      .reduce((sum, m) => sum + m.quantity, 0)

    const totalInQty = relevantMovements
      .filter((m) => m.type === 'in')
      .reduce((sum, m) => sum + m.quantity, 0)

    const totalOutValue = relevantMovements
      .filter((m) => m.type === 'out')
      .reduce((sum, m) => {
        const price = m.sale_price ?? m.variant?.product?.price ?? 0
        return sum + m.quantity * price
      }, 0)

    const totalInValue = relevantMovements
      .filter((m) => m.type === 'in')
      .reduce((sum, m) => {
        const price = m.variant?.product?.price ?? 0
        return sum + m.quantity * price
      }, 0)

    // Stock actual
    const currentStock = (products || []).reduce((sum: number, p: any) => {
      return sum + (p.variants?.reduce((s: number, v: any) => s + v.current_stock, 0) || 0)
    }, 0)

    const currentStockValue = (products || []).reduce((sum: number, p: any) => {
      const stock = p.variants?.reduce((s: number, v: any) => s + v.current_stock, 0) || 0
      return sum + stock * p.price
    }, 0)

    // Calcular KPIs
    const periodDays = period === 'all' ? 365 : { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[period]
    const dailyOut = totalOutQty / periodDays
    const daysInventory = dailyOut > 0 ? Math.round(currentStock / dailyOut) : null
    const rotation = currentStock > 0 ? totalOutQty / currentStock : null
    const avgDailyValue = totalOutValue / periodDays

    // Análisis ABC
    const abcMap = new Map<string, number>()
    relevantMovements
      .filter((m) => m.type === 'out')
      .forEach((m) => {
        const key = m.variant?.product?.id || 'unknown'
        abcMap.set(key, (abcMap.get(key) || 0) + m.quantity)
      })

    const total = Array.from(abcMap.values()).reduce((s, v) => s + v, 0)
    const abcAnalysis = Array.from(abcMap.entries())
      .map(([id, qty]) => {
        const product = products?.find((p: any) => p.id === id)
        return {
          productId: id,
          productName: product?.name || 'Unknown',
          quantity: qty,
          percentage: total > 0 ? (qty / total) * 100 : 0,
        }
      })
      .sort((a, b) => b.quantity - a.quantity)
      .map((item, idx, arr) => {
        const cumulative = arr.slice(0, idx + 1).reduce((s, i) => s + i.quantity, 0)
        const cumulativePercent = total > 0 ? (cumulative / total) * 100 : 0
        return {
          ...item,
          cumulativePercent,
          classification: cumulativePercent <= 80 ? 'A' : cumulativePercent <= 95 ? 'B' : 'C',
        }
      })

    // Productos con bajo stock
    const lowStockProducts = (products || [])
      .map((p: any) => {
        const stock = p.variants?.reduce((s: number, v: any) => s + v.current_stock, 0) || 0
        return {
          id: p.id,
          name: p.name,
          stock,
          price: p.price,
          value: stock * p.price,
          variants: p.variants,
        }
      })
      .filter((p) => p.stock < 10)
      .sort((a, b) => a.stock - b.stock)

    return NextResponse.json({
      success: true,
      period,
      data: {
        kpis: {
          totalOutQty,
          totalInQty,
          totalOutValue,
          totalInValue,
          currentStock,
          currentStockValue,
          dailyOut: Math.round(dailyOut * 100) / 100,
          avgDailyValue: Math.round(avgDailyValue * 100) / 100,
          daysInventory,
          rotation: rotation ? Math.round(rotation * 100) / 100 : null,
          periodDays,
        },
        abc: abcAnalysis,
        lowStockProducts,
        summary: {
          totalProducts: products?.length || 0,
          activeProducts: products?.filter((p: any) => p.variants?.some((v: any) => v.current_stock > 0)).length || 0,
          outOfStockProducts: products?.filter((p: any) => !p.variants?.some((v: any) => v.current_stock > 0)).length || 0,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
