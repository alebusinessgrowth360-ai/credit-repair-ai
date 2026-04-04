import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'
import OpenAI from 'openai'

const router = Router()

async function getOpenAI(usuarioId: string): Promise<OpenAI> {
  const config = await pool.query('SELECT api_key_encriptada FROM configuracion_ia WHERE usuario_id = $1 AND estado_conexion = $2', [usuarioId, 'activo'])
  if (config.rows.length === 0) throw new Error('API Key de IA no configurada. Ve a Configuracion de IA primero.')
  return new OpenAI({ apiKey: config.rows[0].api_key_encriptada })
}

// Formula-based quick calculation
function calcularFormula(params: {
  tipo_cuenta: string, accion: string, score_actual: number,
  balance: number, limite_credito: number
}): { impacto: number, rango: string, tiempo: string, explicacion: string, recomendacion: string } {
  const { tipo_cuenta, accion, score_actual, balance, limite_credito } = params
  const tipo = tipo_cuenta.toLowerCase()
  const acc = accion.toLowerCase()

  let impacto = 0
  let tiempo = '30-45 días'
  let explicacion = ''
  let recomendacion = ''

  // Score multiplier: lower scores benefit more
  const mult = score_actual < 580 ? 1.3 : score_actual < 650 ? 1.1 : score_actual < 720 ? 1.0 : 0.8

  if (tipo.includes('collection')) {
    if (acc.includes('remov') || acc.includes('delet')) {
      impacto = Math.round(85 * mult)
      tiempo = '30-60 días'
      explicacion = 'Removing a collection account eliminates a major derogatory mark. Collections under FCRA §605 have a 7-year reporting limit.'
      recomendacion = 'Request deletion via pay-for-delete agreement or dispute if reporting errors exist.'
    } else if (acc.includes('pay') || acc.includes('pag')) {
      impacto = Math.round(35 * mult)
      tiempo = '30-45 días'
      explicacion = 'Paying a collection updates its status but the negative mark remains for up to 7 years.'
      recomendacion = 'Negotiate a pay-for-delete agreement before paying to maximize score impact.'
    } else if (acc.includes('settl') || acc.includes('liquid')) {
      impacto = Math.round(20 * mult)
      tiempo = '30-45 días'
      explicacion = 'Settling a collection shows as "Settled" which is still negative but better than open collection.'
      recomendacion = 'Try to negotiate full deletion with creditor instead of settled status.'
    }
  } else if (tipo.includes('charge') || tipo.includes('charge-off') || tipo.includes('chargeoff')) {
    if (acc.includes('remov') || acc.includes('delet')) {
      impacto = Math.round(95 * mult)
      tiempo = '30-60 días'
      explicacion = 'Removing a charge-off eliminates one of the most damaging items on a credit report.'
      recomendacion = 'Dispute inaccuracies under FCRA §611. If accurate, negotiate goodwill deletion.'
    } else if (acc.includes('pay') || acc.includes('pag')) {
      impacto = Math.round(25 * mult)
      tiempo = '30-45 días'
      explicacion = 'Paying a charge-off changes status to "Paid Charge-Off" — still negative but shows responsibility.'
      recomendacion = 'Negotiate pay-for-delete. If creditor refuses, request goodwill deletion after payment.'
    }
  } else if (tipo.includes('credit card') || tipo.includes('tarjeta') || tipo.includes('revolving')) {
    if (limite_credito > 0) {
      const utilActual = balance / limite_credito
      const utilTarget = 0.09 // target 9% utilization
      if (utilActual > utilTarget) {
        const payoff = balance - (limite_credito * utilTarget)
        if (utilActual > 0.9) impacto = Math.round(90 * mult)
        else if (utilActual > 0.5) impacto = Math.round(55 * mult)
        else if (utilActual > 0.3) impacto = Math.round(30 * mult)
        else impacto = Math.round(15 * mult)
        explicacion = `Current utilization: ${Math.round(utilActual * 100)}%. Paying down to 9% utilization ($${payoff.toFixed(2)}) maximizes score impact. Credit utilization accounts for 30% of FICO score.`
        recomendacion = `Pay $${payoff.toFixed(2)} to bring utilization to 9% for maximum score gain.`
        tiempo = '30 días (after statement closes)'
      } else {
        impacto = 5
        explicacion = 'Utilization is already below 30%. Impact of additional paydown is minimal.'
        recomendacion = 'Focus on other negative items for higher score impact.'
      }
    }
  } else if (tipo.includes('late') || tipo.includes('tardio')) {
    if (acc.includes('remov') || acc.includes('delet')) {
      impacto = Math.round(40 * mult)
      tiempo = '30-45 días'
      explicacion = 'Removing a late payment improves payment history, which is the most important FICO factor (35%).'
      recomendacion = 'Send a goodwill letter to the creditor requesting removal of the late payment.'
    }
  } else if (tipo.includes('medical') || tipo.includes('medic')) {
    if (acc.includes('remov') || acc.includes('delet') || acc.includes('pay')) {
      impacto = Math.round(50 * mult)
      tiempo = '30-45 días'
      explicacion = 'Medical collections under $500 should be ignored by newer FICO models. CFPB regulations support removal.'
      recomendacion = 'Dispute medical collections under FCRA. Many can be removed due to HIPAA violations in reporting.'
    }
  } else {
    // Generic
    impacto = Math.round(20 * mult)
    explicacion = 'General estimate based on account type and action.'
    recomendacion = 'Review account details and consult specific FCRA provisions for this account type.'
  }

  impacto = Math.max(0, Math.min(impacto, 150))
  const rango = impacto >= 60 ? 'Alto' : impacto >= 30 ? 'Medio' : 'Bajo'

  return { impacto, rango, tiempo, explicacion, recomendacion }
}

