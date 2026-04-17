import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import pool from '../db/client'
import OpenAI from 'openai'

const router = Router()

const BASE = 'https://www.creditheroscore.com'
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// In-memory job store — jobs complete in ~60s so memory is fine
interface ScraperJob {
  status: 'pending' | 'processing' | 'done' | 'error'
  result?: any
  error?: string
  createdAt: number
}
const jobs = new Map<string, ScraperJob>()

// Clean up jobs older than 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < cutoff) jobs.delete(id)
  }
}, 5 * 60 * 1000)

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
    // Wait for navigation to complete after login click
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
    } catch { /* timeout is ok — page may already be navigating */ }

    const afterLoginUrl = page.url()
    console.log('[SCRAPER] After login URL:', afterLoginUrl)
    if (afterLoginUrl.includes('customer_login')) {
      // Still on login page — check if form is still active (wrong credentials)
      let formActive = false
      try {
        formActive = await page.evaluate(new Function(`
          var form = document.querySelector('#CFForm_1');
          if (!form) return false;
          var pwd = form.querySelector('input[type="password"]');
          return !!(pwd && pwd.offsetParent !== null);
        `) as () => boolean)
      } catch { /* execution context destroyed = navigation in progress = login succeeded */ }
      if (formActive) throw new Error('Email o contraseña incorrectos. Verifica las credenciales del cliente.')
    }

    await new Promise(r => setTimeout(r, 12000))
    const scoresUrl = page.url()
    const tGUIDMatch = scoresUrl.match(/tGUID=([^&]+)/i)
    const tGUID = tGUIDMatch ? tGUIDMatch[1] : ''
    console.log('[SCRAPER] tGUID:', tGUID)

    const reportUrl = tGUID ? `${BASE}/cp6/mcc_creditreports_v2.asp?tGUID=${tGUID}` : `${BASE}/cp6/mcc_creditreports_v2.asp`
    await page.goto(reportUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
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

  const parts: string[] = ['=== CREDIT REPORT — Credit Hero Score / Array.io ===\n']

  // Scores
  for (const [url, data] of Object.entries(arrayData)) {
    if (!url.includes('scoretracker')) continue
    const history: any[] = data.creditScoreHistory || []
    if (!history.length) continue
    const score = history[0].score
    const bureau = url.includes('bureau=tui') ? 'TransUnion' : url.includes('bureau=efx') ? 'Equifax' : 'Experian'
    parts.push(`Credit Score ${bureau}: ${score}`)
  }
  parts.push('')

  // Personal info per bureau as raw JSON
  if (cr.CREDIT_FILE) {
    parts.push('=== PERSONAL INFO PER BUREAU (JSON) ===')
    parts.push(JSON.stringify(cr.CREDIT_FILE).slice(0, 8000))
    parts.push('')
  }

  // Accounts — formatted as readable text so the AI can identify negatives clearly
  if (cr.CREDIT_LIABILITY) {
    const liabilities: any[] = Array.isArray(cr.CREDIT_LIABILITY) ? cr.CREDIT_LIABILITY : [cr.CREDIT_LIABILITY]
    parts.push(`=== ACCOUNTS (${liabilities.length} entries) ===`)
    for (const acct of liabilities) {
      const creditor = acct._CREDITOR?.['@_Name'] || acct['@_Name'] || ''
      const origCreditor = acct._CREDITOR?.['@_OriginalCreditorName'] || acct['@_OriginalCreditorName'] || ''
      const repos: any[] = Array.isArray(acct.CREDIT_REPOSITORY) ? acct.CREDIT_REPOSITORY : (acct.CREDIT_REPOSITORY ? [acct.CREDIT_REPOSITORY] : [])
      const bureau = repos.map((r: any) => r['@_SourceType']).filter(Boolean).join(', ')
      const acctType = acct['@_AccountType'] || acct['@_CreditBusinessType'] || ''
      const status = acct['@_AccountStatusType'] || acct['@_PaymentStatusType'] || ''
      const derogatory = acct['@_DerogatoryDataIndicator'] || ''
      const ratingDesc = acct['@_RatingDescription'] || acct._PAYMENT_PATTERN?.['@_RatingDescription'] || ''
      const currentRating = acct['@_MostRecentAdverseRatingCode'] || acct['@_CurrentRatingCode'] || ''
      const chargeOff = acct['@_ChargeOffAmount'] || ''
      const balance = acct['@_UnpaidBalanceAmount'] || acct['@_HighBalanceAmount'] || ''
      const limit = acct['@_CreditLimitAmount'] || acct['@_HighCreditAmount'] || ''
      const opened = acct['@_AccountOpenedDate'] || ''
      const closed = acct['@_AccountClosedDate'] || ''
      const lastPay = acct['@_LastPaymentDate'] || acct['@_LastActivityDate'] || ''
      const accountNum = acct['@_AccountIdentifier'] || ''
      const payPattern = acct._PAYMENT_PATTERN?.['@_Data'] || ''
      const adverseDate = acct['@_MostRecentAdverseRatingDate'] || ''

      const line = [
        `ACCOUNT: ${creditor}`,
        origCreditor ? `  Original Creditor: ${origCreditor}` : '',
        `  Bureau: ${bureau || 'unknown'}`,
        `  Account Type: ${acctType}`,
        `  Status: ${status}`,
        derogatory === 'Y' ? '  DEROGATORY: YES' : '',
        chargeOff ? `  CHARGE OFF AMOUNT: $${chargeOff}` : '',
        ratingDesc ? `  Rating: ${ratingDesc}` : '',
        currentRating ? `  Current Rating Code: ${currentRating}` : '',
        adverseDate ? `  Most Recent Adverse: ${adverseDate}` : '',
        balance ? `  Balance: $${balance}` : '',
        limit ? `  Limit: $${limit}` : '',
        accountNum ? `  Account #: ${accountNum}` : '',
        opened ? `  Opened: ${opened}` : '',
        closed ? `  Closed: ${closed}` : '',
        lastPay ? `  Last Payment: ${lastPay}` : '',
        payPattern ? `  Payment History: ${payPattern}` : '',
      ].filter(Boolean).join('\n')
      parts.push(line)
      parts.push('')
    }
  }

  // Inquiries as raw JSON
  if (cr.CREDIT_INQUIRY) {
    parts.push('=== INQUIRIES (CREDIT_INQUIRY JSON) ===')
    parts.push(JSON.stringify(cr.CREDIT_INQUIRY).slice(0, 10000))
    parts.push('')
  }

  // Credit score section
  if (cr.CREDIT_SCORE) {
    parts.push('=== CREDIT_SCORE JSON ===')
    parts.push(JSON.stringify(cr.CREDIT_SCORE).slice(0, 3000))
    parts.push('')
  }

  return parts.join('\n').slice(0, 90000)
}

