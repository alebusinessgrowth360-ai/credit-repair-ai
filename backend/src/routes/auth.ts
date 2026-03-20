import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const router = Router()
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '')

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + process.env.SECRET_KEY || 'secret').digest('hex')
}

function generateToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ id: userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64')
  return payload
}

router.post('/register', async (req: Request, res: Response) => {
  const { nombre, email, password } = req.body
  if (!nombre || !email || !password) return res.status(400).json({ error: 'Faltan campos' })
  try {
    const { data: existe } = await supabase.from('usuarios').select('id').eq('email', email).single()
    if (existe) return res.status(400).json({ error: 'El email ya está registrado' })
    const { data, error } = await supabase.from('usuarios').insert({ nombre, email, password_hash: hashPassword(password) }).select().single()
    if (error) throw new Error(error.message)
    res.status(201).json({ data: { token: generateToken(data.id), usuario: { id: data.id, nombre: data.nombre, email: data.email } }, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos' })
  try {
    const { data, error } = await supabase.from('usuarios').select('*').eq('email', email).eq('password_hash', hashPassword(password)).single()
    if (error || !data) return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    res.json({ data: { token: generateToken(data.id), usuario: { id: data.id, nombre: data.nombre, email: data.email } }, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/me', async (req: Request, res: Response) => {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'Sin token' })
  try {
    const payload = JSON.parse(Buffer.from(auth.replace('Bearer ', ''), 'base64').toString())
    if (payload.exp < Date.now()) return res.status(401).json({ error: 'Token expirado' })
    const { data } = await supabase.from('usuarios').select('id, nombre, email, rol').eq('id', payload.id).single()
    res.json({ data, error: null })
  } catch {
    res.status(401).json({ error: 'Token inválido' })
  }
})

export default router
