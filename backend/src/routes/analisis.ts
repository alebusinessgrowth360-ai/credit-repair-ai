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

// IMPORTANT: /comparar must be defined BEFORE /:reporte_id to avoid route conflict
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
       ON CONFLICT (reporte_base_id, reporte_comparado_id) DO UPDATE SET resultado=$4, resumen_cambios=$5, progreso_general=$6
       RETURNING *`,
      [cliente_id, reporte_base_id, reporte_comparado_id, JSON.stringify(resultado), resumen, progreso]
    )

    res.status(201).json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

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
    console.log('[ANALISIS] PDF text total chars:', pdfData.text.length)
    const textoReporte = pdfData.text.slice(0, 90000)
    console.log('[ANALISIS] Sending chars to AI:', textoReporte.length)

    const openai = await getOpenAI(usuarioId)
    const prompt = `Actúa como un analista experto en reportes de crédito de Estados Unidos, especializado en revisión de errores, inconsistencias, cumplimiento normativo y estrategias de disputa bajo las leyes federales (FCRA, FDCPA, FACTA).

Analiza el reporte de crédito completo que aparece al final. Copia los datos EXACTAMENTE como aparecen en el reporte — no interpretes ni resumas. Sigue estas reglas sin excepción:

FORMATO DEL REPORTE — MUY IMPORTANTE:
Muchos reportes de crédito (como Credit Hero Score, IdentityIQ, SmartCredit) muestran las cuentas en una tabla con 3 columnas: TransUnion | Equifax | Experian. Cuando el PDF se convierte a texto, estas columnas se aplanan en una sola secuencia lineal y el mismo acreedor puede aparecer 3 veces seguidas con datos ligeramente diferentes para cada buró.

CÓMO MANEJAR ESTE FORMATO:
- Si ves el mismo nombre de acreedor repetido 2 o 3 veces con diferentes balances, fechas o estados — es la misma cuenta reportada por diferentes burós.
- Crea una entrada SEPARADA por cada buró. Si CAPITAL ONE aparece 3 veces, crea 3 entradas: una con buro="TransUnion", otra con buro="Equifax", otra con buro="Experian".
- Para determinar a qué buró pertenece cada instancia, observa el orden: generalmente aparecen en el orden TransUnion → Equifax → Experian, o según los headers del reporte.
- Si el texto muestra explícitamente secciones por buró (ej: "EXPERIAN" como header), usa esa sección para atribuir.
- Si no puedes determinar el buró con certeza, usa el orden de aparición y los headers visibles.

REGLAS DE EXTRACCIÓN (CRÍTICAS):
1. Incluye ABSOLUTAMENTE TODAS las cuentas — positivas, negativas, cerradas, abiertas, collections, charge-offs. No omitas ninguna.
2. Para cada entrada de cuenta (por buró) extrae:
   - acreedor: nombre exacto del creditor como está escrito
   - original_creditor: nombre del "Original Creditor" o "Original Creditor Name" si existe (muy importante para collections)
   - tipo: tipo de cuenta exacto (Credit Card, Auto Loan, Mortgage, Collection, Charge-Off, Student Loan, etc.)
   - numero: número de cuenta (últimos 4 dígitos o como aparece)
   - balance: balance actual exacto para ESE buró
   - limite_credito: credit limit o high credit exacto
   - estado: "Current Payment Status" exacto como aparece para ESE buró
   - fecha_apertura: fecha de apertura exacta
   - fecha_cierre: fecha de cierre si existe
   - fecha_ultimo_pago: last payment date si existe
   - buro: Experian, Equifax, o TransUnion
