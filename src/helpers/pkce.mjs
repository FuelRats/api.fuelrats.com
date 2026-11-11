import crypto from 'crypto'

/** The only PKCE code challenge method the API accepts (RFC 7636 section 4.2) */
export const pkceMethodS256 = 'S256'

// RFC 7636 section 4.1: 43 to 128 characters of [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
const codeVerifierPattern = /^[A-Za-z0-9._~-]{43,128}$/u

// An S256 challenge is the unpadded base64url encoding of a 32-byte SHA-256 digest: 43 characters
const s256ChallengePattern = /^[A-Za-z0-9_-]{43}$/u

/**
 * Check whether a value is a well-formed S256 code challenge
 * @param {*} challenge the code_challenge request parameter
 * @returns {boolean} true if the value is a 43 character base64url string
 */
export function isValidS256Challenge (challenge) {
  return typeof challenge === 'string' && s256ChallengePattern.test(challenge)
}

/**
 * Compute the S256 code challenge for a code verifier: BASE64URL(SHA256(ASCII(code_verifier)))
 * @param {string} verifier the code verifier
 * @returns {string} the unpadded base64url encoded SHA-256 digest of the verifier
 */
export function computeS256Challenge (verifier) {
  return crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url')
}

/**
 * Verify a PKCE code verifier against the challenge stored with an authorization code
 * @param {object} arg function arguments object
 * @param {*} arg.verifier the code_verifier presented at the token endpoint
 * @param {string} arg.challenge the code challenge stored with the authorization code
 * @param {string} arg.method the code challenge method stored with the authorization code
 * @returns {boolean} true only if the method is S256, the verifier is well-formed and it hashes to the challenge
 */
export function verifyCodeVerifier ({ verifier, challenge, method }) {
  if (method !== pkceMethodS256 || !isValidS256Challenge(challenge)) {
    return false
  }

  if (typeof verifier !== 'string' || !codeVerifierPattern.test(verifier)) {
    return false
  }

  const expected = Buffer.from(computeS256Challenge(verifier), 'ascii')
  const actual = Buffer.from(challenge, 'ascii')
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}
