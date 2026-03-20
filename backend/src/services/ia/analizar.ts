export async function analizarReporte(texto: string, usuarioId: string, reporteId: string): Promise<any> {
  return { mensaje: 'Análisis con IA disponible próximamente' }
}

export async function generarCarta(cliente: any, tipo: string, error: any, ley: string, usuarioId: string): Promise<string> {
  return `Carta de disputa - ${tipo} - ${ley}`
}