3. Extrae los hard inquiries separados por buró, PERO SOLO los que NO tienen una cuenta existente asociada en el reporte. Si existe una cuenta (abierta o cerrada) del mismo acreedor, NO incluyas ese inquiry — ya está vinculado a una cuenta autorizada. Solo los inquiries de empresas sin cuenta correspondiente son potencialmente no autorizados y disputables. Instrucciones detalladas para el formato Credit Hero Score (y similares):

   ESTRUCTURA DE LA SECCIÓN DE INQUIRIES:
   - El reporte tiene una tabla con 3 columnas: TransUnion | Equifax | Experian
   - Hay una fila "Total count | X | Y | Z" — estos números son EXACTOS. Debes extraer EXACTAMENTE X inquiries para TransUnion, Y para Equifax, Z para Experian. No más, no menos.
   - Cada inquiry aparece en UNA SOLA columna (a diferencia de las cuentas que se repiten en los 3 burós). La columna indica a qué buró pertenece.
   - Las entradas aparecen en orden visual intercalado entre burós — NO están agrupadas por buró.

   CÓMO IDENTIFICAR A QUÉ BURÓ PERTENECE CADA INQUIRY:
   - Equifax usa nombres FUERTEMENTE abreviados: máximo 8-10 caracteres, sin espacios, ej: ALLYFINANC, GLOBALLEND, WSTLAKENCM, GARYYEOMA, IRMT GCRDT
   - Experian usa nombres COMPLETOS: ALLY FINANCIAL, GLOBAL LENDING SERVICE, GARY YEOMANS HONDA, CREDIT SOLUTIONS CORP
   - TransUnion usa nombres MEDIANOS: FOURSIGHT CA, FLAGSHIP CRE, GARY YEOMANS, HUNTINGTON, WATERSTONE M
   - Si un nombre es muy corto y sin espacios → Equifax. Si es nombre completo con múltiples palabras → Experian. Si es intermedio → TransUnion.
   - Además del nombre, cada inquiry suele tener un bloque "Creditor information" con el nombre completo de la empresa — úsalo como referencia adicional para identificar el buró.

   REGLAS CRÍTICAS:
   - NO omitas ninguno — usa el "Total count" como referencia para verificar que extrajiste todos.
   - NO dedupliques entre burós — si CAPITAL ONE aparece en TransUnion Y en Equifax (con nombres distintos por la abreviación), va en ambos arrays como entradas separadas.
   - Para cada inquiry incluye: empresa (nombre exacto como aparece en el texto), fecha (MM/YYYY).
4. Extrae datos personales completos: nombre, SSN parcial, fecha de nacimiento, TODAS las direcciones (actuales y anteriores), empleadores.
5. Extrae los scores de crédito: busca secciones que digan "Credit Score", "FICO Score", "Score", "VantageScore" u equivalentes. Extrae el score numérico y el buró correspondiente (Experian, Equifax, TransUnion). Si hay un score general o combinado, también extráelo.
5. Si el reporte muestra datos personales separados por buró (Experian / Equifax / TransUnion), extrae lo que cada buró reporta por separado para detectar diferencias.

DETECCIÓN DE INCONSISTENCIAS EN DATOS PERSONALES (MUY IMPORTANTE):
- Nombres: si aparecen variaciones del nombre (diferentes grafías, nombres adicionales, alias), lista cada variación y en qué buró aparece. Ejemplo: "John Smith" en Experian vs "Jon Smith" en Equifax.
- Direcciones: lista TODAS las direcciones que aparecen. Identifica cuáles son desconocidas, sospechosas, o que solo aparecen en un buró. Cada dirección desconocida o no reconocible es disputable bajo FCRA.
- Empleadores: lista TODOS los empleadores reportados. Si hay empleadores que no coinciden entre burós o que son desconocidos, márcalos.
- Incluye CADA inconsistencia de datos personales en "inconsistencias_personales" Y también en "errores_detectados" con prioridad "alta" y ley "FCRA".

DETECCIÓN DE CUENTAS DUPLICADAS (MUY IMPORTANTE):
- Una cuenta duplicada ocurre cuando la MISMA deuda aparece dos veces con diferentes nombres. Ejemplos comunes:
  * La cuenta original (charge-off) + una collection agency cobrando la misma deuda
  * Dos collection agencies cobrando la misma deuda original
  * La misma cuenta reportada dos veces con nombres ligeramente diferentes
- Para detectarlas: compara el "Original Creditor" de cada collection con los acreedores de otras cuentas. Si coinciden, es duplicado.
- Incluye CADA duplicado en el array "cuentas_duplicadas" Y también en "errores_detectados" con tipo "Cuenta Duplicada".

REGLAS DE CLASIFICACIÓN:
- negativo=true si el estado contiene: Collection, Charge Off, CO, Late, Past Due, Derogatory, 30/60/90/120 days, Transferred to Collections, o cualquier variante negativa.
- tipo_negativo: "collection", "charge_off", "late", "derogatory", o "" para positivas.
- disputable=true si es negativa, tiene inconsistencias, es duplicada, o excede 7 años.

ERRORES A DETECTAR:
- Cuentas duplicadas (mismo original creditor, diferentes nombres)
- Cuentas que exceden 7 años de reporte (FCRA §605)
- Balances o límites diferentes entre burós para la misma cuenta
- Datos personales incorrectos (nombre mal escrito, direcciones desconocidas)
- Hard inquiries no autorizados
- Fechas de apertura o cierre incorrectas entre burós

