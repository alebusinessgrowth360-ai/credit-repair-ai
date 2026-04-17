import { Pool, PoolClient } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default pool

/**
 * Ejecuta un bloque de queries dentro de una transacción con el contexto
 * del usuario establecido. Requerido para que las políticas RLS funcionen.
 *
 * Uso:
 *   const result = await withUserContext(usuarioId, async (client) => {
 *     return client.query('SELECT * FROM clientes WHERE usuario_id = $1', [usuarioId])
 *   })
 */
export async function withUserContext<T>(
  usuarioId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL app.current_user_id = '${usuarioId.replace(/'/g, "''")}'`)
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
