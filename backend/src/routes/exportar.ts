import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// POST /api/exportar/evaluacion/:reporte_id — exportar evaluacion completa como HTML
router.post('/evaluacion/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { id: reporteId } = req.params
  try {
    const reporte = await pool.query(
      `SELECT r.*, c.nombre_completo, c.email FROM reportes_credito r
       JOIN clientes c ON c.id = r.cliente_id
       WHERE r.id = $1 AND c.usuario_id = $2`,
      [reporteId, usuarioId]
    )
    if (reporte.rows.length === 0) return res.status(404).json({ error: 'Reporte no encontrado' })

    const analisis = await pool.query('SELECT * FROM analisis_reportes WHERE reporte_id = $1', [reporteId])
    if (analisis.rows.length === 0) return res.status(400).json({ error: 'Este reporte no tiene analisis. Analiza primero.' })

    const branding = await pool.query('SELECT * FROM branding WHERE usuario_id = $1', [usuarioId])
    const brand = branding.rows[0] || {}

    const r = reporte.rows[0]
    const a = analisis.rows[0]
    const resumen = a.resumen_general || {}
    const errores = a.errores_detectados || []
    const recomendaciones = a.recomendaciones || []
    const cuentas = a.cuentas || []

    const colorPrimario = brand.color_primario || '#1a1a2e'
    const encabezado = brand.encabezado_pdf || 'Credit Repair Analysis'
    const piePagina = brand.pie_pagina_pdf || ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Credit Report Evaluation - ${r.nombre_completo}</title>
<style>
  body { font-family: Arial, sans-serif; color: #333; margin: 40px; }
  h1 { color: ${colorPrimario}; border-bottom: 2px solid ${colorPrimario}; padding-bottom: 8px; }
  h2 { color: ${colorPrimario}; margin-top: 30px; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 13px; font-weight: bold; }
  .riesgo_alto { background: #fee2e2; color: #b91c1c; }
  .riesgo_medio { background: #fef3c7; color: #92400e; }
  .riesgo_bajo { background: #d1fae5; color: #065f46; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: ${colorPrimario}; color: white; padding: 8px 12px; text-align: left; }
  td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .meta { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
  .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px; color: #6b7280; font-size: 12px; }
  .prioridad-alta { color: #dc2626; font-weight: bold; }
  .prioridad-media { color: #d97706; }
  .prioridad-baja { color: #059669; }
</style>
</head>
<body>
<h1>${encabezado}</h1>
<p class="meta">
  Client: <strong>${r.nombre_completo}</strong> &nbsp;|&nbsp;
  Bureau: ${r.tipo_reporte} &nbsp;|&nbsp;
  Report Date: ${r.fecha_reporte} &nbsp;|&nbsp;
  Generated: ${new Date().toLocaleDateString('en-US')}
</p>

<h2>Summary</h2>
<p>Overall Status: <span class="badge ${resumen.estado_general || 'riesgo_medio'}">${(resumen.estado_general || 'riesgo_medio').replace('_', ' ').toUpperCase()}</span></p>
<table>
  <tr><th>Metric</th><th>Value</th></tr>
  <tr><td>Total Accounts</td><td>${resumen.total_cuentas || 0}</td></tr>
  <tr><td>Positive Accounts</td><td>${resumen.cuentas_positivas || 0}</td></tr>
  <tr><td>Negative Accounts</td><td>${resumen.cuentas_negativas || 0}</td></tr>
  <tr><td>Collections</td><td>${resumen.collections || 0}</td></tr>
  <tr><td>Charge-offs</td><td>${resumen.charge_offs || 0}</td></tr>
  <tr><td>Hard Inquiries</td><td>${resumen.hard_inquiries || 0}</td></tr>
</table>

${errores.length > 0 ? `
<h2>Detected Errors (${errores.length})</h2>
<table>
  <tr><th>Type</th><th>Description</th><th>Bureau</th><th>Law</th><th>Priority</th></tr>
  ${errores.map((e: any) => `
  <tr>
    <td>${e.tipo || ''}</td>
    <td>${e.descripcion || ''}</td>
    <td>${e.buro || 'N/A'}</td>
    <td>${e.ley_aplicable || 'FCRA'}</td>
    <td class="prioridad-${e.prioridad || 'media'}">${(e.prioridad || 'media').toUpperCase()}</td>
  </tr>`).join('')}
</table>` : '<h2>Detected Errors</h2><p>No errors detected.</p>'}

${cuentas.length > 0 ? `
<h2>Accounts (${cuentas.length})</h2>
<table>
  <tr><th>Creditor</th><th>Type</th><th>Balance</th><th>Status</th><th>Disputable</th></tr>
  ${cuentas.map((c: any) => `
  <tr>
    <td>${c.acreedor || ''}</td>
    <td>${c.tipo || ''}</td>
    <td>${c.balance || 'N/A'}</td>
    <td>${c.estado || ''}</td>
    <td>${c.disputable ? '✓ ' + (c.razon_disputa || '') : '—'}</td>
  </tr>`).join('')}
</table>` : ''}

${recomendaciones.length > 0 ? `
<h2>Recommendations</h2>
<table>
  <tr><th>#</th><th>Action</th><th>Law</th><th>Priority</th></tr>
  ${recomendaciones.map((rec: any, i: number) => `
  <tr>
    <td>${i + 1}</td>
    <td>${rec.descripcion || rec.tipo || ''}</td>
    <td>${rec.ley_aplicable || 'FCRA'}</td>
    <td class="prioridad-${rec.prioridad === 1 ? 'alta' : rec.prioridad === 2 ? 'media' : 'baja'}">${rec.prioridad === 1 ? 'HIGH' : rec.prioridad === 2 ? 'MEDIUM' : 'LOW'}</td>
  </tr>`).join('')}
</table>` : ''}

<div class="footer">${piePagina} &nbsp;|&nbsp; Generated by Credit Repair AI Suite</div>
</body>
</html>`

    res.json({ data: { html, filename: `evaluacion_${r.nombre_completo.replace(/\s+/g, '_')}_${r.tipo_reporte}.html` }, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/exportar/carta/:id — exportar carta como HTML listo para imprimir
router.post('/carta/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { id: cartaId } = req.params
  try {
    const carta = await pool.query(
      `SELECT ca.*, c.nombre_completo, c.direccion, c.ciudad, c.estado, c.zip
       FROM cartas ca
       JOIN clientes c ON c.id = ca.cliente_id
       WHERE ca.id = $1 AND c.usuario_id = $2`,
      [cartaId, usuarioId]
    )
    if (carta.rows.length === 0) return res.status(404).json({ error: 'Carta no encontrada' })

    const branding = await pool.query('SELECT * FROM branding WHERE usuario_id = $1', [usuarioId])
    const brand = branding.rows[0] || {}

    const ca = carta.rows[0]
    const colorPrimario = brand.color_primario || '#1a1a2e'
    const piePagina = brand.pie_pagina_pdf || ''

    const contenidoHtml = (ca.contenido || '').replace(/\n/g, '<br>')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Dispute Letter - ${ca.nombre_completo}</title>
<style>
  body { font-family: Arial, sans-serif; color: #333; margin: 60px; max-width: 700px; }
  .header { border-bottom: 2px solid ${colorPrimario}; margin-bottom: 30px; padding-bottom: 12px; color: ${colorPrimario}; font-size: 12px; }
  .content { line-height: 1.8; font-size: 14px; }
  .footer { margin-top: 50px; border-top: 1px solid #e5e7eb; padding-top: 12px; color: #6b7280; font-size: 11px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; background: #dbeafe; color: #1e40af; margin-left: 8px; }
</style>
</head>
<body>
<div class="header">
  ${brand.encabezado_pdf || 'Credit Repair Services'}
  <span class="badge">${ca.ley_aplicada || 'FCRA'}</span>
  <span class="badge">${ca.tipo_carta.replace(/_/g, ' ').toUpperCase()}</span>
</div>
<div class="content">${contenidoHtml}</div>
<div class="footer">${piePagina} &nbsp;|&nbsp; Generated by Credit Repair AI Suite</div>
</body>
</html>`

    // Marcar carta como exportada
    await pool.query('UPDATE cartas SET estado=$1, updated_at=NOW() WHERE id=$2 AND estado=$3', ['exportada', cartaId, 'borrador'])

    res.json({ data: { html, filename: `carta_${ca.nombre_completo.replace(/\s+/g, '_')}_${ca.tipo_carta}.html` }, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/exportar/comparacion/:id — exportar comparacion de reportes
router.post('/comparacion/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { id: comparacionId } = req.params
  try {
    const comp = await pool.query(
      `SELECT co.*, c.nombre_completo FROM comparaciones_reportes co
       JOIN clientes c ON c.id = co.cliente_id
       WHERE co.id = $1 AND c.usuario_id = $2`,
      [comparacionId, usuarioId]
    )
    if (comp.rows.length === 0) return res.status(404).json({ error: 'Comparacion no encontrada' })

    const branding = await pool.query('SELECT * FROM branding WHERE usuario_id = $1', [usuarioId])
    const brand = branding.rows[0] || {}
    const co = comp.rows[0]
    const resultado = co.resultado || {}
    const colorPrimario = brand.color_primario || '#1a1a2e'
    const progreso = co.progreso_general || 'sin_cambios'
    const progresoColor = progreso === 'mejoro' ? '#059669' : progreso === 'empeoro' ? '#dc2626' : '#6b7280'
    const progresoLabel = progreso === 'mejoro' ? 'IMPROVED' : progreso === 'empeoro' ? 'DECLINED' : 'NO CHANGE'

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Report Comparison - ${co.nombre_completo}</title>
<style>
  body { font-family: Arial, sans-serif; color: #333; margin: 40px; }
  h1 { color: ${colorPrimario}; border-bottom: 2px solid ${colorPrimario}; padding-bottom: 8px; }
  h2 { color: ${colorPrimario}; margin-top: 30px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: ${colorPrimario}; color: white; padding: 8px 12px; text-align: left; }
  td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
  .status { font-size: 18px; font-weight: bold; color: ${progresoColor}; }
  .meta { color: #6b7280; font-size: 13px; }
  .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px; color: #6b7280; font-size: 12px; }
</style>
</head>
<body>
<h1>${brand.encabezado_pdf || 'Credit Report Comparison'}</h1>
<p class="meta">Client: <strong>${co.nombre_completo}</strong> &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString('en-US')}</p>

<p class="status">${progresoLabel}</p>
<p>${co.resumen_cambios || ''}</p>

<h2>Details</h2>
<table>
  <tr><th>Metric</th><th>Base Report</th><th>Compared Report</th><th>Change</th></tr>
  <tr><td>Errors Detected</td><td>${resultado.errores_base ?? '—'}</td><td>${resultado.errores_comparado ?? '—'}</td><td>${resultado.errores_eliminados > 0 ? '-' + resultado.errores_eliminados + ' ✓' : resultado.errores_nuevos > 0 ? '+' + resultado.errores_nuevos : '—'}</td></tr>
  <tr><td>Negative Accounts</td><td>${resultado.cuentas_negativas_base ?? '—'}</td><td>${resultado.cuentas_negativas_comparado ?? '—'}</td><td>${(resultado.cuentas_negativas_base ?? 0) - (resultado.cuentas_negativas_comparado ?? 0) > 0 ? '-' + ((resultado.cuentas_negativas_base ?? 0) - (resultado.cuentas_negativas_comparado ?? 0)) + ' ✓' : '—'}</td></tr>
  <tr><td>Overall Status</td><td>${resultado.estado_base || '—'}</td><td>${resultado.estado_comparado || '—'}</td><td>—</td></tr>
</table>

<div class="footer">${brand.pie_pagina_pdf || ''} &nbsp;|&nbsp; Generated by Credit Repair AI Suite</div>
</body>
</html>`

    res.json({ data: { html, filename: `comparacion_${co.nombre_completo.replace(/\s+/g, '_')}.html` }, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
