import getSystemDescription from './systemDescription'

const platformLabels = {
  pc: 'PC',
  xb: 'Xbox',
  ps: 'PlayStation',
}

const expansionLabels = {
  horizons3: 'Horizons 3.8',
  horizons4: 'Horizons 4',
  odyssey: 'Odyssey',
}

/**
 * Build a structured push notification payload for a rescue alert.
 *
 * Title:  "CODE RED — PC (Odyssey)" or "Rescue — Xbox"
 * Body:   "NLTT 48288 · ~90LY from Sol" or "Location unknown"
 *
 * @param {object} rescue the Rescue model instance
 * @returns {Promise<object>} notification payload ready for showNotification
 */
export async function buildRescuePayload (rescue) {
  const platformLabel = platformLabels[rescue.platform] || 'Unknown'
  const expansionLabel = expansionLabels[rescue.expansion] || ''

  // Title: "CODE RED — PC (Odyssey) · Fleet Carrier"
  const titleParts = []
  titleParts.push(rescue.codeRed ? 'CODE RED' : 'Rescue')

  let platformStr = platformLabel
  if (rescue.platform === 'pc' && expansionLabel) {
    platformStr = `${platformLabel} (${expansionLabel})`
  }
  titleParts.push(platformStr)

  if (rescue.carrier) {
    titleParts.push('Fleet Carrier')
  }

  const title = titleParts.join(' — ')

  // Body: "NLTT 48288 · ~90LY from Sol"
  const bodyParts = []
  if (rescue.system) {
    bodyParts.push(rescue.system)
    const systemDesc = await getSystemDescription(rescue.system).catch(() => { return null })
    if (systemDesc) {
      bodyParts.push(systemDesc)
    }
  } else {
    bodyParts.push('Location unknown')
  }

  const body = bodyParts.join(' · ')

  return {
    type: 'rescue.alert',
    title,
    body,
    tag: `rescue-${rescue.id}`,
    icon: rescue.codeRed ? '/static/icons/codered.png' : '/static/icons/rescue.png',
    data: {
      rescueId: rescue.id,
      shortId: rescue.id.slice(-10),
      platform: rescue.platform,
      expansion: rescue.expansion,
      codeRed: rescue.codeRed,
      carrier: rescue.carrier,
      system: rescue.system,
      client: rescue.client,
      url: `/paperwork/${rescue.id}`,
    },
  }
}

/**
 * Build a structured broadcast notification payload.
 * @param {object} arg function arguments object
 * @param {string} arg.title notification title (required)
 * @param {string} arg.body notification body (required)
 * @param {string} [arg.icon] optional icon URL
 * @param {string} [arg.tag] optional tag for replacing/grouping
 * @param {object} [arg.data] optional extra data
 * @param {string} [arg.type] optional type discriminator (default: 'broadcast')
 * @returns {object} notification payload
 */
export function buildBroadcastPayload ({ title, body, icon, tag, data, type }) {
  return {
    type: type || 'broadcast',
    title,
    body,
    tag,
    icon,
    data: data || {},
  }
}
