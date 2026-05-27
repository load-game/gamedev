import crypto from 'crypto'

/**
 *
 * Hash File
 *
 * takes a file and generates a sha256 unique hash.
 * carefully does this the same way as the client function.
 *
 */

export async function hashFile(file) {
  const hash = crypto.createHash('sha256')
  hash.update(file)
  return hash.digest('hex')
}
