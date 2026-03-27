import OpenAI from 'openai'
import pool from '../../db/client'

async function getOpenAI(usuarioId: string): Promise<OpenAI> {
  const config = await pool.query(
    'SELECT api_key_encriptada FROM configuracion_ia WHERE usuario_id = $1 AND estado_conexion = $2',
    [usuarioId, 'activo']
  )
  if (config.rows.length === 0) {
    throw new Error('API Key de IA no configurada o no validada. Ve a Configuracion de IA primero.')
  }
  return new OpenAI({ apiKey: config.rows[0].api_key_encriptada })
}

export async function analizarReporte(texto: string, usuarioId: string, _reporteId: string): Promise<any> {
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

Responde SOLO con JSON válido con esta estructura exacta:
{"resumen_general":{"total_cuentas":0,"cuentas_positivas":0,"cuentas_negativas":0,"collections":0,"charge_offs":0,"hard_inquiries":0,"estado_general":"riesgo_medio"},"datos_personales":{"nombre_completo":"","direcciones_actuales":[],"empleadores":[]},"cuentas":[],"inquiries":[],"errores_detectados":[{"tipo":"","descripcion":"","buro":"","prioridad":"alta","ley_aplicable":"FCRA"}],"inconsistencias_entre_buros":[{"elemento":"","buros_involucrados":"","diferencia":"","prioridad":"alta"}],"recomendaciones":[{"tipo":"","descripcion":"","ley_aplicable":"FCRA","prioridad":1}]}

CONTENIDO DEL REPORTE:
${texto.slice(0, 12000)}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'Eres un experto en reparacion de credito. Analiza reportes de credito y detecta errores disputables. Responde solo con JSON valido.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 4000
  })

  const contenido = response.choices[0].message.content
  if (!contenido) throw new Error('Respuesta vacia de la IA')
  const analisis = JSON.parse(contenido)

  await pool.query(
    'INSERT INTO logs_ia (usuario_id, tipo_operacion, modelo, tokens_entrada, tokens_salida, estado) VALUES ($1,$2,$3,$4,$5,$6)',
    [usuarioId, 'analisis_reporte', 'gpt-4o', response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0, 'ok']
  ).catch(() => {})

  return analisis
}

export async function generarCarta(cliente: any, tipo: string, error: any, ley: string, usuarioId: string): Promise<string> {
  const openai = await getOpenAI(usuarioId)

  const tipoDescripciones: Record<string, string> = {
    carta_datos_personales: 'dispute of incorrect personal information',
    carta_cuenta_no_reconocida: 'dispute of an unrecognized account',
    carta_cuenta_duplicada: 'dispute of a duplicate account',
    carta_balance_incorrecto: 'dispute of an incorrect balance',
    carta_late_payment: 'dispute of an incorrectly reported late payment',
    carta_inquiry: 'dispute of an unauthorized hard inquiry',
    carta_validacion_deuda: 'debt validation request',
    carta_coleccion: 'dispute of a collection account',
    carta_seguimiento: 'follow-up dispute letter',
    carta_redisputa: 're-dispute letter for previously disputed item'
  }

  const descripcion = tipoDescripciones[tipo] || tipo
  const address = [cliente.direccion, cliente.ciudad, cliente.estado, cliente.zip].filter(Boolean).join(', ')

  const prompt = `Write a professional credit dispute letter in English for a ${descripcion}.

Client Information:
- Name: ${cliente.nombre_completo}
- Address: ${address}

Applicable Law: ${ley}
Error/Issue: ${JSON.stringify(error)}
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Requirements:
- Format as a formal business letter
- Include date, recipient section (leave [RECIPIENT NAME] and [RECIPIENT ADDRESS] as placeholders)
- Reference the specific law (${ley}) and its relevant section
- Clearly describe the error and what correction is requested
- Include a 30-day response deadline
- Professional closing with space for signature
- Keep it concise but firm and legally grounded`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a credit repair expert specializing in consumer protection law. Write professional, legally sound dispute letters.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 1500
  })

  return response.choices[0].message.content || 'Error generating letter'
}
