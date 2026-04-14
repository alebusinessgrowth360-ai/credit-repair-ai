import { Router, Response } from 'express'
import axios, { AxiosResponse } from 'axios'
import { CookieJar } from 'tough-cookie'
import * as cheerio from 'cheerio'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const BASE = 'https://www.creditheroscore.com'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Manual cookie jar helpers
async function httpGet(url: string, jar: CookieJar): Promise<AxiosResponse> {
  const cookieString = await jar.getCookieString(url)
  const res = await axios.get(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Cookie': cookieString },
    maxRedirects: 10,
    validateStatus: () => true
  })
  for (const c of (res.headers['set-cookie'] || [])) {
    const baseUrl = new URL(url).origin
    await jar.setCookie(c, baseUrl).catch(() => {})
  }
  return res
}

async function httpPost(url: string, body: string, jar: CookieJar, referer: string): Promise<AxiosResponse> {
  const cookieString = await jar.getCookieString(url)
  const res = await axios.post(url, body, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': referer,
      'Cookie': cookieString
    },
    maxRedirects: 10,
    validateStatus: () => true
  })
  for (const c of (res.headers['set-cookie'] || [])) {
    const baseUrl = new URL(url).origin
    await jar.setCookie(c, baseUrl).catch(() => {})
  }
  return res
}

async function loginAndFetchReport(email: string, password: string): Promise<string> {
  const jar = new CookieJar()

  // Step 1: GET login page → get tGUID + session cookies
  const loginPage = await httpGet(`${BASE}/customer_login.asp`, jar)
  const $login = cheerio.load(loginPage.data)
  const tGUID = $login('input[name="tGUID"]').val() as string
  if (!tGUID) throw new Error('No se pudo obtener el token de sesión. Intenta de nuevo.')

  // Step 2: POST credentials
  const params = new URLSearchParams({
    tGUID,
    path: '',
    sourcedomain: '',
    returl: '',
    username: email,
    password
  })

  const loginRes = await httpPost(
    `${BASE}/customer_login.asp?`,
    params.toString(),
    jar,
    `${BASE}/customer_login.asp`
  )

  // Detect login failure
  const $check = cheerio.load(loginRes.data)
  if ($check('input[name="password"]').length > 0) {
    const errText = $check('.alert, .error, [class*="error"], [class*="alert"]').text().trim()
    throw new Error(errText || 'Email o contraseña incorrectos. Verifica las credenciales del cliente.')
  }

  // Step 3: GET credit report page
  const reportRes = await httpGet(`${BASE}/cp6/mcc_creditreports_v2.asp`, jar)

  // If redirected back to login, credentials failed silently
  if (reportRes.request?.path?.includes('login') || cheerio.load(reportRes.data)('input[name="password"]').length > 0) {
    throw new Error('No se pudo acceder al reporte. Verifica que las credenciales sean correctas.')
  }

  if (!reportRes.data || String(reportRes.data).length < 1000) {
    throw new Error('El reporte está vacío o no existe para esta cuenta.')
  }

  return String(reportRes.data)
}

