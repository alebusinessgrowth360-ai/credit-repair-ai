import { Router, Response } from 'express'
import axios, { AxiosResponse } from 'axios'
import { CookieJar } from 'tough-cookie'
import * as cheerio from 'cheerio'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const BASE = 'https://www.creditheroscore.com'
const REPORT_PATH = '/cp6/mcc_creditreports_v2.asp'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function httpGet(url: string, jar: CookieJar): Promise<AxiosResponse> {
  const cookieString = await jar.getCookieString(url)
  const res = await axios.get(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Cookie': cookieString },
    maxRedirects: 10,
    validateStatus: () => true
  })
  for (const c of (res.headers['set-cookie'] || [])) {
    await jar.setCookie(c, new URL(url).origin).catch(() => {})
  }
  return res
}

async function httpPost(url: string, body: URLSearchParams | string, jar: CookieJar, referer?: string): Promise<AxiosResponse> {
  const cookieString = await jar.getCookieString(url)
  const res = await axios.post(url, body.toString(), {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(referer ? { 'Referer': referer } : {}),
      'Cookie': cookieString
    },
    maxRedirects: 10,
    validateStatus: () => true
  })
  for (const c of (res.headers['set-cookie'] || [])) {
    await jar.setCookie(c, new URL(url).origin).catch(() => {})
  }
  return res
}

async function login(email: string, password: string): Promise<CookieJar> {
  const jar = new CookieJar()

  // GET login page to get tGUID + session cookies
  const loginPage = await httpGet(`${BASE}/customer_login.asp`, jar)
  const $login = cheerio.load(loginPage.data)
  const tGUID = $login('input[name="tGUID"]').val() as string
  if (!tGUID) throw new Error('No se pudo obtener el token de sesión. Intenta de nuevo.')

  // POST credentials
  const params = new URLSearchParams({ tGUID, path: '', sourcedomain: '', returl: '', username: email, password })
  const loginRes = await httpPost(`${BASE}/customer_login.asp?`, params, jar, `${BASE}/customer_login.asp`)

  // Detect login failure
  const $check = cheerio.load(loginRes.data)
  if ($check('input[name="password"]').length > 0) {
    const errText = $check('.alert, .error, [class*="error"], [class*="alert"]').text().trim()
    throw new Error(errText || 'Email o contraseña incorrectos.')
  }

  return jar
}

async function fetchBureauReport(jar: CookieJar, ajaxAction: string): Promise<string> {
  const params = new URLSearchParams({ ajax: 'true', ajaxAction })
  const cookieString = await jar.getCookieString(`${BASE}${REPORT_PATH}`)
  const res = await axios.post(`${BASE}${REPORT_PATH}`, params.toString(), {
    headers: {
      'User-Agent': UA,
      'Accept': '*/*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${BASE}${REPORT_PATH}`,
      'Origin': BASE,
      'Cookie': cookieString
    },
    maxRedirects: 5,
    validateStatus: () => true
  })
  for (const c of (res.headers['set-cookie'] || [])) {
    await jar.setCookie(c, BASE).catch(() => {})
  }
  return String(res.data)
}

