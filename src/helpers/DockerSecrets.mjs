import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import logger from '../logging'

const DOCKER_SECRETS_PATH = '/run/secrets'

/**
 * Read a Docker secret from the filesystem
 * @param {string} secretName - The name of the Docker secret
 * @returns {string|undefined} - The secret value or undefined if not found
 */
export function readDockerSecret (secretName) {
  const secretPath = join(DOCKER_SECRETS_PATH, secretName)
  
  if (!existsSync(secretPath)) {
    return undefined
  }
  
  try {
    return readFileSync(secretPath, 'utf8').trim()
  } catch (error) {
    logger.warn({
      GELF: true,
      _event: 'docker_secret_read_failed',
      _secret_name: secretName,
      _error_message: error.message,
    }, `Failed to read Docker secret "${secretName}": ${error.message}`)
    return undefined
  }
}