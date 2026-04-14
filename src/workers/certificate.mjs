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

      const opensslArgs = [
        'req', '-new', '-newkey', 'rsa:4096', '-days', '3650',
        '-nodes', '-x509', '-subj',
        `/C=US/ST=Generic/L=Generic/O=FuelRats/CN=${sanitizedRatName}@fuelrats.com`,
      ]

      const opensslProcess = spawn('openssl', opensslArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      })

      let certOutput = ''
      let certError = ''

      opensslProcess.stdout.on('data', (data) => {
        certOutput += data.toString()
      })

      opensslProcess.stderr.on('data', (data) => {
        certError += data.toString()
      })

      opensslProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`OpenSSL failed: ${certError}`))
          return
        }

        try {
          const certBeginIndex = certOutput.indexOf('-----BEGIN PRIVATE KEY-----')
          if (certBeginIndex === -1) {
            reject(new Error('No private key found in certificate output'))
            return
          }

          const certificate = certOutput.substring(certBeginIndex)

          const x509BeginIndex = certOutput.indexOf('-----BEGIN CERTIFICATE-----')
          const x509EndIndex = certOutput.indexOf('-----END CERTIFICATE-----')

          if (x509BeginIndex === -1 || x509EndIndex === -1) {
            reject(new Error('No X.509 certificate found in output'))
            return
          }

          const certPem = certOutput.substring(x509BeginIndex, x509EndIndex + '-----END CERTIFICATE-----'.length)

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
