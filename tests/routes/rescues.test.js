/* global describe, it, expect */
'use strict'

const Axios = require('axios')

// Integration test for the rescue endpoints against the docker-compose mirror.
const BASE = process.env.FRAPI_TEST_URL ?? 'http://localhost:8080'

const client = Axios.create({ baseURL: BASE, timeout: 5000, validateStatus: () => true })

describe('GET /rescues/me', () => {
  it('returns 401 without authentication', async () => {
    const response = await client.get('/rescues/me')
    expect(response.status).toBe(401)
    expect(response.data.errors[0].status).toBe('unauthorized')
  })
})