Responde SOLO con JSON válido con esta estructura exacta (el orden de las claves importa — escribe inquiries primero para garantizar que todos queden incluidos):
{"scores":{"Experian":0,"Equifax":0,"TransUnion":0,"general":0},"inquiries":{"TransUnion":[{"empresa":"NOMBRE","fecha":"MM/YYYY"}],"Equifax":[{"empresa":"NOMBRE","fecha":"MM/YYYY"}],"Experian":[{"empresa":"NOMBRE","fecha":"MM/YYYY"}]},"resumen_general":{"total_cuentas":0,"cuentas_positivas":0,"cuentas_negativas":0,"collections":0,"charge_offs":0,"hard_inquiries":0,"cuentas_duplicadas_detectadas":0,"inconsistencias_personales_detectadas":0,"estado_general":"riesgo_medio"},"datos_personales":{"nombre_completo":"","ssn_parcial":"","fecha_nacimiento":"","direcciones_actuales":[],"direcciones_anteriores":[],"empleadores":[],"por_buro":{"Experian":{"nombres":[],"direcciones":[],"empleadores":[]},"Equifax":{"nombres":[],"direcciones":[],"empleadores":[]},"TransUnion":{"nombres":[],"direcciones":[],"empleadores":[]}}},"inconsistencias_personales":[{"tipo":"nombre|direccion|empleador","descripcion":"Descripción exacta de la inconsistencia","buro":"Experian o todos los burós involucrados","valor_reportado":"Valor exacto como aparece en el reporte","disputable":true}],"cuentas":[{"acreedor":"NOMBRE EXACTO","original_creditor":"NOMBRE ORIGINAL O VACIO","tipo":"Credit Card","numero":"XXXX","balance":"$0.00","limite_credito":"$0.00","estado":"As Agreed","fecha_apertura":"","fecha_cierre":"","fecha_ultimo_pago":"","buro":"Experian","negativo":false,"tipo_negativo":"","disputable":false,"razon_disputa":""}],"cuentas_duplicadas":[{"acreedor_1":"NOMBRE 1","acreedor_2":"NOMBRE 2","original_creditor":"NOMBRE DEL ACREEDOR ORIGINAL","numero_1":"XXXX","numero_2":"XXXX","buro_1":"Experian","buro_2":"Equifax","balance_1":"$0.00","balance_2":"$0.00","descripcion":"Explicación de por qué son la misma deuda"}],"errores_detectados":[{"tipo":"Nombre del error","descripcion":"Descripción clara del error y por qué es disputable","buro":"Experian","cuenta_relacionada":"NOMBRE ACREEDOR","prioridad":"alta","ley_aplicable":"FCRA"}],"inconsistencias_entre_buros":[{"elemento":"NOMBRE ACREEDOR – Acct #XXXX","buros_involucrados":"Experian, Equifax","diferencia":"Descripción de la diferencia exacta","prioridad":"alta"}],"recomendaciones":[{"tipo":"Tipo de acción","descripcion":"Descripción detallada de la acción recomendada","ley_aplicable":"FCRA","prioridad":1}]}

CONTENIDO DEL REPORTE:
${textoReporte}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Eres un experto en reparacion de credito en Estados Unidos. Analiza reportes completos y detecta todos los errores disputables. Tu respuesta debe ser UNICAMENTE el objeto JSON solicitado, sin ningun texto antes ni despues, sin markdown, sin bloques de codigo.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 16000
    })

    const choice = response.choices[0]
    console.log('[ANALISIS] finish_reason:', choice.finish_reason, '| tokens:', response.usage)
    const raw = choice.message.content || ''
    console.log('[ANALISIS] content length:', raw.length, '| refusal:', (choice.message as any).refusal ?? 'none')
    if (choice.finish_reason === 'length') throw new Error('El reporte es demasiado extenso. La IA no pudo completar el análisis. Intenta con un reporte más corto.')
    if (!raw) throw new Error(`La IA devolvió respuesta vacía. finish_reason: ${choice.finish_reason}`)

    // Extract JSON — handles cases where model wraps in markdown code blocks
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('La IA no devolvió JSON válido. Intenta de nuevo.')
    const analisisData = JSON.parse(jsonMatch[0])

    await pool.query('DELETE FROM analisis_reportes WHERE reporte_id = $1', [reporte_id])
    const result = await pool.query(
      `INSERT INTO analisis_reportes
         (reporte_id, resumen_general, datos_personales, cuentas, inquiries,
          errores_detectados, inconsistencias_entre_buros, recomendaciones, estado_general)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        reporte_id,
        JSON.stringify({ ...analisisData.resumen_general, scores: analisisData.scores || {} }),
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

export default router
