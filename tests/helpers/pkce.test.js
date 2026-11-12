/* global describe, it, expect */
import {
  computeS256Challenge,
  isValidS256Challenge,
  pkceMethodS256,
  verifyCodeVerifier,
} from '../../src/helpers/pkce'

// RFC 7636 appendix B test vector
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'

describe('computeS256Challenge', () => {
  it('matches the RFC 7636 appendix B vector', () => {
    expect(computeS256Challenge(RFC_VERIFIER)).toBe(RFC_CHALLENGE)
  })
})

describe('isValidS256Challenge', () => {
  it('accepts a 43 character base64url challenge', () => {
    expect(isValidS256Challenge(RFC_CHALLENGE)).toBe(true)
  })

  it('rejects padding, wrong lengths, non-base64url characters and non-strings', () => {
    expect(isValidS256Challenge(`${RFC_CHALLENGE}=`)).toBe(false)
    expect(isValidS256Challenge(RFC_CHALLENGE.slice(1))).toBe(false)
    expect(isValidS256Challenge(`${RFC_CHALLENGE.slice(1)}+`)).toBe(false)
    expect(isValidS256Challenge('')).toBe(false)
    expect(isValidS256Challenge(undefined)).toBe(false)
    expect(isValidS256Challenge([RFC_CHALLENGE])).toBe(false)
  })
})

describe('verifyCodeVerifier', () => {
  const stored = { challenge: RFC_CHALLENGE, method: pkceMethodS256 }

  it('accepts the verifier that hashes to the stored challenge', () => {
    expect(verifyCodeVerifier({ ...stored, verifier: RFC_VERIFIER })).toBe(true)
  })

  it('rejects a different well-formed verifier', () => {
    const otherVerifier = `${RFC_VERIFIER.slice(0, -1)}A`
    expect(verifyCodeVerifier({ ...stored, verifier: otherVerifier })).toBe(false)
  })

  it('rejects a missing or non-string verifier', () => {
    expect(verifyCodeVerifier({ ...stored, verifier: undefined })).toBe(false)
    expect(verifyCodeVerifier({ ...stored, verifier: '' })).toBe(false)
    expect(verifyCodeVerifier({ ...stored, verifier: [RFC_VERIFIER] })).toBe(false)
  })

  it('rejects verifiers outside the RFC 7636 length and character rules', () => {
    expect(verifyCodeVerifier({ ...stored, verifier: RFC_VERIFIER.slice(0, 42) })).toBe(false)
    expect(verifyCodeVerifier({ ...stored, verifier: 'a'.repeat(129) })).toBe(false)
    expect(verifyCodeVerifier({ ...stored, verifier: `${RFC_VERIFIER.slice(0, -1)}+` })).toBe(false)
  })

  it('rejects the plain method, even when the verifier equals the challenge', () => {
    expect(verifyCodeVerifier({ challenge: RFC_CHALLENGE, method: 'plain', verifier: RFC_CHALLENGE })).toBe(false)
  })

  it('rejects a code without a stored challenge', () => {
    expect(verifyCodeVerifier({ challenge: null, method: null, verifier: RFC_VERIFIER })).toBe(false)
  })
})
