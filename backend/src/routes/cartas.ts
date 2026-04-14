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
    const errorDetalle = error_detectado || {}
    const prompt = `You are an expert credit repair attorney writing a highly specific, individualized dispute letter that will bypass e-OSCAR automated rejection filters and comply with Metro 2 credit reporting standards.

CONSUMER INFORMATION:
- Full Name: ${c.nombre_completo}
- Address: ${c.direccion || '[ADDRESS]'}, ${c.ciudad || '[CITY]'}, ${c.estado || '[STATE]'} ${c.zip || '[ZIP]'}
- Date of Birth: ${c.fecha_nacimiento ? new Date(c.fecha_nacimiento).toLocaleDateString('en-US') : '[DOB]'}
- SSN Last 4: ${c.ssn_parcial || 'XXXX'}

DISPUTE DETAILS:
- Bureau / Creditor: ${destinatario}
- Dispute Type: ${tipo_carta.replace(/_/g, ' ')}
- Applicable Law: ${ley_aplicada || 'FCRA'}
- Error Context: ${JSON.stringify(errorDetalle)}
- Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

CRITICAL REQUIREMENTS — the letter MUST follow ALL of these to pass e-OSCAR and Metro 2 filters:

1. NEVER use generic/template phrases that trigger automatic rejection:
   - Do NOT write "I do not recognize this account" or "this is not mine" without specific facts
   - Do NOT use mass-dispute language or boilerplate
   - Do NOT make frivolous claims without supporting detail

2. BE HIGHLY SPECIFIC — include all known details:
   - Exact account number (use what is in the error context, mask with XXXX if needed)
   - Specific dates (open date, last payment, date of first delinquency)
   - Specific dollar amounts reported
   - Which Metro 2 data fields are incorrect (e.g., Field 4B Balance Amount, Field 4D Account Status, Field 6 Payment History Profile, Field 7A Special Comment Code)

3. CITE SPECIFIC FCRA SECTIONS:
   - §611(a)(1) — right to investigation within 30 days
   - §611(a)(7) — right to method of verification
   - §623(a)(2) — furnisher duty to correct inaccurate information
   - §605(a) — obsolescence rules if applicable
   - §623(b) — duty of furnishers upon notice of dispute

4. REQUEST SPECIFIC ACTIONS (not just "remove" or "correct"):
   - Request the full Method of Verification used (per FCRA §611(a)(7))
   - Request the name, address and phone number of the original data furnisher
   - Request all Metro 2 fields associated with this tradeline
   - State specific Metro 2 compliance violations if applicable
   - Set a clear 30-day deadline per FCRA §611(a)(1)

5. STRUCTURE:
   - Formal business letter format with sender address, date, recipient address
   - Subject line referencing specific account
   - Opening with consumer's specific situation (NOT generic)
   - Body with numbered specific disputes referencing Metro 2 fields
   - Closing demand with legal consequences of non-compliance
   - Signature block with "Under penalty of perjury" declaration
   - Enclosures list (ID copy, proof of address, supporting documents)

Write the complete letter now. Make it individualized, specific, and legally precise.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a senior credit repair attorney specializing in FCRA litigation. You write highly effective, legally precise dispute letters that pass e-OSCAR automated filters by being specific, factual, and Metro 2 compliant. Never write generic template letters.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 2000
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

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    await pool.query('DELETE FROM cartas WHERE id = $1', [id])
    res.json({ data: { deleted: true }, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
