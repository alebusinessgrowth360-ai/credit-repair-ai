import { Router, Response } from 'express'
import * as cheerio from 'cheerio'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const BASE = 'https://www.creditheroscore.com'
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser'

async function scrapeReport(email: string, password: string) {
  // Import puppeteer-core dynamically to avoid issues at module load time
  const puppeteer = await import('puppeteer-core')

  const browser = await puppeteer.default.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process'
    ]
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.setViewport({ width: 1280, height: 800 })

    // Step 1: Login
    await page.goto(`${BASE}/customer_login.asp`, { waitUntil: 'networkidle2', timeout: 30000 })
    await page.type('#username', email, { delay: 30 })
    await page.type('#password', password, { delay: 30 })
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('.btn.login')
    ])

    // Detect login failure
    const stillOnLogin = await page.$('input[name="password"]')
    if (stillOnLogin) throw new Error('Email o contraseña incorrectos.')

    // Step 2: Navigate to credit report page
    await page.goto(`${BASE}/cp6/mcc_creditreports_v2.asp`, { waitUntil: 'networkidle2', timeout: 30000 })

    // Step 3: Wait for bureau tabs/sections to appear and trigger loading
    // The page loads report data lazily when tabs are clicked
    await new Promise(r => setTimeout(r, 3000))

    // Try to find and click tabs to load each bureau's data
    const tabSelectors = [
      '#transunion-tab, [href="#transunion"], [data-target="#transunion"], .nav-tab-transunion',
      '#equifax-tab, [href="#equifax"], [data-target="#equifax"], .nav-tab-equifax',
      '#experian-tab, [href="#experian"], [data-target="#experian"], .nav-tab-experian',
    ]

    for (const sel of tabSelectors) {
      try {
        const tab = await page.$(sel)
        if (tab) {
          await tab.click()
          await new Promise(r => setTimeout(r, 2000))
        }
      } catch (_) {}
    }

    // Step 4: Wait for report bodies to load
    await new Promise(r => setTimeout(r, 5000))

    // Step 5: Get each bureau's report via jQuery AJAX (exactly what the browser JS does)
    function makeBureauCall(ajaxAction: string) {
      return `new Promise(function(resolve) {
        var jq = window.jQuery || window.$;
        if (!jq) { resolve(''); return; }
        jq.post('mcc_creditreports_v2.asp', {
          ajax: 'true', ajaxAction: '${ajaxAction}', historyReportID: ''
        }, function(data) { resolve(data); }).fail(function() { resolve(''); });
      })`
    }

    const tuiHTML: string = await page.evaluate(new Function(`return ${makeBureauCall('MCC_CreditReport_TUI')}`) as () => Promise<string>)
    const expHTML: string = await page.evaluate(new Function(`return ${makeBureauCall('MCC_CreditReport_EXP')}`) as () => Promise<string>)
    const efxHTML: string = await page.evaluate(new Function(`return ${makeBureauCall('MCC_CreditReport_EFX')}`) as () => Promise<string>)

    console.log('[SCRAPER] TUI:', tuiHTML.length, 'EXP:', expHTML.length, 'EFX:', efxHTML.length)
    console.log('[SCRAPER] TUI sample:', tuiHTML.substring(0, 300))

    return { tuiHTML, expHTML, efxHTML }
  } finally {
    await browser.close()
  }
}

function parseInquiries(html: string): Array<{ empresa: string; fecha: string }> {
  if (!html || html.length < 100) return []
  const $ = cheerio.load(html)
  const results: Array<{ empresa: string; fecha: string }> = []
  const dateRe = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/i

  $('td, tr, div').each((_i, el) => {
    const text = $(el).clone().children().remove().end().text().replace(/\s+/g, ' ').trim()
    if (!text || text.length > 200 || text.length < 3) return
    if (text.match(/total|count|bureau|inquir|credit score|address|balance|account|why is/i)) return

    const m = text.match(dateRe)
    if (m) {
      let empresa = text.substring(0, text.indexOf(m[0])).trim().replace(/[,\s]+$/, '').trim()
      if (!empresa || empresa.length < 2) return
      const d = new Date(m[0].replace(',', ''))
      const fecha = !isNaN(d.getTime())
        ? `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
        : m[0]
      results.push({ empresa, fecha })
    }
  })

  return results
}

function parseScore(html: string): number {
  if (!html || html.length < 100) return 0
  const $ = cheerio.load(html)

  let score = 0
  $('[data-score]').each((_i, el) => {
    const s = parseInt($(el).attr('data-score') || '0')
    if (s >= 300 && s <= 850 && !score) score = s
  })

  if (!score) {
    const matches = html.match(/\b([3-8]\d{2})\b/g) || []
    for (const m of matches) {
      const s = parseInt(m)
      if (s >= 300 && s <= 850) { score = s; break }
    }
  }
  return score
}

// POST /api/scraper/credit-hero
router.post('/credit-hero', requireAuth, async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Se requieren email y contraseña del cliente' })

  try {
    const { tuiHTML, expHTML, efxHTML } = await scrapeReport(email, password)

    const inquiries = {
      TransUnion: parseInquiries(tuiHTML),
      Experian:   parseInquiries(expHTML),
      Equifax:    parseInquiries(efxHTML),
    }

    const scores = {
      TransUnion: parseScore(tuiHTML),
      Experian:   parseScore(expHTML),
      Equifax:    parseScore(efxHTML),
      general:    0
    }
    const vals = [scores.TransUnion, scores.Experian, scores.Equifax].filter(s => s > 0)
    scores.general = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0

    const totalInquiries = inquiries.TransUnion.length + inquiries.Experian.length + inquiries.Equifax.length

    res.json({ data: { scores, inquiries, total_inquiries: totalInquiries }, error: null })
  } catch (err: any) {
    console.error('[SCRAPER] Error:', err.message)
    res.status(400).json({ error: err.message })
  }
})

export default router
