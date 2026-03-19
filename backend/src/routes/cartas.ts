import { Router, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
)

router.post('/generar', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { cliente_id, reporte_id, tipo_carta, destinatario, ley_aplicada } = req.body
  if (!cliente_id || !tipo_carta || !destinatario) {
    return res.status(400).json({ error: 'Faltan campos requeridos' })
  }
  try {
    if (reporte_id) {
      const { data: analisis } = await supabase.from('analisis_reportes').select('id').eq('reporte_id', reporte_id).single()
      if (!analisis) return res.status(400).json({ error: 'Analiza el reporte primero antes de generar cartas.' })
    }
    const { data: carta, error } = await supabase.from('cartas').insert({ cliente_id, reporte_id: reporte_id || null, tipo_carta, destinatario, contenido: 'Borrador pendiente de generación con IA.', ley_aplicada: ley_aplicada || 'FCRA', estado: 'borrador' }).select().single()
    if (error) throw new Error(error.message)
    res.status(201).json({ data: carta, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { contenido, estado } = req.body
  const { data, error } = await supabase.from('cartas').update({ contenido, estado: estado || 'editada', updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json({ data, error: null })
})

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { cliente_id } = req.query
  let query = supabase.from('cartas').select('*').order('created_at', { ascending: false })
  if (cliente_id) query = query.eq('cliente_id', cliente_id as string)
  const { data, error } = await query
  if (error) return res.status(400).json({ error: error.message })
  res.json({ data, error: null })
})

export default router