function parseInquiriesFromBureauHTML(html: string, buro: string): Array<{ empresa: string; fecha: string }> {
  const $ = cheerio.load(html)
  const results: Array<{ empresa: string; fecha: string }> = []

  // Inquiries section: look for a table or section with "Inquiries" heading
  // Each row is one inquiry with company name and date
  let inInquirySection = false

  $('tr, div[class*="inquiry"], div[class*="Inquiry"]').each((_i, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()

    if (text.match(/hard\s+inquir|inquiries/i)) {
      inInquirySection = true
      return
    }

    if (inInquirySection && text.length > 2 && text.length < 200) {
      // Try to extract company + date
      const dateMatch = text.match(/(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i)
      if (dateMatch) {
        let empresa = text.substring(0, text.indexOf(dateMatch[0])).trim().replace(/[,\s]+$/, '').trim()
        const d = new Date(dateMatch[0].replace(',', ''))
        let fecha = ''
        if (!isNaN(d.getTime())) {
          fecha = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
        } else {
          fecha = dateMatch[0]
        }
        if (empresa && empresa.length > 1) {
          results.push({ empresa, fecha })
        }
      }
    }
  })

  // Fallback: scan all table rows for lines that look like inquiry entries (company + date)
  if (results.length === 0) {
    $('td, th').each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const dateMatch = text.match(/(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i)
      if (dateMatch && text.length < 150 && text.length > 5) {
        let empresa = text.substring(0, text.indexOf(dateMatch[0])).trim().replace(/[,\s]+$/, '').trim()
        if (empresa && empresa.length > 1 && !empresa.match(/total|count|bureau|inquir|credit score/i)) {
          const d = new Date(dateMatch[0].replace(',', ''))
          let fecha = ''
          if (!isNaN(d.getTime())) {
            fecha = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
          } else {
            fecha = dateMatch[0]
          }
          results.push({ empresa, fecha })
        }
      }
    })
  }

  return results
}

function parseScoreFromBureauHTML(html: string): number {
  const $ = cheerio.load(html)

  // Look for score in data-score attribute (slider element) or .slider, .score-holder, etc.
  let score = 0

  $('[data-score]').each((_i, el) => {
    const s = parseInt($(el).attr('data-score') || '0')
    if (s >= 300 && s <= 850) { score = s; return false }
  })

  if (!score) {
    $('[class*="score"], [class*="Score"]').each((_i, el) => {
      const text = $(el).text().trim()
      const match = text.match(/^(\d{3})$/)
      if (match) {
        const s = parseInt(match[1])
        if (s >= 300 && s <= 850) { score = s; return false }
      }
    })
  }

  // Last resort: find standalone 3-digit number between 300-850
  if (!score) {
    const text = $.html()
    const matches = text.match(/\b([3-8]\d{2})\b/g) || []
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
    const jar = await login(email, password)

    // Get the report page first to establish context
    await httpGet(`${BASE}${REPORT_PATH}`, jar)

    // Fetch each bureau's report via the AJAX endpoints discovered in the JS
    const [tuiHTML, expHTML, efxHTML] = await Promise.all([
      fetchBureauReport(jar, 'MCC_CreditReport_TUI'),
      fetchBureauReport(jar, 'MCC_CreditReport_EXP'),
      fetchBureauReport(jar, 'MCC_CreditReport_EFX'),
    ])

    console.log('[SCRAPER] TUI HTML length:', tuiHTML.length, '| EXP:', expHTML.length, '| EFX:', efxHTML.length)
    console.log('[SCRAPER] TUI sample:', tuiHTML.substring(0, 500))
    console.log('[SCRAPER] EXP sample:', expHTML.substring(0, 300))
    console.log('[SCRAPER] EFX sample:', efxHTML.substring(0, 300))

    const inquiries = {
      TransUnion: parseInquiriesFromBureauHTML(tuiHTML, 'TransUnion'),
      Experian:   parseInquiriesFromBureauHTML(expHTML, 'Experian'),
      Equifax:    parseInquiriesFromBureauHTML(efxHTML, 'Equifax'),
    }

    const scores = {
      TransUnion: parseScoreFromBureauHTML(tuiHTML),
      Experian:   parseScoreFromBureauHTML(expHTML),
      Equifax:    parseScoreFromBureauHTML(efxHTML),
      general:    0
    }
    const vals = [scores.TransUnion, scores.Experian, scores.Equifax].filter(s => s > 0)
    scores.general = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0

    const totalInquiries = inquiries.TransUnion.length + inquiries.Experian.length + inquiries.Equifax.length

    res.json({
      data: { scores, inquiries, total_inquiries: totalInquiries },
      error: null
    })
  } catch (err: any) {
    console.error('[SCRAPER] Error:', err.message)
    res.status(400).json({ error: err.message })
  }
})

export default router
