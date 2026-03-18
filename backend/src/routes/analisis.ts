import { Router, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { analizarReporte } from '../services/ia/analizar'
import pdfParse from 'pdf-parse'

const router = Router()
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// POST /analizar/:reporte_id — analizar PDF con IA
router.post('/:reporte_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { reporte_id } = req.params
  const usuarioId = req.usuario!.id

  try {
    // 1. Verificar que el reporte existe y pertenece al usuario
    const { data: reporte, error: errorReporte } = await supabase
      .from('reportes_credito')
      .select('*, clientes!inner(usuario_id)')
      .eq('id', reporte_id)
      .single()

    if (errorReporte || !reporte) {
      return res.status(404).json({ error: 'Reporte no encontrado' })
    }

    if (reporte.clientes.usuario_id !== usuarioId) {
      return res.status(403).json({ error: 'Sin acceso a este reporte' })
    }

    // 2. Verificar que la API Key de IA está configurada y activa
    const { data: configIA } = await supabase
      .from('configuracion_ia')
      .select('estado_conexion')
      .eq('usuario_id', usuarioId)
      .single()

    if (!configIA || configIA.estado_conexion !== 'activo') {
      return res.status(400).json({
        error: 'API Key de IA no configurada o no validada. Configúrala antes de analizar.'
      })
    }

    // 3. Descargar el PDF desde Supabase Storage
    const { data: archivo, error: errorArchivo } = await supabase
      .storage
      .from('reportes-pdf')
      .download(reporte.ruta_archivo)

    if (errorArchivo || !archivo) {
      return res.status(500).json({ error: 'No se pudo descargar el PDF' })
    }

    // 4. Extraer texto del PDF
    const buffer = Buffer.from(await archivo.arrayBuffer())
    const pdfData = await pdfParse(buffer)
    const textoPdf = pdfData.text

    if (!textoPdf || textoPdf.trim().length < 100) {
      return res.status(400).json({ error: 'El PDF no contiene texto extraíble' })
    }

    // 5. Enviar a IA y guardar resultado
    const analisis = await analizarReporte(textoPdf, usuarioId, reporte_id)

    res.json({ data: analisis, error: null })

  } catch (err: any) {
    console.error('[/analizar]', err.message)
    res.status(500).json({ error: err.message || 'Error al analizar el reporte' })
  }
})

// GET /analizar/:reporte_id — obtener análisis existente
router.get('/:reporte_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { reporte_id } = req.params

  const { data, error } = await supabase
    .from('analisis_reportes')
    .select('*')
    .eq('reporte_id', reporte_id)
    .single()

  if (error) return res.status(404).json({ error: 'Análisis no encontrado' })

  res.json({ data, error: null })
})

export default router
