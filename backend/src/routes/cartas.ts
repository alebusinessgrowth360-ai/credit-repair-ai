import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'
import OpenAI from 'openai'

const router = Router()

async function getOpenAI(usuarioId: string): Promise<OpenAI> {
  const config = await pool.query('SELECT api_key_encriptada FROM configuracion_ia WHERE usuario_id = $1 AND estado_conexion = $2', [usuarioId, 'activo'])
  if (config.rows.length === 0) throw new Error('API Key de IA no configurada')
  return new OpenAI({ apiKey: config.rows[0].api_key_encriptada })
}

router.post('/generar', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { cliente_id, reporte_id, tipo_carta, destinatario, ley_aplicada, error_detectado } = req.body
  if (!cliente_id || !tipo_carta || !destinatario) return res.status(400).json({ error: 'Faltan campos requeridos' })
  try {
    if (reporte_id) {
      const analisis = await pool.query('SELECT id FROM analisis_reportes WHERE reporte_id = $1', [reporte_id])
      if (analisis.rows.length === 0) return res.status(400).json({ error: 'Debes analizar el reporte primero antes de generar cartas.' })
    }
    const cliente = await pool.query('SELECT * FROM clientes WHERE id = $1 AND usuario_id = $2', [cliente_id, usuarioId])
    if (cliente.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' })
    const c = cliente.rows[0]
    const openai = await getOpenAI(usuarioId)
    const prompt = `Redacta una carta profesional de disputa de credito en espanol para:
Cliente: ${c.nombre_completo}
Direccion: ${c.direccion || ''}, ${c.ciudad || ''}, ${c.estado || ''} ${c.zip || ''}
Tipo de carta: ${tipo_carta}
Destinatario: ${destinatario}
Error a disputar: ${JSON.stringify(error_detectado || {})}
Ley aplicable: ${ley_aplicada || 'FCRA'}
Fecha: ${new Date().toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric' })}
La carta debe ser formal, profesional, personalizada y lista para enviar. Incluye: fecha, destinatario, detalle del problema, solicitud formal de investigacion o correccion, referencia a la ley aplicable y cierre profesional con espacio para firma.`
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Eres un experto en reparacion de credito. Redacta cartas de disputa profesionales en espanol.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    })
    const contenido = response.choices[0].message.content || 'Carta generada'
    const result = await pool.query(
      'INSERT INTO cartas (cliente_id, reporte_id, tipo_carta, destinatario, contenido, ley_aplicada, estado) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [cliente_id, reporte_id || null, tipo_carta, destinatario, contenido, ley_aplicada || 'FCRA', 'borrador']
    )
    await pool.query('INSERT INTO logs_ia (usuario_id, tipo_operacion, modelo, tokens_entrada, tokens_salida, estado) VALUES ($1,$2,$3,$4,$5,$6)',
      [usuarioId, 'generacion_carta', 'gpt-4o', response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0, 'ok'])
    res.status(201).json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { cliente_id } = req.query
  try {
    const query = cliente_id
      ? 'SELECT * FROM cartas WHERE cliente_id = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM cartas ORDER BY created_at DESC'
    const result = await pool.query(query, cliente_id ? [cliente_id] : [])
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { contenido, estado } = req.body
  try {
    const result = await pool.query('UPDATE cartas SET contenido=$1, estado=$2, updated_at=NOW() WHERE id=$3 RETURNING *', [contenido, estado || 'editada', id])
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
