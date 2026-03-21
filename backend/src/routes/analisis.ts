import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'
import fs from 'fs'
import OpenAI from 'openai'

const router = Router()

async function getOpenAI(usuarioId: string): Promise<OpenAI> {
  const config = await pool.query('SELECT api_key_encriptada FROM configuracion_ia WHERE usuario_id = $1 AND estado_conexion = $2', [usuarioId, 'activo'])
  if (config.rows.length === 0) throw new Error('API Key de IA no configurada o no validada')
  return new OpenAI({ apiKey: config.rows[0].api_key_encriptada })
}

router.post('/:reporte_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { reporte_id } = req.params
  try {
    const reporte = await pool.query(
      'SELECT r.* FROM reportes_credito r JOIN clientes c ON c.id = r.cliente_id WHERE r.id = $1 AND c.usuario_id = $2',
      [reporte_id, usuarioId]
    )
    if (reporte.rows.length === 0) return res.status(404).json({ error: 'Reporte no encontrado' })
    const rutaArchivo = reporte.rows[0].ruta_archivo
    if (!fs.existsSync(rutaArchivo)) return res.status(400).json({ error: 'Archivo PDF no encontrado en el servidor' })
    const pdfBuffer = fs.readFileSync(rutaArchivo)
    const pdfBase64 = pdfBuffer.toString('base64')
    const openai = await getOpenAI(usuarioId)
    const prompt = `Analiza este reporte de credito. Extrae datos personales, cuentas, inquiries, colecciones, charge-offs, balances y observaciones. Detecta errores disputables. Genera recomendaciones basadas en FCRA, FDCPA y FACTA. NO generes cartas todavia. Responde SOLO con JSON valido con esta estructura exacta: {"resumen_general":{"total_cuentas":0,"cuentas_positivas":0,"cuentas_negativas":0,"collections":0,"charge_offs":0,"hard_inquiries":0,"estado_general":"riesgo_medio"},"datos_personales":{"nombre_completo":"","direcciones_actuales":[],"empleadores":[]},"cuentas":[],"inquiries":[],"errores_detectados":[{"tipo":"","descripcion":"","prioridad":"alta"}],"recomendaciones":[{"tipo":"","descripcion":"","ley_aplicable":"FCRA","prioridad":1}]}`
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Eres un experto en reparacion de credito. Analiza reportes y detecta errores disputables. Responde solo con JSON valido.' },
        { role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } }
        ]}
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    })
    const contenido = response.choices[0].message.content
    if (!contenido) throw new Error('Respuesta vacia de la IA')
    const analisisData = JSON.parse(contenido)
    await pool.query('DELETE FROM analisis_reportes WHERE reporte_id = $1', [reporte_id])
    const result = await pool.query(
      'INSERT INTO analisis_reportes (reporte_id, resumen_general, datos_personales, cuentas, inquiries, errores_detectados, recomendaciones, estado_general) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [reporte_id, JSON.stringify(analisisData.resumen_general), JSON.stringify(analisisData.datos_personales), JSON.stringify(analisisData.cuentas), JSON.stringify(analisisData.inquiries), JSON.stringify(analisisData.errores_detectados), JSON.stringify(analisisData.recomendaciones), analisisData.resumen_general?.estado_general || 'riesgo_medio']
    )
    await pool.query(
      'INSERT INTO logs_ia (usuario_id, tipo_operacion, modelo, tokens_entrada, tokens_salida, estado) VALUES ($1,$2,$3,$4,$5,$6)',
      [usuarioId, 'analisis_reporte', 'gpt-4o', response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0, 'ok']
    )
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    await pool.query('INSERT INTO logs_ia (usuario_id, tipo_operacion, modelo, estado, mensaje_error) VALUES ($1,$2,$3,$4,$5)', [usuarioId, 'analisis_reporte', 'gpt-4o', 'error', err.message]).catch(() => {})
    res.status(500).json({ error: err.message })
  }
})

router.get('/:reporte_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { reporte_id } = req.params
  try {
    const result = await pool.query('SELECT * FROM analisis_reportes WHERE reporte_id = $1', [reporte_id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Analisis no encontrado' })
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
