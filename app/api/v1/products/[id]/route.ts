import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/v1/products/[id]
 * 
 * Obtiene detalles completos de un producto
 * 
 * Headers requeridos:
 * - Authorization: Bearer <API_KEY>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')
    
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        code,
        name,
        description,
        price,
        cost,
        status,
        created_at,
        updated_at,
        variants:product_variants(
          id,
          size,
          current_stock
        )
      `)
      .eq('id', params.id)
      .single()

    if (error || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    const totalStock = product.variants?.reduce((sum: number, v: any) => sum + v.current_stock, 0) || 0

    return NextResponse.json({
      success: true,
      data: {
        id: product.id,
        code: product.code,
        name: product.name,
        description: product.description,
        price: product.price,
        cost: product.cost,
        margin: product.price - product.cost,
        marginPercent: ((product.price - product.cost) / product.price * 100).toFixed(2),
        status: product.status,
        totalStock,
        stockValue: totalStock * product.price,
        variants: product.variants,
        createdAt: product.created_at,
        updatedAt: product.updated_at,
      },
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
