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
    await page.click('.btn.login')
    await new Promise(r => setTimeout(r, 5000))

    // Detect login failure: still on login page = login form with action customer_login exists
    const afterLoginUrl = page.url()
    const loginFormStillActive = await page.evaluate(new Function(`
      var form = document.querySelector('#CFForm_1');
      if (!form) return false;
      // Login form has a password input — if hidden or not present, login succeeded
      var pwd = form.querySelector('input[type="password"]');
      return !!(pwd && pwd.offsetParent !== null);
    `) as () => boolean)
    console.log('[SCRAPER] After login URL:', afterLoginUrl, '| form active:', loginFormStillActive)
    if (afterLoginUrl.includes('customer_login') && loginFormStillActive) {
      throw new Error('Email o contraseña incorrectos. Verifica las credenciales del cliente.')
    }

    // Step 2: We're on mcc_creditscores.asp — wait for the scores JS to run the fulfillment API
    // and build the "View Report" button. This sets up the session state needed for the report page.
    console.log('[SCRAPER] Waiting for scores page to initialize...')
    await new Promise(r => setTimeout(r, 8000))

    // Find the credit report link on the scores page (button points to mcc_creditreports_v2.asp or _v3.asp)
    const reportHref: string = await page.evaluate(new Function(`
      var links = Array.from(document.querySelectorAll('a[href]'));
      var reportLink = links.find(function(a) { return a.href && a.href.match(/mcc_creditreport/i); });
      return reportLink ? reportLink.href : 'https://www.creditheroscore.com/cp6/mcc_creditreports_v2.asp';
    `) as () => string)
    console.log('[SCRAPER] Report link found:', reportHref)

    // Step 3: Navigate to the report page (session is now primed with score data)
    await page.goto(reportHref, { waitUntil: 'networkidle2', timeout: 30000 })
    const reportUrl = page.url()
    console.log('[SCRAPER] Report page URL:', reportUrl)

    // Wait for the page JS to create the bureau report divs
    await new Promise(r => setTimeout(r, 8000))

    // Inspect the report selector elements
    const reportInfo = await page.evaluate(new Function(`
      var cp7Link = document.getElementById('cp7-credit-report-link');
      var selector = document.getElementById('reportSelector');
      var form = document.getElementById('reportForm');
      var selectorOptions = selector ? Array.from(selector.options || selector.querySelectorAll('option')).map(function(o) { return { value: o.value, text: o.text }; }) : [];
      return {
        cp7LinkHref: cp7Link ? cp7Link.href || cp7Link.getAttribute('href') || cp7Link.outerHTML : 'NOT FOUND',
        selectorOptions: selectorOptions,
        formAction: form ? form.action : 'NOT FOUND',
        formMethod: form ? form.method : '',
        formInputs: form ? Array.from(form.querySelectorAll('input,select')).map(function(el) { return { name: el.name, value: el.value, type: el.type }; }) : []
      }
    `) as () => any)
    console.log('[SCRAPER] cp7 link:', reportInfo.cp7LinkHref)
    console.log('[SCRAPER] Selector options:', JSON.stringify(reportInfo.selectorOptions))
    console.log('[SCRAPER] Form action:', reportInfo.formAction, '| method:', reportInfo.formMethod)
    console.log('[SCRAPER] Form inputs:', JSON.stringify(reportInfo.formInputs))

    // Step 3: Trigger bureau report loading via jQuery (same as loadCreditReportTUI/EXP/EFX in main.js)
    // Wait up to 20 seconds for each bureau div to get loaded="1" attribute
    async function loadBureauViaJQ(ajaxAction: string, divId: string): Promise<string> {
      // Trigger the AJAX load
      await page.evaluate(new Function('ajaxAction', `
        var jq = window.jQuery || window.$;
        if (!jq) return;
        jq.post('mcc_creditreports_v2.asp',
          { ajax: 'true', ajaxAction: ajaxAction, historyReportID: '' },
          function(data) {
            var div = document.getElementById('${divId}');
            if (div) { div.innerHTML = data; div.setAttribute('loaded','1'); }
          }
        );
      `) as (a: string) => void, ajaxAction)

      // Wait for the div to be marked as loaded
      try {
        await page.waitForFunction(
          new Function('id', `return document.getElementById(id) && document.getElementById(id).getAttribute('loaded') === '1'`) as (id: string) => boolean,
          { timeout: 20000 },
          divId
        )
      } catch (_) {
        console.log(`[SCRAPER] Timeout waiting for ${divId}`)
      }

      const html: string = await page.evaluate(new Function('id', `
        var el = document.getElementById(id);
        return el ? el.innerHTML : '';
      `) as (id: string) => string, divId)

      return html
    }

    const tuiHTML = await loadBureauViaJQ('MCC_CreditReport_TUI', 'report-transunion-body')
    const expHTML = await loadBureauViaJQ('MCC_CreditReport_EXP', 'report-experian-body')
    const efxHTML = await loadBureauViaJQ('MCC_CreditReport_EFX', 'report-equifax-body')

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