function parseInquiriesFromHTML(html: string): Record<string, Array<{ empresa: string; fecha: string }>> {
  const $ = cheerio.load(html)
  const inquiries: Record<string, Array<{ empresa: string; fecha: string }>> = {
    TransUnion: [],
    Equifax: [],
    Experian: []
  }

  // Find the table that contains inquiry data (has "Total count" row and bureau headers)
  let inquiryTableEl: any = null
  $('table').each((_i, tbl) => {
    const text = $(tbl).text()
    if (text.match(/total\s+count/i) && text.match(/TransUnion/i) && text.match(/Equifax/i)) {
      inquiryTableEl = tbl
    }
  })

  if (!inquiryTableEl) return inquiries

  const colMap: Record<number, string> = { 1: 'TransUnion', 2: 'Equifax', 3: 'Experian' }

  $(inquiryTableEl).find('tr').each((_i, row) => {
    const cells = $(row).find('td')
    if (cells.length < 4) return

    const labelText = $(cells[0]).text().trim().toLowerCase()
    // Skip header rows, total rows, and empty rows
    if (labelText.includes('total') || labelText.includes('bureau') || labelText.includes('inquir') || labelText === '') return

    // Each data row: col 0 = row label (often empty or "Creditor"), col 1 = TU value, col 2 = EQ value, col 3 = EX value
    for (const [colIdx, buro] of Object.entries(colMap)) {
      const cell = $(cells[parseInt(colIdx)])
      const rawText = cell.text().replace(/\s+/g, ' ').trim()
      if (!rawText) continue

      // Parse: company name + date (format: "COMPANY NAME Apr 2, 2025" or "COMPANY\nDate")
      const dateMatch = rawText.match(/([A-Za-z]+ \d{1,2},?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i)
      let empresa = rawText
      let fecha = ''

      if (dateMatch) {
        empresa = rawText.substring(0, rawText.indexOf(dateMatch[0])).trim().replace(/[,]+$/, '').trim()
        const d = new Date(dateMatch[0].replace(',', ''))
        if (!isNaN(d.getTime())) {
          fecha = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
        } else {
          fecha = dateMatch[0]
        }
      }

      if (empresa && empresa.length > 1) {
        inquiries[buro].push({ empresa, fecha })
      }
    }
  })

  return inquiries
}

function parseScoresFromHTML(html: string): Record<string, number> {
  const $ = cheerio.load(html)
  const scores: Record<string, number> = { TransUnion: 0, Equifax: 0, Experian: 0, general: 0 }

  // Look for score containers — Credit Hero Score typically shows scores in a summary/header section
  const text = $.html()
  const bureauPatterns: Array<[string, RegExp]> = [
    ['TransUnion', /TransUnion[\s\S]{0,200}?(\d{3})/i],
    ['Equifax',    /Equifax[\s\S]{0,200}?(\d{3})/i],
    ['Experian',   /Experian[\s\S]{0,200}?(\d{3})/i],
  ]

  for (const [bureau, pattern] of bureauPatterns) {
    const match = text.match(pattern)
    if (match) {
      const score = parseInt(match[1])
      if (score >= 300 && score <= 850) scores[bureau] = score
    }
  }

  if (scores.TransUnion || scores.Equifax || scores.Experian) {
    const vals = [scores.TransUnion, scores.Equifax, scores.Experian].filter(s => s > 0)
    scores.general = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  }

  return scores
}

// POST /api/scraper/credit-hero
// Returns parsed inquiry and score data from the live Credit Hero Score report
router.post('/credit-hero', requireAuth, async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Se requieren email y contraseña del cliente' })

  try {
    const html = await loginAndFetchReport(email, password)

    // Debug: log HTML structure to console
    const $ = require('cheerio').load(html)
    const allTables: string[] = []
    $('table').each((_i: number, tbl: any) => {
      const txt = $(tbl).text().replace(/\s+/g, ' ').trim().substring(0, 300)
      allTables.push(txt)
    })
    const cleanHtmlSample = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s{3,}/g, ' ')
    console.log('[SCRAPER] HTML length:', html.length)
    console.log('[SCRAPER] Tables found:', allTables.length)
    allTables.forEach((t, i) => console.log(`[SCRAPER] Table[${i}]:`, t.substring(0, 200)))
    console.log('[SCRAPER] HTML sample:', cleanHtmlSample.substring(0, 2000))

    const inquiries = parseInquiriesFromHTML(html)
    const scores = parseScoresFromHTML(html)
    const totalInquiries = inquiries.TransUnion.length + inquiries.Equifax.length + inquiries.Experian.length

    res.json({
      data: {
        scores,
        inquiries,
        total_inquiries: totalInquiries,
        // Debug fields — remove after confirming structure
        debug_tables_found: allTables.length,
        debug_html_sample: cleanHtmlSample.substring(0, 3000),
        debug_tables: allTables.slice(0, 5),
        html_report: cleanHtmlSample.substring(0, 80000)
      },
      error: null
    })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
