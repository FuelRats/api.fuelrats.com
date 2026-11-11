/* global describe, it, expect */
import { mintSaslToken, saslTokenLifetimeSeconds } from '../../src/helpers/saslToken'

// Fixed vector, cross-checked with openssl:
//   printf '%s' 'Jameson|1762819200' | openssl dgst -sha256 -hmac 'kiwi-sasl-token-test-vector-secret-0001'
//   SHA2-256(stdin)= bf67d337a97866969503cc2cad1a19a9ac66b2294188ef244ba93c214c63bbef
const VECTOR_SECRET = 'kiwi-sasl-token-test-vector-secret-0001' // gitleaks:allow (test fixture)
const VECTOR_ACCOUNT = 'Jameson'
const VECTOR_TS = 1762819200
const VECTOR_MAC = 'bf67d337a97866969503cc2cad1a19a9ac66b2294188ef244ba93c214c63bbef'

describe('mintSaslToken', () => {
  it('matches the openssl HMAC-SHA256 vector', () => {
    expect(mintSaslToken(VECTOR_SECRET, VECTOR_ACCOUNT, VECTOR_TS)).toBe(`frk1:${VECTOR_TS}:${VECTOR_MAC}`)
  })

  it('has the shape the groupsync module parses: decimal seconds and 64 lowercase hex', () => {
    expect(mintSaslToken(VECTOR_SECRET, VECTOR_ACCOUNT, VECTOR_TS)).toMatch(/^frk1:\d+:[0-9a-f]{64}$/u)
  })

  it('binds the account exactly as given, including its case', () => {
    const token = mintSaslToken(VECTOR_SECRET, VECTOR_ACCOUNT.toLowerCase(), VECTOR_TS)
    expect(token).not.toBe(`frk1:${VECTOR_TS}:${VECTOR_MAC}`)
  })

  it('binds the timestamp and the secret', () => {
    const vector = `frk1:${VECTOR_TS}:${VECTOR_MAC}`
    expect(mintSaslToken(VECTOR_SECRET, VECTOR_ACCOUNT, VECTOR_TS + 1).endsWith(VECTOR_MAC)).toBe(false)
    expect(mintSaslToken(`${VECTOR_SECRET}x`, VECTOR_ACCOUNT, VECTOR_TS)).not.toBe(vector)
  })
})

describe('saslTokenLifetimeSeconds', () => {
  it('matches the groupsync module maximum of 60 seconds', () => {
    expect(saslTokenLifetimeSeconds).toBe(60)
  })
})
