import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export interface AuthRequest extends Request {
  usuario?: { id: string; email: string; rol: string }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido o expirado' })
    }

    // Obtener perfil y rol
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('id, email, rol')
      .eq('id', user.id)
      .single()

    req.usuario = {
      id: user.id,
      email: user.email!,
      rol: perfil?.rol || 'consultor'
    }

    next()
  } catch (err) {
    return res.status(401).json({ error: 'Error de autenticación' })
  }
}
