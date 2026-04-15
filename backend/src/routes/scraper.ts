import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import pool from '../db/client'
import OpenAI from 'openai'

const router = Router()

const BASE = 'https://www.creditheroscore.com'
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

async function getOpenAI(usuarioId: string): Promise<OpenAI> {
  const config = await pool.query('SELECT api_key_encriptada FROM configuracion_ia WHERE usuario_id = $1 AND estado_conexion = $2', [usuarioId, 'activo'])
  if (config.rows.length === 0) throw new Error('API Key de IA no configurada. Ve a Configuracion de IA primero.')
  return new OpenAI({ apiKey: config.rows[0].api_key_encriptada })
}

async function scrapeReport(email: string, password: string) {
  const puppeteer = await import('puppeteer-core')

  const browser = await puppeteer.default.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process']
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.setViewport({ width: 1280, height: 800 })

    const arrayData: Record<string, any> = {}
    page.on('response', async (resp) => {
      try {
        const url = resp.url()
        if (!url.includes('array.io/api')) return
        const body = await resp.text()
        try { arrayData[url] = JSON.parse(body) } catch {}
      } catch {}
    })

    await page.goto(`${BASE}/customer_login.asp`, { waitUntil: 'networkidle2', timeout: 30000 })
    await page.type('#username', email, { delay: 30 })
    await page.type('#password', password, { delay: 30 })
    await page.click('.btn.login')
    await new Promise(r => setTimeout(r, 5000))

    const afterLoginUrl = page.url()
    const loginFormStillActive = await page.evaluate(new Function(`
      var form = document.querySelector('#CFForm_1');
      if (!form) return false;
      var pwd = form.querySelector('input[type="password"]');
      return !!(pwd && pwd.offsetParent !== null);
    `) as () => boolean)
    console.log('[SCRAPER] After login URL:', afterLoginUrl, '| form active:', loginFormStillActive)
    if (afterLoginUrl.includes('customer_login') && loginFormStillActive) {
      throw new Error('Email o contraseña incorrectos. Verifica las credenciales del cliente.')
    }

    await new Promise(r => setTimeout(r, 12000))
    const scoresUrl = page.url()
    const tGUIDMatch = scoresUrl.match(/tGUID=([^&]+)/i)
    const tGUID = tGUIDMatch ? tGUIDMatch[1] : ''
    console.log('[SCRAPER] tGUID:', tGUID)

    const reportUrl = tGUID ? `${BASE}/cp6/mcc_creditreports_v2.asp?tGUID=${tGUID}` : `${BASE}/cp6/mcc_creditreports_v2.asp`
    await page.goto(reportUrl, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 15000))

    console.log('[SCRAPER] Array.io responses captured:', Object.keys(arrayData).length)
    return { arrayData }
  } finally {
    await browser.close()
  }
}

