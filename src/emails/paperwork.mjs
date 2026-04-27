import config from '../config'

/**
 * Get a paperwork edit link
 * @param {string} rescueId rescue ID
 * @returns {string} paperwork edit link
 */
function getPaperworkLink (rescueId) {
  return `${config.frontend.url}/paperwork/${rescueId}/edit`
}

/**
 * Paperwork reminder email template
 * @param {object} arg function arguments object
 * @param {User} arg.user the user to send the email to
 * @param {Array} arg.rescues array of unfiled rescues
 * @returns {object} paperwork reminder email template
 */
export default function paperworkReminderEmail ({ user, rescues, displayName }) {
  const rescueList = rescues.map((rescue) => {
    const hoursAgo = Math.round((Date.now() - new Date(rescue.updatedAt).getTime()) / (1000 * 60 * 60))
    return {
      client: rescue.client,
      system: rescue.system || 'Unknown system',
      platform: rescue.platform || '?',
      hoursAgo,
      timeLabel: hoursAgo < 24 ? `${hoursAgo} hours ago` : `${Math.round(hoursAgo / 24)} days ago`,
      link: getPaperworkLink(rescue.id),
    }
  })

  // Pre-format for plain text template
  const rescueListText = rescueList.map((r) => {
    return `  • ${r.client} — ${r.system} (${r.platform.toUpperCase()}) — ${r.timeLabel}\n    ${r.link}`
  }).join('\n')

  return {
    to: user.email,
    subject: `Fuel Rats — You have ${rescues.length} unfiled paperwork${rescues.length === 1 ? '' : 's'}`,
    template: 'paperwork',
    params: {
      name: displayName || user.email,
      rescueCount: rescues.length,
      rescues: rescueList,
      rescueList: rescueListText,
    },
  }
}
