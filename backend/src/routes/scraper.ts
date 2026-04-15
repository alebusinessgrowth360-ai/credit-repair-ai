import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import pool from '../db/client'

const router = Router()

const BASE = 'https://www.creditheroscore.com'
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

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

    // Intercept Array.io API responses before any navigation
    const arrayData: Record<string, any> = {}
    page.on('response', async (resp) => {
      try {
        const url = resp.url()
        if (!url.includes('array.io/api')) return
        const body = await resp.text()
        try { arrayData[url] = JSON.parse(body) } catch {}
      } catch {}
    })

    // Step 1: Login
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

    // Step 2: Wait for scores page — array.io scoretracker calls fire here
    await new Promise(r => setTimeout(r, 12000))
    const scoresUrl = page.url()
    const tGUIDMatch = scoresUrl.match(/tGUID=([^&]+)/i)
    const tGUID = tGUIDMatch ? tGUIDMatch[1] : ''
    console.log('[SCRAPER] tGUID:', tGUID)

    // Step 3: Navigate to report page — array-credit-report component calls array.io/api/report/v2
    const reportUrl = tGUID ? `${BASE}/cp6/mcc_creditreports_v2.asp?tGUID=${tGUID}` : `${BASE}/cp6/mcc_creditreports_v2.asp`
    await page.goto(reportUrl, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 15000))

    console.log('[SCRAPER] Array.io responses captured:', Object.keys(arrayData).length)
    return { arrayData }
  } finally {
    await browser.close()
  }
}

function parseArrayData(arrayData: Record<string, any>) {
  // Scores from scoretracker
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

  // Inquiries from MISMO 2.4 full report
  const inquiries: Record<string, Array<{ empresa: string; fecha: string }>> = {
    TransUnion: [], Experian: [], Equifax: []
  }
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
      const fecha = !isNaN(d.getTime())
        ? `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
        : dateStr
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
    console.log('[SCRAPER] Scores:', result.scores)
    console.log('[SCRAPER] Total inquiries:', result.total_inquiries)

    if (cliente_id) {
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

      await pool.query(
        `INSERT INTO analisis_reportes (reporte_id, resumen_general, inquiries, errores_detectados, cuentas, recomendaciones, estado_general)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          reporteId,
          JSON.stringify({ scores: result.scores, total_inquiries: result.total_inquiries, fuente: 'Credit Hero Score' }),
          JSON.stringify(result.inquiries),
          JSON.stringify([]),
          JSON.stringify([]),
          JSON.stringify([]),
          'riesgo_medio'
        ]
      )

      return res.json({ data: { ...result, reporte_id: reporteId }, error: null })
    }

    res.json({ data: result, error: null })
  } catch (err: any) {
    console.error('[SCRAPER] Error:', err.message)
    res.status(400).json({ error: err.message })
  }
})

export default router
