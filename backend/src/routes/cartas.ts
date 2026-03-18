import { Router, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { generarCarta } from '../services/ia/analizar'

const router = Router()
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// POST /cartas/generar — REGLA CRÍTICA: solo si existe análisis previo
router.post('/generar', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const {
    cliente_id,
    reporte_id,
    tipo_carta,
    destinatario,
    error_detectado,
    ley_aplicada
  } = req.body

  if (!cliente_id || !tipo_carta || !destinatario) {
    return res.status(400).json({ error: 'Faltan campos requeridos: cliente_id, tipo_carta, destinatario' })
  }

  try {
    // VALIDACIÓN CRÍTICA: verificar que existe un análisis antes de generar carta
    // Esto cumple la regla: "No permitir generar carta sin haber mostrado antes evaluación"
    if (reporte_id) {
      const { data: analisis } = await supabase
        .from('analisis_reportes')
        .select('id')
        .eq('reporte_id', reporte_id)
        .single()

      if (!analisis) {
        return res.status(400).json({
          error: 'No se puede generar una carta sin haber analizado el reporte primero. Analiza el reporte y revisa los resultados antes de generar cartas.'
        })
      }
    }

    // Obtener datos del cliente
    const { data: cliente, error: errorCliente } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .eq('usuario_id', usuarioId)
      .single()

    if (errorCliente || !cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }

    // Generar contenido con IA
    const contenido = await generarCarta(
      cliente,
      tipo_carta,
      error_detectado || {},
      ley_aplicada || 'FCRA',
      usuarioId
    )

    // Guardar carta como borrador
    const { data: carta, error: errorCarta } = await supabase
      .from('cartas')
      .insert({
        cliente_id,
        reporte_id: reporte_id || null,
        tipo_carta,
        destinatario,
        contenido,
        ley_aplicada: ley_aplicada || 'FCRA',
        estado: 'borrador'
      })
      .select()
      .single()

    if (errorCarta) throw new Error(errorCarta.message)

    res.status(201).json({ data: carta, error: null })

  } catch (err: any) {
    console.error('[/cartas/generar]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// PUT /cartas/:id — editar carta antes de exportar
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { contenido, estado } = req.body
  const usuarioId = req.usuario!.id

  const { data, error } = await supabase
    .from('cartas')
    .update({ contenido, estado: estado || 'editada', updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('cliente_id', supabase.from('clientes').select('id').eq('usuario_id', usuarioId))
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })

  res.json({ data, error: null })
})

// GET /cartas — listar cartas de un cliente
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { cliente_id } = req.query
  const usuarioId = req.usuario!.id

  let query = supabase
    .from('cartas')
    .select('*')
    .order('created_at', { ascending: false })

  if (cliente_id) {
    query = query.eq('cliente_id', cliente_id as string)
  }

  const { data, error } = await query

  if (error) return res.status(400).json({ error: error.message })

  res.json({ data, error: null })
})

export default router
