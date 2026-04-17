import { spawn } from 'child_process'
import crypto from 'crypto'

const MAX_RAT_NAME_LENGTH = 64

/**
 * Validate and sanitize rat name for certificate generation
 * @param {string} ratName name to validate
 * @returns {string} sanitized name
 */
function validateRatName (ratName) {
  if (!ratName || typeof ratName !== 'string') {
    throw new Error('Rat name must be a non-empty string')
  }

  const sanitized = ratName.replace(/[^a-zA-Z0-9_-]/gu, '').slice(0, MAX_RAT_NAME_LENGTH)

  if (sanitized.length === 0) {
    throw new Error('Rat name contains no valid characters')
  }

  return sanitized
}

/**
 * Generate SSL certificate for a rat
 * @param {string} ratName name of the rat
 * @returns {Promise<{certificate: string, fingerprint: string}>}
 */
function generateSslCertificate (ratName) {
  return new Promise((resolve, reject) => {
    try {
      const sanitizedRatName = validateRatName(ratName)

      // Use openssl with separate key output to avoid stdout conflicts
      const opensslArgs = [
        'req', '-new', '-newkey', 'rsa:4096', '-days', '3650',
        '-nodes', '-x509',
        '-keyout', '/tmp/key.pem',
        '-subj',
        `/C=US/ST=Generic/L=Generic/O=FuelRats/CN=${sanitizedRatName}@fuelrats.com`,
      ]

      const opensslProcess = spawn('openssl', opensslArgs, {
        stdio: ['pipe', 'pipe', 'ignore'],
        shell: false,
      })

      let certPem = ''

      opensslProcess.stdout.on('data', (data) => {
        certPem += data.toString()
      })

      opensslProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`OpenSSL exited with code ${code}`))
          return
        }

        try {
          const fs = require('fs')
          const keyPem = fs.readFileSync('/tmp/key.pem', 'utf8')
          fs.unlinkSync('/tmp/key.pem')

          const certificate = keyPem + certPem

          const cert = new crypto.X509Certificate(certPem)
          const fingerprint = crypto
            .createHash('sha256')
            .update(cert.raw)
            .digest('hex')
            .toLowerCase()

          resolve({ certificate, fingerprint })
        } catch (error) {
          reject(error)
        }
      })

      opensslProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn OpenSSL: ${error.message}`))
      })
    } catch (error) {
      reject(error)
    }
  })
}

self.onmessage = async (event) => {
  const { id, ratName } = event.data
  try {
    const result = await generateSslCertificate(ratName)
    postMessage({ id, result })
  } catch (error) {
    postMessage({ id, error: error.message })
  }
}
