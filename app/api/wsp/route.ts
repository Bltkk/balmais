import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

async function verifySignature(request: NextRequest, rawBody: string): Promise<boolean> {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) return false
  const signature = request.headers.get('x-hub-signature-256')
  if (!signature) return false
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

function isAuthorizedSender(from: string): boolean {
  const whitelist = process.env.WHATSAPP_ALLOWED_NUMBERS
  if (!whitelist) return true // si no hay whitelist, acepta todos
  return whitelist.split(',').map(n => n.trim()).includes(from)
}

interface WhatsAppMessage {
  from: string
  id: string
  timestamp: string
  text?: { body: string }
  type: string
}

interface WhatsAppEntry {
  id: string
  changes: Array<{
    value: {
      messaging_product: string
      metadata: { display_phone_number: string; phone_number_id: string }
      messages?: WhatsAppMessage[]
    }
    field: string
  }>
}

async function sendWhatsAppMessage(to: string, text: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    console.error('Missing WhatsApp credentials')
    return
  }

  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })
}

async function findProductByCode(code: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('products')
    .select('*, variants:product_variants(id, size, current_stock)')
    .eq('code', code)
    .eq('user_id', userId)
    .single()
  return data
}

function resolveVariant(
  product: { name: string; code: string; variants?: { id: string; size: string; current_stock: number }[] },
  size: string | null
): { variant?: { id: string; size: string; current_stock: number }; error?: string } {
  const variants = product.variants ?? []

  if (variants.length === 0) {
    return { error: 'Este producto no tiene tallas registradas.' }
  }

  if (size) {
    const v = variants.find(v => v.size.toUpperCase() === size.toUpperCase())
    if (!v) {
      const available = variants.map(v => v.size).join(', ')
      return { error: `Talla "${size}" no encontrada. Disponibles: ${available}` }
    }
    return { variant: v }
  }

  if (variants.length === 1) {
    return { variant: variants[0] }
  }

  const available = variants.map(v => `${v.size}(${v.current_stock})`).join(', ')
  return { error: `Especificá la talla. Disponibles: ${available}\nEjemplo: P${product.code} M 5` }
}

async function handleStockOperation(
  code: string,
  size: string | null,
  quantity: number,
  type: 'in' | 'out',
  userId: string
): Promise<string> {
  const product = await findProductByCode(code, userId)
  if (!product) return `Producto con código "${code}" no encontrado.`

  const { variant, error } = resolveVariant(product, size)
  if (error || !variant) return `❌ ${error}`

  const { data, error: rpcError } = await supabaseAdmin.rpc('register_stock_movement_admin', {
    p_variant_id: variant.id,
    p_type: type,
    p_quantity: quantity,
    p_notes: 'Via WhatsApp',
    p_user_id: userId,
  })

  if (rpcError) {
    const msg = rpcError.message ?? 'Error desconocido'
    return `❌ ${msg}`
  }

  const sign = type === 'out' ? `-${quantity}` : `+${quantity}`
  const emoji = type === 'out' ? '📦' : '📥'
  let msg = `${emoji} Stock actualizado!\n\nProducto: ${product.name} (${code})\nTalla: ${variant.size}\nCantidad: ${sign}\nStock nuevo: ${data.stock_after}`

  if (type === 'out') {
    if (data.stock_after === 0) {
      msg += `\n\n🚨 *QUIEBRE DE STOCK*\n${product.name} talla ${variant.size} quedó sin unidades.`
    } else if (data.stock_after < 5) {
      msg += `\n\n⚠️ *Stock bajo* — quedan solo ${data.stock_after} unidades.`
    }
  }

  return msg
}

async function handleStockQuery(code: string, userId: string): Promise<string> {
  const product = await findProductByCode(code, userId)
  if (!product) return `Producto "${code}" no encontrado.`

  const variants = product.variants ?? []
  const total = variants.reduce((s: number, v: { current_stock: number }) => s + v.current_stock, 0)

  let res = `📦 ${product.name} (${code})\nPrecio: $${product.price}\n\nStock por talla:\n`
  variants.forEach((v: { size: string; current_stock: number }) => {
    const icon = v.current_stock === 0 ? '❌' : v.current_stock < 5 ? '⚠️' : '✅'
    res += `${icon} ${v.size}: ${v.current_stock}\n`
  })
  res += `\n📊 Total: ${total} unidades`
  return res
}

async function handleListProducts(userId: string): Promise<string> {
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('*, variants:product_variants(current_stock)')
    .eq('user_id', userId)
    .order('code')

  if (!products || products.length === 0) return 'No hay productos registrados.'

  let res = `📋 Productos (${products.length}):\n\n`
  products.slice(0, 10).forEach((p: { code: string; name: string; variants?: { current_stock: number }[] }) => {
    const total = (p.variants ?? []).reduce((s, v) => s + v.current_stock, 0)
    res += `• ${p.code} — ${p.name}: ${total} uds\n`
  })
  if (products.length > 10) res += `\n...y ${products.length - 10} más`
  return res
}

