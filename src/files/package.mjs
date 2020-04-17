import fs from 'fs'

const packageFile = JSON.parse(fs.readFileSync('package.json', 'utf8'))

export default packageFile

