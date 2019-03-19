'use strict'

const Axios = require('axios')
const config = require('../../config.js')
const axiosHttpAdapter = require('axios/lib/adapters/http')
const { Validator } = require('jsonapi-validator')
const Ajv = require('ajv')

const rescueSchema = require('../../schema/rescue')

const ajv = new Ajv()
const rescueValidate = ajv.compile(rescueSchema)
const validator = new Validator()


const axios = Axios.create({
  baseURL: config.externalUrl,
  timeout: 5000,
  headers: {
    common: {
      'authorization': `Bearer ${config.testing.token}`
    }
  }
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
