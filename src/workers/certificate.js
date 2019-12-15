/* eslint-disable */
import workerpool from 'workerpool'
import { exec } from 'child_process'

/**
 * Generate SSL certificate for a rat
 * @param {string} ratName name of the rat
 * @returns {Promise<{certificate,fingerprint}>}
 */
function generateSslCertificate (ratName) {
  return new Promise((resolve, reject) => {
    exec(`openssl req -new -newkey rsa:4096 -days 3650 -nodes -x509 -subj \\
    "/C=US/ST=something/L=Generic/O=FuelRats/CN="${ratName}"@fuelrats.com"`, (err, certStdout) => {
      if (err) {
        return reject(err)
      }

      const certBeginIndex = certStdout.indexOf('-----BEGIN PRIVATE KEY-----')
      const certificate = certStdout.substring(certBeginIndex)


      // noinspection SpellCheckingInspection
      exec(`echo "${certificate}" | openssl x509 -sha256 -noout -fingerprint \\
      | sed -e 's/^.*=//;s/://g;y/ABCDEF/abcdef/'`,
      (fpErr, fpStdout) => {
        if (fpErr) {
          return reject(fpErr)
        }

        const fingerprint = fpStdout.trim()

        return resolve({
          certificate,
          fingerprint
        })
      })
    })
  })
}

workerpool.worker({
  generateSslCertificate
})