function mismoToText(arrayData: Record<string, any>): string {
  const reportKey = Object.keys(arrayData).find(k => k.includes('/api/report/v2?'))
  const cr = reportKey ? arrayData[reportKey]?.CREDIT_RESPONSE : null
  if (!cr) return ''

  const lines: string[] = ['CREDIT REPORT - Credit Hero Score (Array.io MISMO 2.4)\n']

  // Scores from scoretracker
  for (const [url, data] of Object.entries(arrayData)) {
    if (!url.includes('scoretracker')) continue
    const history: any[] = data.creditScoreHistory || []
    if (!history.length) continue
    const score = history[0].score
    const bureau = url.includes('bureau=tui') ? 'TransUnion' : url.includes('bureau=efx') ? 'Equifax' : 'Experian'
    lines.push(`Credit Score ${bureau}: ${score}`)
  }
  lines.push('')

  // Personal info from BORROWER
  const borrower = cr.BORROWER
  if (borrower) {
    const b = Array.isArray(borrower) ? borrower[0] : borrower
    lines.push(`Borrower: ${b['@_FirstName'] || ''} ${b['@_MiddleName'] || ''} ${b['@_LastName'] || ''}`.trim())
    if (b['@_SSN']) lines.push(`SSN: ${b['@_SSN']}`)
    if (b['@_BirthDate']) lines.push(`DOB: ${b['@_BirthDate']}`)
    lines.push('')
  }

  // Per-bureau personal data from CREDIT_FILE
  const files: any[] = Array.isArray(cr.CREDIT_FILE) ? cr.CREDIT_FILE : [cr.CREDIT_FILE].filter(Boolean)
  for (const file of files) {
    const bureau = file['@CreditRepositorySourceType'] || ''
    const fb = file._BORROWER
    if (!fb) continue
    lines.push(`--- ${bureau} ---`)
    const names = Array.isArray(fb._NAME) ? fb._NAME : [fb._NAME].filter(Boolean)
    names.forEach((n: any) => lines.push(`  Name: ${n['@_FirstName'] || ''} ${n['@_LastName'] || ''}`.trim()))
    const residences = Array.isArray(fb._RESIDENCE) ? fb._RESIDENCE : [fb._RESIDENCE].filter(Boolean)
    residences.forEach((r: any) => {
      const a = r._ADDRESS || r
      lines.push(`  Address: ${a['@_StreetAddress'] || ''}, ${a['@_City'] || ''}, ${a['@_State'] || ''} ${a['@_PostalCode'] || ''}`)
    })
    const employers = Array.isArray(fb._EMPLOYER) ? fb._EMPLOYER : [fb._EMPLOYER].filter(Boolean)
    employers.forEach((e: any) => lines.push(`  Employer: ${e['@_Name'] || ''}`))
  }
  lines.push('')

  // Accounts
  const liabilities: any[] = Array.isArray(cr.CREDIT_LIABILITY) ? cr.CREDIT_LIABILITY : []
  if (liabilities.length) {
    lines.push('ACCOUNTS:')
    for (const acct of liabilities) {
      const creditor = acct._CREDITOR?.['@_Name'] || acct['@_Name'] || ''
      const origCreditor = acct._CREDITOR?.['@_OriginalCreditorName'] || acct['@_OriginalCreditorName'] || ''
      const bureau = acct.CREDIT_REPOSITORY?.['@_SourceType'] || ''
      const type = acct['@_AccountType'] || acct['@AccountType'] || ''
      const acctNum = acct['@CreditLiabilityAccountIdentifier'] || acct['@AccountIdentifier'] || ''
      const balance = acct['@CreditLiabilityUnpaidBalanceAmount'] || acct['@UnpaidBalanceAmount'] || ''
      const limit = acct['@CreditLiabilityHighCreditAmount'] || acct['@CreditLimitAmount'] || ''
      const status = acct['@CreditLiabilityAccountStatusType'] || acct['@AccountStatusType'] || ''
      const opened = acct['@CreditLiabilityAccountOpenedDate'] || acct['@AccountOpenedDate'] || ''
      const closed = acct['@CreditLiabilityAccountClosedDate'] || acct['@AccountClosedDate'] || ''
      const lastPay = acct['@CreditLiabilityLastPaymentDate'] || acct['@LastPaymentDate'] || ''
      const pastDue = acct['@CreditLiabilityPastDueAmount'] || acct['@PastDueAmount'] || ''
      lines.push(`Creditor: ${creditor}${origCreditor ? ' | Original: ' + origCreditor : ''} | Bureau: ${bureau} | Type: ${type} | Account#: ${acctNum} | Balance: ${balance} | Limit: ${limit} | Status: ${status} | Opened: ${opened}${closed ? ' | Closed: ' + closed : ''}${lastPay ? ' | LastPay: ' + lastPay : ''}${pastDue ? ' | PastDue: ' + pastDue : ''}`)
    }
    lines.push('')
  }

  // Inquiries
  const inquiries: any[] = Array.isArray(cr.CREDIT_INQUIRY) ? cr.CREDIT_INQUIRY : []
  if (inquiries.length) {
    lines.push('INQUIRIES:')
    // Group by bureau for clarity
    const byBureau: Record<string, string[]> = { TransUnion: [], Equifax: [], Experian: [] }
    const tuiCount = inquiries.filter(i => i.CREDIT_REPOSITORY?.['@_SourceType'] === 'TransUnion').length
    const efxCount = inquiries.filter(i => i.CREDIT_REPOSITORY?.['@_SourceType'] === 'Equifax').length
    const expCount = inquiries.filter(i => i.CREDIT_REPOSITORY?.['@_SourceType'] === 'Experian').length
    lines.push(`Total count | ${tuiCount} | ${efxCount} | ${expCount}`)
    lines.push('TransUnion | Equifax | Experian')
    for (const inq of inquiries) {
      const bureau = inq.CREDIT_REPOSITORY?.['@_SourceType'] || ''
      const name = inq['@_Name'] || ''
      const date = inq['@_Date'] ? new Date(inq['@_Date']).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''
      const type = inq['@_PurposeType'] || ''
      byBureau[bureau]?.push(`${name} ${date} ${type}`)
    }
    const maxRows = Math.max(byBureau.TransUnion.length, byBureau.Equifax.length, byBureau.Experian.length)
    for (let i = 0; i < maxRows; i++) {
      lines.push(`${byBureau.TransUnion[i] || ''} | ${byBureau.Equifax[i] || ''} | ${byBureau.Experian[i] || ''}`)
    }
  }

  return lines.join('\n').slice(0, 90000)
}

