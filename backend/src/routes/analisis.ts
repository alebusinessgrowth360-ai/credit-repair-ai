import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'
import OpenAI from 'openai'
import pdfParse from 'pdf-parse'

const router = Router()

async function getOpenAI(usuarioId: string): Promise<OpenAI> {
  const config = await pool.query('SELECT api_key_encriptada FROM configuracion_ia WHERE usuario_id = $1 AND estado_conexion = $2', [usuarioId, 'activo'])
  if (config.rows.length === 0) throw new Error('API Key de IA no configurada o no validada. Ve a Configuracion de IA primero.')
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
    const pdfBase64 = reporte.rows[0].pdf_contenido
    if (!pdfBase64) return res.status(400).json({ error: 'Este reporte no tiene PDF guardado. Sube el reporte de nuevo.' })

    const pdfBuffer = Buffer.from(pdfBase64, 'base64')
    const pdfData = await pdfParse(pdfBuffer)
    const textoReporte = pdfData.text.slice(0, 12000)

    const openai = await getOpenAI(usuarioId)
    const prompt = `Actúa como un analista experto en reportes de crédito de Estados Unidos, especializado en revisión de errores, inconsistencias, cumplimiento normativo y estrategias de disputa bajo las leyes federales de protección al consumidor y crédito.

Tu tarea es analizar el siguiente reporte de crédito completo y generar una evaluación total, clara, profesional y estructurada.

IMPORTANTE:
- Analiza el reporte completo.
- Identifica el buró de crédito (Experian, Equifax, TransUnion) para cada cuenta, inquiry o dato cuando sea posible.
- Compara la misma cuenta entre burós si aparece en más de uno.
- Detecta inconsistencias entre burós.
- Explica cada error en lenguaje claro.
- Asocia cada hallazgo con la ley o principio aplicable (FCRA, FDCPA, FACTA).
- No actúes como abogado.
- No generes cartas.

Responde SOLO con JSON válido con esta estructura exacta. IMPORTANTE: en "cuentas" incluye TODAS las cuentas del reporte con el nombre completo del acreedor/creditor:
{"resumen_general":{"total_cuentas":0,"cuentas_positivas":0,"cuentas_negativas":0,"collections":0,"charge_offs":0,"hard_inquiries":0,"estado_general":"riesgo_medio"},"datos_personales":{"nombre_completo":"","direcciones_actuales":[],"empleadores":[]},"cuentas":[{"acreedor":"NOMBRE DEL ACREEDOR/CREDITOR","tipo":"Credit Card","numero":"XXXX","balance":"$0","estado":"Open","buro":"Experian","negativo":false,"disputable":false,"razon_disputa":""}],"inquiries":[{"acreedor":"NOMBRE","fecha":"","buro":"","tipo":"hard"}],"errores_detectados":[{"tipo":"","descripcion":"","buro":"","prioridad":"alta","ley_aplicable":"FCRA"}],"inconsistencias_entre_buros":[{"elemento":"","buros_involucrados":"","diferencia":"","prioridad":"alta"}],"recomendaciones":[{"tipo":"","descripcion":"","ley_aplicable":"FCRA","prioridad":1}]}

CONTENIDO DEL REPORTE:
${textoReporte}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Eres un experto en reparacion de credito. Analiza reportes de credito y detecta errores disputables. Responde solo con JSON valido.' },
        { role: 'user', content: prompt + '\n\nCONTENIDO DEL REPORTE:\n' + textoReporte }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 4000
    })

    const contenido = response.choices[0].message.content
    if (!contenido) throw new Error('Respuesta vacia de la IA')
    const analisisData = JSON.parse(contenido)

    await pool.query('DELETE FROM analisis_reportes WHERE reporte_id = $1', [reporte_id])
    const result = await pool.query(
      `INSERT INTO analisis_reportes
         (reporte_id, resumen_general, datos_personales, cuentas, inquiries,
          errores_detectados, inconsistencias_entre_buros, recomendaciones, estado_general)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        reporte_id,
        JSON.stringify(analisisData.resumen_general),
        JSON.stringify(analisisData.datos_personales),
        JSON.stringify(analisisData.cuentas || []),
        JSON.stringify(analisisData.inquiries || []),
        JSON.stringify(analisisData.errores_detectados || []),
        JSON.stringify(analisisData.inconsistencias_entre_buros || []),
        JSON.stringify(analisisData.recomendaciones || []),
        analisisData.resumen_general?.estado_general || 'riesgo_medio'
      ]
    )
    await pool.query('INSERT INTO logs_ia (usuario_id, tipo_operacion, modelo, tokens_entrada, tokens_salida, estado) VALUES ($1,$2,$3,$4,$5,$6)',
      [usuarioId, 'analisis_reporte', 'gpt-4o', response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0, 'ok']).catch(() => {})

    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
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

