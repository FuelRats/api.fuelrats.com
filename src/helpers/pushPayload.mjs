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
 * Format matches SwiftSqueak's social media post style:
 *   "PC (Odyssey) rats needed near Sol! Case #5"
 *   "Xbox rats needed for a CODE RED rescue, location unknown!"
 * @param {object} rescue the Rescue model instance
 * @returns {object} notification payload ready for JSON.stringify + showNotification
 */
export function buildRescuePayload (rescue) {
  const platformLabel = platformLabels[rescue.platform] || 'Unknown'
  const expansionLabel = expansionLabels[rescue.expansion] || ''

  // Build platform string: "PC (Odyssey)" or just "Xbox"
  let platformStr = platformLabel
  if (rescue.platform === 'pc' && expansionLabel) {
    platformStr = `${platformLabel} (${expansionLabel})`
  }

  // Build body in Mecha's style
  let body = `${platformStr} rats needed`
  if (rescue.codeRed) {
    body += ' for a CODE RED rescue'
  }
  if (rescue.carrier) {
    body += rescue.codeRed ? ' (Fleet Carrier)' : ' for a Fleet Carrier rescue'
  }
  if (rescue.system) {
    body += ` in ${rescue.system}`
  } else {
    body += ', location unknown'
  }
  body += '!'

  // Title is short — just the alert type
  let title = 'Fuel Rats Rescue'
  if (rescue.codeRed) {
    title = 'CODE RED'
  }

  const shortId = rescue.id.slice(-10)

  return {
    type: 'rescue.alert',
    title,
    body,
    tag: `rescue-${rescue.id}`,
    icon: rescue.codeRed ? '/static/icons/codered.png' : '/static/icons/rescue.png',
    data: {
      rescueId: rescue.id,
      shortId,
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
