import fs from 'fs'

const permissionFile = JSON.parse(fs.readFileSync('permissions.json', 'utf8'))

export default permissionFile