async function handleLowStock(userId: string): Promise<string> {
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('code, name, variants:product_variants(size, current_stock)')
    .eq('user_id', userId)
    .order('code')

  if (!products || products.length === 0) return 'No hay productos registrados.'

  const critical: string[] = []
  const low: string[] = []

  for (const p of products) {
    for (const v of (p.variants ?? []) as { size: string; current_stock: number }[]) {
      if (v.current_stock === 0) {
        critical.push(`🚨 ${p.code} talla ${v.size} — SIN STOCK`)
      } else if (v.current_stock < 5) {
        low.push(`⚠️ ${p.code} talla ${v.size} — ${v.current_stock} uds`)
      }
    }
  }

  if (critical.length === 0 && low.length === 0) return '✅ Todo el stock está en niveles normales.'

  let res = `📊 *Reporte de stock crítico:*\n\n`
  if (critical.length > 0) res += `*Sin stock:*\n${critical.join('\n')}\n\n`
  if (low.length > 0) res += `*Stock bajo (<5 uds):*\n${low.join('\n')}`
  return res
}

function formatHelp(): string {
  return (
    `📱 *Comandos disponibles:*\n\n` +
    `• *- <código> <cantidad>* — Restar stock\n` +
    `  Ej: - 001 5\n` +
    `  Con talla: - 001 M 5\n\n` +
    `• *+ <código> <cantidad>* — Agregar stock\n` +
    `  Ej: + 001 10\n` +
    `  Con talla: + 001 M 10\n\n` +
    `• *STOCK <código>* — Ver stock de un producto\n` +
    `  Ej: STOCK 001\n\n` +
    `• *LISTA* — Ver todos los productos\n\n` +
    `• *BAJOS* — Ver productos con stock crítico\n\n` +
    `• *AYUDA* — Mostrar este mensaje`
  )
}

// "- <code> [size] <qty>"
const SUBTRACT_RE = /^-\s+(\S+)\s+(.+)$/

async function processCommand(message: string, userId: string): Promise<string> {
  const trimmed = message.trim()

  // - <code> [size] <qty>  →  restar stock
  const minusMatch = trimmed.match(SUBTRACT_RE)
  if (minusMatch) {
    const code = minusMatch[1].toUpperCase()
    const rest = minusMatch[2].trim().split(/\s+/)

    let size: string | null = null
    const quantityStr = rest[rest.length - 1]
    if (rest.length >= 2) size = rest.slice(0, -1).join(' ').toUpperCase()

    const quantity = parseInt(quantityStr, 10)
    if (isNaN(quantity) || quantity <= 0) {
      return 'Cantidad inválida.\nUso: - <código> <cantidad>\nCon talla: - <código> <talla> <cantidad>'
    }

    return handleStockOperation(code, size, quantity, 'out', userId)
  }

  const parts = trimmed.toUpperCase().split(/\s+/)
  const command = parts[0]

  switch (command) {
    case '+':
    case 'AGREGAR': {
      if (parts.length < 3) {
        return 'Uso: + <código> <cantidad>\nCon talla: + <código> <talla> <cantidad>'
      }
      const code = parts[1]
      const rest = parts.slice(2)
      let size: string | null = null
      const quantityStr = rest[rest.length - 1]
      if (rest.length >= 2) size = rest.slice(0, -1).join(' ')

      const quantity = parseInt(quantityStr, 10)
      if (isNaN(quantity) || quantity <= 0) return 'Cantidad inválida.'

      return handleStockOperation(code, size, quantity, 'in', userId)
    }

    case 'STOCK':
    case 'CONSULTAR': {
      const code = parts[1]
      if (!code) return 'Uso: STOCK <código>\nEj: STOCK 001'
      return handleStockQuery(code, userId)
    }

    case 'LISTA':
    case 'PRODUCTOS': {
      return handleListProducts(userId)
    }

    case 'BAJOS':
    case 'CRITICO':
    case 'ALERTAS': {
      return handleLowStock(userId)
    }

    case 'AYUDA':
    case 'HELP':
    case '?': {
      return formatHelp()
    }

    default:
      return `Comando no reconocido: "${parts[0]}"\n\nEscribí *AYUDA* para ver los comandos disponibles.`
  }
}

// GET: Verificar webhook con Meta
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Unauthorized', { status: 403 })
}

// POST: Recibir mensajes entrantes
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    if (!await verifySignature(request, rawBody)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const entry: WhatsAppEntry = body.entry?.[0]

    if (!entry?.changes?.[0]?.value?.messages) {
      return NextResponse.json({ status: 'ok' })
    }

    const message = entry.changes[0].value.messages[0]

    if (!isAuthorizedSender(message.from)) {
      return NextResponse.json({ status: 'ok' })
    }

    const userId = process.env.WHATSAPP_DEFAULT_USER_ID
    if (!userId) {
      console.error('WHATSAPP_DEFAULT_USER_ID not configured')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    if (message.type === 'text' && message.text?.body) {
      try {
        const responseText = await processCommand(message.text.body, userId)
        await sendWhatsAppMessage(message.from, responseText)
      } catch (err) {
        console.error('Error processing command:', err)
        await sendWhatsAppMessage(message.from, '❌ Ocurrió un error. Intentá de nuevo.')
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
