import fs from 'fs'

const buildFile = JSON.parse(fs.readFileSync('build.json', 'utf8'))

export default buildFile
