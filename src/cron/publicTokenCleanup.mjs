import { Op } from 'sequelize'
import { Client, Token } from '../db'
import { publicTokenPruneCutoff, publicTokenRetentionDays } from '../helpers/tokenExpiry'
import logger, { logMetric } from '../logging'

// Tokens issued to public OAuth clients expire after a few hours, but the row stays: the authorize
// endpoint treats an existing token row as the user's consent for that client. A row is deleted only
// once its expiry is publicTokenRetentionDays in the past, so returning users are not asked to
// consent again every day.

const CLEANUP_HOUR_UTC = 4
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Delete tokens of public OAuth clients whose expiry is older than the retention window
 * @param {Date} [now] the time the cleanup runs
 * @returns {Promise<number>} the number of deleted token rows
 */
export async function prunePublicTokens (now = new Date()) {
  const publicClients = await Client.findAll({
    attributes: ['id'],
    where: { public: true },
  })
  if (publicClients.length === 0) {
    return 0
  }

  return Token.destroy({
    where: {
      clientId: { [Op.in]: publicClients.map((client) => client.id) },
      expiresAt: { [Op.lt]: publicTokenPruneCutoff(now) },
    },
  })
}

/**
 * Run one cleanup pass, logging the result instead of throwing
 * @returns {Promise<void>} resolves when the pass is done
 */
export async function runPublicTokenCleanup () {
  try {
    const deleted = await prunePublicTokens()
    logMetric('public_token_cleanup', {
      _deleted: deleted,
      _retention_days: publicTokenRetentionDays,
    }, `Public client token cleanup deleted ${deleted} tokens`)
  } catch (error) {
    logger.error(`Public client token cleanup failed: ${error.message}`)
    logger.error(error.stack)
  }
}

/**
 * Schedule the daily public client token cleanup at 04:00 UTC
 * @returns {void}
 */
export function schedulePublicTokenCleanup () {
  const now = new Date()
  const nextRun = new Date(now)
  nextRun.setUTCHours(CLEANUP_HOUR_UTC, 0, 0, 0)

  // If it's already past the cleanup hour today, schedule for tomorrow
  if (now >= nextRun) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1)
  }

  setTimeout(() => {
    // Run immediately, then every 24 hours
    runPublicTokenCleanup()
    setInterval(runPublicTokenCleanup, MS_PER_DAY)
  }, nextRun.getTime() - now.getTime())

  logger.info(`Public client token cleanup scheduled, next run at ${nextRun.toISOString()}`)
}
