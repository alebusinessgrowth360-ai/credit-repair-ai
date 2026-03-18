import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Obtener y desencriptar la API Key del usuario
async function getApiKey(usuarioId: string): Promise<string> {
  const { data, error } = await supabase
    .from('configuracion_ia')
    .select('api_key_encriptada, estado_conexion')
    .eq('usuario_id', usuarioId)
    .single()

  if (error || !data) throw new Error('API Key no configurada')
  if (data.estado_conexion !== 'activo') throw new Error('API Key no validada')

  // Desencriptar (la encriptación se hace al guardar con pgcrypto en Supabase)
  return data.api_key_encriptada
}

const PROMPT_ANALISIS = `Analiza el reporte de crédito proporcionado. 
Extrae datos personales, cuentas, inquiries, colecciones, charge-offs, balances, fechas y observaciones.
Detecta: nombres mal escritos, direcciones incorrectas, cuentas duplicadas, cuentas no reconocidas, 
balances incorrectos, pagos tardíos inconsistentes, colecciones duplicadas e inquiries no autorizadas.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "resumen_general": {
    "total_cuentas": 0,
    "cuentas_positivas": 0,
    "cuentas_negativas": 0,
    "collections": 0,
    "charge_offs": 0,
    "hard_inquiries": 0,
    "estado_general": "riesgo_bajo|riesgo_medio|riesgo_alto"
  },
  "datos_personales": {
    "nombre_completo": "",
    "variaciones_nombre": [],
    "direcciones_actuales": [],
    "direcciones_anteriores": [],
    "empleadores": []
  },
  "cuentas": [],
  "inquiries": [],
  "errores_detectados": [
    {
      "tipo": "",
      "descripcion": "",
      "cuenta": "",
      "buro": "",
      "prioridad": "alta|media|baja"
    }
  ],
  "recomendaciones": [
    {
      "tipo": "",
      "descripcion": "",
      "ley_aplicable": "FCRA|FDCPA|FACTA",
      "prioridad": 1
    }
  ]
}

No generes cartas. Solo el análisis estructurado.
Las recomendaciones deben estar en español, ser claras y comprensibles para usuarios no expertos.`

export async function analizarReporte(
  contenidoPdf: string,
  usuarioId: string,
  reporteId: string
): Promise<any> {
  const apiKey = await getApiKey(usuarioId)
  const openai = new OpenAI({ apiKey })

  const inicio = Date.now()
  let tokensEntrada = 0
  let tokensSalida = 0
  let estadoLog = 'ok'
  let mensajeError = null

  try {
    const respuesta = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PROMPT_ANALISIS },
        { role: 'user', content: `Reporte de crédito:\n\n${contenidoPdf}` }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })

    tokensEntrada = respuesta.usage?.prompt_tokens || 0
    tokensSalida = respuesta.usage?.completion_tokens || 0

    const contenido = respuesta.choices[0].message.content
    if (!contenido) throw new Error('Respuesta vacía de la IA')

    const analisis = JSON.parse(contenido)

    // Guardar análisis en la DB
    const { data, error } = await supabase
      .from('analisis_reportes')
      .upsert({
        reporte_id: reporteId,
        resumen_general: analisis.resumen_general,
        datos_personales: analisis.datos_personales,
        cuentas: analisis.cuentas,
        inquiries: analisis.inquiries,
        errores_detectados: analisis.errores_detectados,
        recomendaciones: analisis.recomendaciones,
        estado_general: analisis.resumen_general.estado_general
      })
      .select()
      .single()

    if (error) throw new Error(`Error guardando análisis: ${error.message}`)

    return data

  } catch (err: any) {
    estadoLog = 'error'
    mensajeError = err.message
    throw err

  } finally {
    // Registrar consumo en logs_ia
    await supabase.from('logs_ia').insert({
      usuario_id: usuarioId,
      tipo_operacion: 'analisis_reporte',
      modelo: 'gpt-4o',
      tokens_entrada: tokensEntrada,
      tokens_salida: tokensSalida,
      estado: estadoLog,
      mensaje_error: mensajeError
    })
  }
}

const PROMPT_CARTA = `Redacta una carta profesional de disputa en español usando la información proporcionada.
La carta debe ser clara, formal, personalizada y lista para exportar en PDF.
Incluye: fecha, destinatario, detalle del problema, solicitud formal de investigación o corrección, 
referencia a la ley aplicable y cierre profesional.
Responde SOLO con el texto de la carta, sin explicaciones adicionales.`

export async function generarCarta(
  datosCliente: any,
  tipoCarta: string,
  errorDetectado: any,
  ley: string,
  usuarioId: string
): Promise<string> {
  const apiKey = await getApiKey(usuarioId)
  const openai = new OpenAI({ apiKey })

  const prompt = `
Cliente: ${datosCliente.nombre_completo}
Dirección: ${datosCliente.direccion}, ${datosCliente.ciudad}, ${datosCliente.estado} ${datosCliente.zip}
Tipo de carta: ${tipoCarta}
Error a disputar: ${JSON.stringify(errorDetectado)}
Ley aplicable: ${ley}
Fecha: ${new Date().toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric' })}
`

  const respuesta = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: PROMPT_CARTA },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3
  })

  const contenido = respuesta.choices[0].message.content
  if (!contenido) throw new Error('Respuesta vacía al generar carta')

  // Log de consumo
  await supabase.from('logs_ia').insert({
    usuario_id: usuarioId,
    tipo_operacion: 'generacion_carta',
    modelo: 'gpt-4o',
    tokens_entrada: respuesta.usage?.prompt_tokens || 0,
    tokens_salida: respuesta.usage?.completion_tokens || 0,
    estado: 'ok'
  })

  return contenido
}