function parseArrayData(arrayData: Record<string, any>) {
  const scores = { TransUnion: 0, Experian: 0, Equifax: 0, general: 0 }
  for (const [url, data] of Object.entries(arrayData)) {
    if (!url.includes('scoretracker')) continue
    const history: any[] = data.creditScoreHistory || []
    if (!history.length) continue
    const score = parseInt(history[0].score)
    if (url.includes('bureau=tui')) scores.TransUnion = score
    else if (url.includes('bureau=efx')) scores.Equifax = score
    else if (url.includes('bureau=exp')) scores.Experian = score
  }
  const vals = [scores.TransUnion, scores.Experian, scores.Equifax].filter(s => s > 0)
  scores.general = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0

  const inquiries: Record<string, Array<{ empresa: string; fecha: string }>> = { TransUnion: [], Experian: [], Equifax: [] }
  const reportKey = Object.keys(arrayData).find(k => k.includes('/api/report/v2?'))
  const cr = reportKey ? arrayData[reportKey]?.CREDIT_RESPONSE : null

  if (cr?.CREDIT_INQUIRY) {
    const arr: any[] = Array.isArray(cr.CREDIT_INQUIRY) ? cr.CREDIT_INQUIRY : [cr.CREDIT_INQUIRY]
    for (const inq of arr) {
      if (inq['@_PurposeType'] !== 'HARD') continue
      const bureau: string = inq.CREDIT_REPOSITORY?.['@_SourceType'] || ''
      const empresa: string = inq['@_Name'] || ''
      const dateStr: string = inq['@_Date'] || ''
      if (!empresa || !dateStr) continue
      const d = new Date(dateStr)
      const fecha = !isNaN(d.getTime()) ? `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : dateStr
      if (bureau === 'TransUnion') inquiries.TransUnion.push({ empresa, fecha })
      else if (bureau === 'Experian') inquiries.Experian.push({ empresa, fecha })
      else if (bureau === 'Equifax') inquiries.Equifax.push({ empresa, fecha })
    }
  }

  const totalInquiries = inquiries.TransUnion.length + inquiries.Experian.length + inquiries.Equifax.length
  return { scores, inquiries, total_inquiries: totalInquiries }
}

// POST /api/scraper/credit-hero
router.post('/credit-hero', requireAuth, async (req: AuthRequest, res: Response) => {
  const { email, password, cliente_id } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Se requieren email y contraseña del cliente' })

  try {
    const { arrayData } = await scrapeReport(email, password)
    const result = parseArrayData(arrayData)
    console.log('[SCRAPER] Scores:', result.scores, '| Inquiries:', result.total_inquiries)

    if (!cliente_id) return res.json({ data: result, error: null })

    const usuarioId = req.usuario!.id
    const cliente = await pool.query('SELECT id FROM clientes WHERE id = $1 AND usuario_id = $2', [cliente_id, usuarioId])
    if (cliente.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' })

    const today = new Date().toISOString().split('T')[0]
    const nombre = `credit-hero-${today}`

    const reporte = await pool.query(
      `INSERT INTO reportes_credito (cliente_id, nombre_archivo, ruta_archivo, fecha_reporte, tipo_reporte)
       VALUES ($1, $2, $3, $4, 'otro') RETURNING id`,
      [cliente_id, nombre, nombre, today]
    )
    const reporteId = reporte.rows[0].id

    // Run AI analysis on the MISMO structured data
    console.log('[SCRAPER] Running AI analysis...')
    const textoReporte = mismoToText(arrayData)
    const openai = await getOpenAI(usuarioId)

    const prompt = `Actúa como un analista experto en reportes de crédito de Estados Unidos, especializado en revisión de errores, inconsistencias, cumplimiento normativo y estrategias de disputa bajo las leyes federales (FCRA, FDCPA, FACTA).

Analiza el reporte de crédito completo que aparece al final. Los datos están en formato estructurado extraído directamente de los burós de crédito vía API — son 100% exactos. Copia los datos EXACTAMENTE como aparecen.

El reporte muestra las cuentas con el campo Bureau indicando a qué buró pertenece cada entrada. Crea una entrada SEPARADA por cada combinación acreedor+buró.

REGLAS DE EXTRACCIÓN:
1. Incluye ABSOLUTAMENTE TODAS las cuentas.
2. Para cada cuenta extrae todos los campos disponibles: acreedor, original_creditor, tipo, numero, balance, limite_credito, estado, fecha_apertura, fecha_cierre, fecha_ultimo_pago, buro.
3. Los inquiries ya están organizados por buró — extráelos exactamente como aparecen con empresa y fecha.
4. Extrae datos personales de todas las secciones disponibles por buró.
5. Los scores están en la sección Credit Score — extráelos exactamente.

DETECCIÓN DE ERRORES:
- Cuentas duplicadas (mismo original creditor con diferentes nombres)
- Cuentas que exceden 7 años (FCRA §605)
- Balances o límites diferentes entre burós para la misma cuenta
- Datos personales incorrectos (direcciones desconocidas, nombres con variaciones)
- Hard inquiries no autorizados
- Cualquier inconsistencia entre burós

REGLAS DE CLASIFICACIÓN:
- negativo=true si el estado contiene: Collection, Charge Off, CO, Late, Past Due, Derogatory, 30/60/90/120 days, Transferred to Collections, o variante negativa.
- disputable=true si es negativa, tiene inconsistencias, es duplicada, o excede 7 años.

Responde SOLO con JSON válido con esta estructura exacta:
{"scores":{"Experian":0,"Equifax":0,"TransUnion":0,"general":0},"inquiries":{"TransUnion":[{"empresa":"NOMBRE","fecha":"MM/YYYY"}],"Equifax":[{"empresa":"NOMBRE","fecha":"MM/YYYY"}],"Experian":[{"empresa":"NOMBRE","fecha":"MM/YYYY"}]},"resumen_general":{"total_cuentas":0,"cuentas_positivas":0,"cuentas_negativas":0,"collections":0,"charge_offs":0,"hard_inquiries":0,"cuentas_duplicadas_detectadas":0,"inconsistencias_personales_detectadas":0,"estado_general":"riesgo_medio"},"datos_personales":{"nombre_completo":"","ssn_parcial":"","fecha_nacimiento":"","direcciones_actuales":[],"direcciones_anteriores":[],"empleadores":[],"por_buro":{"Experian":{"nombres":[],"direcciones":[],"empleadores":[]},"Equifax":{"nombres":[],"direcciones":[],"empleadores":[]},"TransUnion":{"nombres":[],"direcciones":[],"empleadores":[]}}},"inconsistencias_personales":[{"tipo":"nombre|direccion|empleador","descripcion":"","buro":"","valor_reportado":"","disputable":true}],"cuentas":[{"acreedor":"","original_creditor":"","tipo":"","numero":"","balance":"","limite_credito":"","estado":"","fecha_apertura":"","fecha_cierre":"","fecha_ultimo_pago":"","buro":"","negativo":false,"tipo_negativo":"","disputable":false,"razon_disputa":""}],"cuentas_duplicadas":[{"acreedor_1":"","acreedor_2":"","original_creditor":"","numero_1":"","numero_2":"","buro_1":"","buro_2":"","balance_1":"","balance_2":"","descripcion":""}],"errores_detectados":[{"tipo":"","descripcion":"","buro":"","cuenta_relacionada":"","prioridad":"alta","ley_aplicable":"FCRA"}],"inconsistencias_entre_buros":[{"elemento":"","buros_involucrados":"","diferencia":"","prioridad":"alta"}],"recomendaciones":[{"tipo":"","descripcion":"","ley_aplicable":"FCRA","prioridad":1}]}

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

    const raw = response.choices[0].message.content || ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('La IA no devolvió JSON válido.')
    const analisisData = JSON.parse(jsonMatch[0])

    // Use scraped scores (more reliable than AI-extracted)
    analisisData.scores = result.scores
    analisisData.inquiries = result.inquiries

    await pool.query(
      `INSERT INTO analisis_reportes
         (reporte_id, resumen_general, datos_personales, cuentas, inquiries,
          errores_detectados, inconsistencias_entre_buros, recomendaciones, estado_general)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        reporteId,
        JSON.stringify({ ...analisisData.resumen_general, scores: analisisData.scores, fuente: 'Credit Hero Score' }),
        JSON.stringify(analisisData.datos_personales || {}),
        JSON.stringify(analisisData.cuentas || []),
        JSON.stringify(analisisData.inquiries || {}),
        JSON.stringify(analisisData.errores_detectados || []),
        JSON.stringify(analisisData.inconsistencias_entre_buros || []),
        JSON.stringify(analisisData.recomendaciones || []),
        analisisData.resumen_general?.estado_general || 'riesgo_medio'
      ]
    )

    console.log('[SCRAPER] Analysis saved. Accounts:', (analisisData.cuentas || []).length, '| Errors:', (analisisData.errores_detectados || []).length)
    return res.json({ data: { ...result, reporte_id: reporteId }, error: null })

  } catch (err: any) {
    console.error('[SCRAPER] Error:', err.message)
    res.status(400).json({ error: err.message })
  }
})

export default router
