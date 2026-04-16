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
 * @param {object} rescue the Rescue model instance
 * @returns {object} notification payload ready for JSON.stringify + showNotification
 */
export function buildRescuePayload (rescue) {
  const platformLabel = platformLabels[rescue.platform] || 'Unknown platform'
  const expansionLabel = expansionLabels[rescue.expansion] || ''

  const lines = [
    `Client: ${rescue.client || 'Unknown'}`,
    rescue.system ? `System: ${rescue.system}` : null,
    expansionLabel ? `Expansion: ${expansionLabel}` : null,
  ].filter(Boolean)

  let title = 'Rescue alert'
  if (rescue.codeRed) {
    title = `CODE RED — ${platformLabel}`
  } else {
    title = `Rescue — ${platformLabel}`
  }
  if (rescue.carrier) {
    title += ' (Fleet Carrier)'
  }

  return {
    type: 'rescue.alert',
    title,
    body: lines.join('\n'),
    tag: `rescue-${rescue.id}`,
    icon: rescue.codeRed ? '/static/icons/codered.png' : '/static/icons/rescue.png',
    data: {
      rescueId: rescue.id,
      platform: rescue.platform,
      expansion: rescue.expansion,
      codeRed: rescue.codeRed,
      carrier: rescue.carrier,
      url: `/rescue/${rescue.id}`,
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