function normalizeName(s: string): string {
  return s.toUpperCase().replace(/\b(INC|LLC|CORP|BANK|FINANCIAL|SERVICES|CREDIT|UNION|CO|NA|FSB|FEDERAL|SAVINGS|AUTO|GROUP)\b/g, '').replace(/[^A-Z0-9]/g, '').trim()
}

function isLinkedToAccount(inquiryName: string, accountNames: string[]): boolean {
  const ni = normalizeName(inquiryName)
  if (!ni || ni.length < 3) return false
  return accountNames.some(acct => {
    const na = normalizeName(acct)
    if (!na || na.length < 3) return false
    return ni.includes(na) || na.includes(ni) || (ni.length >= 5 && na.length >= 5 && (ni.startsWith(na.slice(0, 5)) || na.startsWith(ni.slice(0, 5))))
  })
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

  // Build account name list to filter linked inquiries
  const accountNames: string[] = []
  if (cr?.CREDIT_LIABILITY) {
    const liabilities: any[] = Array.isArray(cr.CREDIT_LIABILITY) ? cr.CREDIT_LIABILITY : [cr.CREDIT_LIABILITY]
    for (const acct of liabilities) {
      const name = acct._CREDITOR?.['@_Name'] || acct['@_Name'] || ''
      const orig = acct._CREDITOR?.['@_OriginalCreditorName'] || acct['@_OriginalCreditorName'] || ''
      if (name) accountNames.push(name)
      if (orig) accountNames.push(orig)
    }
  }

  if (cr?.CREDIT_INQUIRY) {
    const arr: any[] = Array.isArray(cr.CREDIT_INQUIRY) ? cr.CREDIT_INQUIRY : [cr.CREDIT_INQUIRY]
    for (const inq of arr) {
      if (inq['@_PurposeType'] !== 'HARD') continue
      const bureau: string = inq.CREDIT_REPOSITORY?.['@_SourceType'] || ''
      const empresa: string = inq['@_Name'] || ''
      const dateStr: string = inq['@_Date'] || ''
      if (!empresa || !dateStr) continue
      if (isLinkedToAccount(empresa, accountNames)) continue  // skip if linked to an account
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

// POST /api/scraper/credit-hero — starts async job, returns job_id immediately
router.post('/credit-hero', requireAuth, async (req: AuthRequest, res: Response) => {
  const { email, password, cliente_id } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Se requieren email y contraseña del cliente' })

  const jobId = Math.random().toString(36).slice(2) + Date.now().toString(36)
  jobs.set(jobId, { status: 'pending', createdAt: Date.now() })

  // Fire-and-forget — runs in background
  ;(async () => {
    jobs.set(jobId, { status: 'processing', createdAt: Date.now() })
    try {
      const { arrayData } = await scrapeReport(email, password)
      const result = parseArrayData(arrayData)
      console.log('[SCRAPER] Scores:', result.scores, '| Inquiries:', result.total_inquiries)

      if (!cliente_id) {
        jobs.set(jobId, { status: 'done', result, createdAt: Date.now() })
        return
      }

      const usuarioId = req.usuario!.id
      const cliente = await pool.query('SELECT id FROM clientes WHERE id = $1 AND usuario_id = $2', [cliente_id, usuarioId])
      if (cliente.rows.length === 0) throw new Error('Cliente no encontrado')

      const today = new Date().toISOString().split('T')[0]
      const nombre = `credit-hero-${today}`
      const reporte = await pool.query(
        `INSERT INTO reportes_credito (cliente_id, nombre_archivo, ruta_archivo, fecha_reporte, tipo_reporte)
         VALUES ($1, $2, $3, $4, 'otro') RETURNING id`,
        [cliente_id, nombre, nombre, today]
      )
      const reporteId = reporte.rows[0].id

      console.log('[SCRAPER] Running AI analysis...')
      const textoReporte = mismoToText(arrayData)
      const openai = await getOpenAI(usuarioId)

      const prompt = `Actúa como un analista experto en reportes de crédito de Estados Unidos, especializado en revisión de errores, inconsistencias, cumplimiento normativo y estrategias de disputa bajo las leyes federales (FCRA, FDCPA, FACTA).

Analiza el reporte de crédito completo que aparece al final. Los datos están en formato estructurado extraído directamente de los burós de crédito vía API — son 100% exactos. Copia los datos EXACTAMENTE como aparecen.

El reporte muestra las cuentas con el campo Bureau indicando a qué buró pertenece cada entrada. Crea una entrada SEPARADA por cada combinación acreedor+buró.

REGLAS DE EXTRACCIÓN:
1. En el array "cuentas" incluye ÚNICAMENTE las cuentas negativas (collections, charge-offs, late payments, derogatorias). NO incluyas cuentas positivas o al día — eso infla el JSON y no aporta valor.
2. Para cada cuenta negativa extrae: acreedor, original_creditor, tipo, numero, balance, limite_credito, estado, fecha_apertura, fecha_cierre, fecha_ultimo_pago, buro.
3. Los inquiries ya están organizados por buró — extráelos exactamente como aparecen con empresa y fecha.
4. Extrae datos personales de todas las secciones disponibles por buró.
5. Los scores están en la sección Credit Score — extráelos exactamente.
6. En resumen_general sí reporta el total de cuentas (positivas + negativas), pero solo pon las negativas en el array "cuentas".

DETECCIÓN DE ERRORES:
- Cuentas duplicadas (mismo original creditor con diferentes nombres)
- Cuentas que exceden 7 años (FCRA §605)
- Balances o límites diferentes entre burós para la misma cuenta
- Datos personales incorrectos (direcciones desconocidas, nombres con variaciones)
- Hard inquiries no autorizados
- Cualquier inconsistencia entre burós

IDENTIFICACIÓN DE COLLECTIONS — MUY IMPORTANTE:
El reporte tiene una sección explícita de "Collections" donde aparecen las cuentas de cobro organizadas por buró (TransUnion, Equifax, Experian). Cada entrada muestra fecha, monto y nombre del acreedor/collector. DEBES extraer TODAS esas cuentas como negativo=true y tipo_negativo="collection". Si el mismo collector aparece en múltiples burós, crea una entrada por cada buró con su respectivo balance y fecha.

REGLAS DE CLASIFICACIÓN (campos MISMO 2.4):
- negativo=true si CUALQUIERA de estas condiciones es verdadera:
  * Account Type es "CollectionAccount" o contiene "Collection"
  * DEROGATORY: YES (campo @_DerogatoryDataIndicator = Y)
  * CHARGE OFF AMOUNT tiene valor (significa que fue charged off)
  * Rating contiene: Collection, Charge, ChargeOff, ChargeOffDerogatory, Late, PastDue, Derogatory, Adverse
  * Status contiene: Collection, ChargeOff, Derogatory, PastDue, Late
  * Payment History contiene 1, 2, 3, 4, 5, 6, 7, 8, 9 (días de atraso)
  * Current Rating Code no es "1" (= al día) ni "0"
- tipo_negativo: "collection" si es cuenta de cobro, "charge_off" si fue cargado, "late_payment" si tiene pagos tardíos, "derogatory" para otros negativos
- disputable=true si es negativa, tiene inconsistencias, es duplicada, o excede 7 años.

IMPORTANTE para inconsistencias_entre_buros: el campo "elemento" debe incluir SIEMPRE el nombre del acreedor Y el número de cuenta en formato "NOMBRE ACREEDOR – Acct #XXXX". Nunca pongas solo el número de cuenta sin el nombre.

Responde SOLO con JSON válido con esta estructura exacta:
{"scores":{"Experian":0,"Equifax":0,"TransUnion":0,"general":0},"inquiries":{"TransUnion":[{"empresa":"NOMBRE","fecha":"MM/YYYY"}],"Equifax":[{"empresa":"NOMBRE","fecha":"MM/YYYY"}],"Experian":[{"empresa":"NOMBRE","fecha":"MM/YYYY"}]},"resumen_general":{"total_cuentas":0,"cuentas_positivas":0,"cuentas_negativas":0,"collections":0,"charge_offs":0,"hard_inquiries":0,"cuentas_duplicadas_detectadas":0,"inconsistencias_personales_detectadas":0,"estado_general":"riesgo_medio"},"datos_personales":{"nombre_completo":"","ssn_parcial":"","fecha_nacimiento":"","direcciones_actuales":[],"direcciones_anteriores":[],"empleadores":[],"por_buro":{"Experian":{"nombres":[],"direcciones":[],"empleadores":[]},"Equifax":{"nombres":[],"direcciones":[],"empleadores":[]},"TransUnion":{"nombres":[],"direcciones":[],"empleadores":[]}}},"inconsistencias_personales":[{"tipo":"nombre|direccion|empleador","descripcion":"","buro":"","valor_reportado":"","disputable":true}],"cuentas":[{"acreedor":"","original_creditor":"","tipo":"","numero":"","balance":"","limite_credito":"","estado":"","fecha_apertura":"","fecha_cierre":"","fecha_ultimo_pago":"","buro":"","negativo":false,"tipo_negativo":"","disputable":false,"razon_disputa":""}],"cuentas_duplicadas":[{"acreedor_1":"","acreedor_2":"","original_creditor":"","numero_1":"","numero_2":"","buro_1":"","buro_2":"","balance_1":"","balance_2":"","descripcion":""}],"errores_detectados":[{"tipo":"","descripcion":"","buro":"","cuenta_relacionada":"","prioridad":"alta","ley_aplicable":"FCRA"}],"inconsistencias_entre_buros":[{"elemento":"NOMBRE ACREEDOR – Acct #XXXX","buros_involucrados":"","diferencia":"","prioridad":"alta"}],"recomendaciones":[{"tipo":"","descripcion":"","ley_aplicable":"FCRA","prioridad":1}]}

CONTENIDO DEL REPORTE:
${textoReporte}`

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Eres un experto en reparacion de credito en Estados Unidos. Tu respuesta debe ser UNICAMENTE el objeto JSON solicitado, sin ningun texto antes ni despues, sin markdown, sin bloques de codigo.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 16000
      })

      const raw = response.choices[0].message.content || ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('La IA no devolvió JSON válido.')
      let analisisData: any
      try {
        analisisData = JSON.parse(jsonMatch[0])
      } catch (parseErr: any) {
        throw new Error('La respuesta de la IA fue demasiado larga y se cortó. Intenta de nuevo.')
      }

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

      console.log('[SCRAPER] Done. job:', jobId, '| Accounts:', (analisisData.cuentas || []).length)
      jobs.set(jobId, { status: 'done', result: { ...result, reporte_id: reporteId }, createdAt: Date.now() })
    } catch (err: any) {
      console.error('[SCRAPER] Error job', jobId, ':', err.message)
      jobs.set(jobId, { status: 'error', error: err.message, createdAt: Date.now() })
    }
  })()

  // Respond immediately with the job ID
  res.json({ data: { job_id: jobId }, error: null })
})

// GET /api/scraper/job/:job_id — poll for job status
router.get('/job/:job_id', requireAuth, (req: AuthRequest, res: Response) => {
  const job = jobs.get(req.params.job_id)
  if (!job) return res.status(404).json({ error: 'Job no encontrado o expirado' })
  res.json({ data: { status: job.status, result: job.result ?? null, error: job.error ?? null }, error: null })
})

export default router