router.post('/comparar', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { cliente_id, reporte_base_id, reporte_comparado_id } = req.body
  if (!cliente_id || !reporte_base_id || !reporte_comparado_id) {
    return res.status(400).json({ error: 'Se requieren cliente_id, reporte_base_id y reporte_comparado_id' })
  }
  try {
    const cliente = await pool.query('SELECT id FROM clientes WHERE id = $1 AND usuario_id = $2', [cliente_id, usuarioId])
    if (cliente.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' })

    const [base, comparado] = await Promise.all([
      pool.query('SELECT * FROM analisis_reportes WHERE reporte_id = $1', [reporte_base_id]),
      pool.query('SELECT * FROM analisis_reportes WHERE reporte_id = $1', [reporte_comparado_id])
    ])
    if (base.rows.length === 0) return res.status(400).json({ error: 'El reporte base no tiene analisis. Analiza primero.' })
    if (comparado.rows.length === 0) return res.status(400).json({ error: 'El reporte comparado no tiene analisis. Analiza primero.' })

    const b = base.rows[0]
    const c = comparado.rows[0]

    const erroresBase = (b.errores_detectados || []).length
    const erroresComp = (c.errores_detectados || []).length
    const cuentasNegBase = b.resumen_general?.cuentas_negativas ?? 0
    const cuentasNegComp = c.resumen_general?.cuentas_negativas ?? 0

    let progreso: string
    if (erroresComp < erroresBase || cuentasNegComp < cuentasNegBase) progreso = 'mejoro'
    else if (erroresComp > erroresBase || cuentasNegComp > cuentasNegBase) progreso = 'empeoro'
    else progreso = 'sin_cambios'

    const resultado = {
      errores_base: erroresBase,
      errores_comparado: erroresComp,
      errores_eliminados: Math.max(0, erroresBase - erroresComp),
      errores_nuevos: Math.max(0, erroresComp - erroresBase),
      cuentas_negativas_base: cuentasNegBase,
      cuentas_negativas_comparado: cuentasNegComp,
      estado_base: b.estado_general,
      estado_comparado: c.estado_general
    }

    const resumen = progreso === 'mejoro'
      ? `Mejora detectada: se eliminaron ${resultado.errores_eliminados} errores y ${Math.max(0, cuentasNegBase - cuentasNegComp)} cuentas negativas.`
      : progreso === 'empeoro'
      ? `Se detectaron ${resultado.errores_nuevos} errores nuevos y ${Math.max(0, cuentasNegComp - cuentasNegBase)} cuentas negativas adicionales.`
      : 'Sin cambios significativos entre los dos reportes.'

    const result = await pool.query(
      `INSERT INTO comparaciones_reportes (cliente_id, reporte_base_id, reporte_comparado_id, resultado, resumen_cambios, progreso_general)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [cliente_id, reporte_base_id, reporte_comparado_id, JSON.stringify(resultado), resumen, progreso]
    )

    res.status(201).json({ data: result.rows[0] || { resultado, resumen, progreso_general: progreso }, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