// Quick formula calculation
router.post('/calcular-rapido', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { cliente_id, reporte_id, banco, numero_cuenta, tipo_cuenta, balance, limite_credito, accion, score_actual } = req.body
  if (!banco || !tipo_cuenta || !accion || !score_actual) return res.status(400).json({ error: 'Faltan campos requeridos' })

  try {
    const calc = calcularFormula({ tipo_cuenta, accion, score_actual: parseInt(score_actual), balance: parseFloat(balance) || 0, limite_credito: parseFloat(limite_credito) || 0 })
    const score_estimado = Math.min(850, parseInt(score_actual) + calc.impacto)

    const result = await pool.query(
      `INSERT INTO rapid_rescore (usuario_id, cliente_id, reporte_id, banco, numero_cuenta, tipo_cuenta, balance, limite_credito, accion, score_actual, score_estimado, impacto_puntos, explicacion, recomendacion, tiempo_estimado, modo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'formula') RETURNING *`,
      [usuarioId, cliente_id || null, reporte_id || null, banco, numero_cuenta || null, tipo_cuenta, parseFloat(balance) || 0, parseFloat(limite_credito) || 0, accion, score_actual, score_estimado, calc.impacto, calc.explicacion, calc.recomendacion, calc.tiempo]
    )
    res.status(201).json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// AI-powered calculation
router.post('/calcular', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { cliente_id, reporte_id, banco, numero_cuenta, tipo_cuenta, balance, limite_credito, accion, score_actual } = req.body
  if (!banco || !tipo_cuenta || !accion || !score_actual) return res.status(400).json({ error: 'Faltan campos requeridos' })

  try {
    const openai = await getOpenAI(usuarioId)
    const utilizacion = limite_credito > 0 ? ((parseFloat(balance) / parseFloat(limite_credito)) * 100).toFixed(1) + '%' : 'N/A'

    const prompt = `You are a senior credit scoring expert with deep knowledge of FICO scoring models, VantageScore, Metro 2 format, FCRA, FDCPA, and rapid rescore processes.

A credit repair consultant needs a precise Rapid Rescore analysis for the following account:

ACCOUNT DETAILS:
- Bank/Creditor: ${banco}
- Account Number: ${numero_cuenta || 'Not provided'}
- Account Type: ${tipo_cuenta}
- Current Balance: $${balance || 0}
- Credit Limit: $${limite_credito || 0}
- Current Utilization: ${utilizacion}
- Proposed Action: ${accion}
- Current Credit Score: ${score_actual}

Analyze this account and provide a precise credit score impact estimate. Consider:
1. The specific account type and its weight in FICO/VantageScore models
2. The proposed action and how it affects each scoring factor
3. The current score range (${score_actual}) — lower scores typically see higher gains
4. Payment history (35%), Credit utilization (30%), Length of credit history (15%), Credit mix (10%), New credit (10%)
5. Metro 2 field changes that would occur with this action
6. Realistic timeline for score update after rapid rescore submission

Respond ONLY with valid JSON:
{
  "impacto_puntos": <integer, estimated point increase>,
  "score_estimado": <integer, estimated new score>,
  "rango_impacto": "<Alto|Medio|Bajo>",
  "tiempo_estimado": "<realistic timeline>",
  "explicacion": "<detailed 2-3 sentence explanation of why this score impact is expected>",
  "recomendacion": "<specific action recommendation including any negotiation tips>",
  "factores_afectados": ["<factor1>", "<factor2>"],
  "advertencias": "<any important warnings or considerations>"
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a credit scoring expert. Provide precise, realistic score impact estimates. Never overstate improvements. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 800
    })

    const aiData = JSON.parse(response.choices[0].message.content || '{}')
    const score_estimado = Math.min(850, Math.max(parseInt(score_actual), parseInt(score_actual) + (aiData.impacto_puntos || 0)))

    const result = await pool.query(
      `INSERT INTO rapid_rescore (usuario_id, cliente_id, reporte_id, banco, numero_cuenta, tipo_cuenta, balance, limite_credito, accion, score_actual, score_estimado, impacto_puntos, explicacion, recomendacion, tiempo_estimado, modo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'ia') RETURNING *`,
      [usuarioId, cliente_id || null, reporte_id || null, banco, numero_cuenta || null, tipo_cuenta, parseFloat(balance) || 0, parseFloat(limite_credito) || 0, accion, score_actual, score_estimado, aiData.impacto_puntos || 0, aiData.explicacion || '', aiData.recomendacion || '', aiData.tiempo_estimado || '30-45 días']
    )

    await pool.query('INSERT INTO logs_ia (usuario_id, tipo_operacion, modelo, tokens_entrada, tokens_salida, estado) VALUES ($1,$2,$3,$4,$5,$6)',
      [usuarioId, 'rapid_rescore', 'gpt-4o', response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0, 'ok']).catch(() => {})

    res.status(201).json({ data: { ...result.rows[0], factores_afectados: aiData.factores_afectados, advertencias: aiData.advertencias, rango_impacto: aiData.rango_impacto }, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get rapid rescore records for a client
router.get('/cliente/:cliente_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { cliente_id } = req.params
  try {
    const result = await pool.query(
      `SELECT rr.* FROM rapid_rescore rr
       JOIN clientes c ON c.id = rr.cliente_id
       WHERE rr.cliente_id = $1 AND c.usuario_id = $2
       ORDER BY rr.created_at DESC`,
      [cliente_id, usuarioId]
    )
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get all rapid rescore records for current user
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  try {
    const result = await pool.query('SELECT * FROM rapid_rescore WHERE usuario_id = $1 ORDER BY created_at DESC LIMIT 50', [usuarioId])
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
