'use strict'

const Ajv = require('ajv')
const Axios = require('axios')
const axiosHttpAdapter = require('axios/lib/adapters/http')
const { Validator } = require('jsonapi-validator')

const rescueSchema = require('../../schema/rescue.json')
const config = require('../../src/config')

const ajv = new Ajv()
const rescueValidate = ajv.compile(rescueSchema)
const validator = new Validator()


const axios = Axios.create({
  baseURL: config.externalUrl,
  timeout: 5000,
  headers: {
    common: {
      authorization: `Bearer ${config.testing.token}`,
    },
  },
})

axios.defaults.adapter = axiosHttpAdapter

describe('GET /rescues', () => {
  it('Should load first page of rescues', async () => {
    const response = await axios.get('/rescues')
    expect(validator.isValid(response.data)).toBeTruthy()

    response.data.data.forEach((rescue) => {
      expect(rescueValidate(rescue)).toBeTruthy()
    })
  })
})
