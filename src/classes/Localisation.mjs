import fs from 'fs'
import i18next from 'i18next'

const localisationFile = JSON.parse(fs.readFileSync('localisations.json', 'utf8'))

// noinspection JSIgnoredPromiseFromCall
i18next.init({
  lng: 'en',
  resources: localisationFile,
})

export default i18next

