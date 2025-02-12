import { customAlphabet } from 'nanoid'

const tokenCharset = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

const clientSecretLength = 32
const clientSecretGenerator = customAlphabet(tokenCharset, clientSecretLength)

const sessionTokenLength = 6
const sessionTokenGenerator = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', sessionTokenLength)

const oauthTokenLength = 32
const oAuthTokenGenerator = customAlphabet(tokenCharset, oauthTokenLength)

const resetTokenLength = 32
const resetTokenGenerator = customAlphabet(tokenCharset, resetTokenLength)

const verificationTokenLength = 32
const verificationTokenGenerator = customAlphabet(tokenCharset, verificationTokenLength)

const transactionTokenLength = 32
const transactionGenerator = customAlphabet(tokenCharset, transactionTokenLength)

export {
  clientSecretGenerator,
  sessionTokenGenerator,
  oAuthTokenGenerator,
  resetTokenGenerator,
  verificationTokenGenerator,
  transactionGenerator,
}
