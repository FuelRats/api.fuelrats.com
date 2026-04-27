import { db, Rescue, Rat, User } from '../db'
import Mail from '../classes/Mail'
import paperworkReminderEmail from '../emails/paperwork'
import logger from '../logging'
import { logMetric } from '../logging'

const mail = new Mail()

// Lookback: rescues closed between 2 hours and 30 days ago with no outcome
const MIN_AGE_HOURS = 12
const MAX_AGE_DAYS = 30

/**
 * Find all rescues with unfiled paperwork and group them by first limpet user
 * @returns {Map<string, { user: User, rescues: Rescue[] }>} map of userId → user and their unfiled rescues
 */
async function getUnfiledPaperwork () {
  const minDate = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000)
  const maxDate = new Date(Date.now() - MIN_AGE_HOURS * 60 * 60 * 1000)

  const rescues = await Rescue.unscoped().findAll({
    where: {
      status: 'closed',
      outcome: null,
      updatedAt: {
        [db.Sequelize.Op.gte]: minDate,
        [db.Sequelize.Op.lt]: maxDate,
      },
    },
    include: [
      {
        model: Rat,
        as: 'firstLimpet',
        required: true,
        include: [{
          model: User.scope('norelations'),
          as: 'user',
          required: true,
          where: {
            status: 'active',
            suspended: null,
          },
        }],
      },
    ],
    order: [['updatedAt', 'DESC']],
  })

  // Group by user, attach rat name for display
  const userMap = new Map()
  for (const rescue of rescues) {
    const user = rescue.firstLimpet.user
    if (!userMap.has(user.id)) {
      // Use the first limpet's rat name as the display name since user.displayName() requires loaded relations
      user._displayName = rescue.firstLimpet.name || user.email
      userMap.set(user.id, { user, rescues: [] })
    }
    userMap.get(user.id).rescues.push(rescue)
  }

  return userMap
}

/**
 * Send paperwork reminder emails to all users with unfiled paperwork
 */
export async function sendPaperworkReminders () {
  logger.info('Running paperwork reminder check...')

  try {
    const userMap = await getUnfiledPaperwork()

    if (userMap.size === 0) {
      logger.info('No unfiled paperwork found')
      return
    }

    let sent = 0
    let failed = 0
    const totalRescues = [...userMap.values()].reduce((sum, { rescues }) => sum + rescues.length, 0)

    for (const [userId, { user, rescues }] of userMap) {
      try {
        const email = paperworkReminderEmail({ user, rescues, displayName: user._displayName })
        await mail.send(email)
        sent++

        logMetric('paperwork_reminder_sent', {
          _user_id: userId,
          _rescue_count: rescues.length,
          _oldest_hours: Math.round((Date.now() - new Date(rescues[rescues.length - 1].updatedAt).getTime()) / (1000 * 60 * 60)),
        }, `Paperwork reminder sent to ${user.email} (${rescues.length} rescues)`)
      } catch (error) {
        failed++
        logger.error(`Failed to send paperwork reminder to ${user.email}: ${error.message}`)
      }
    }

    logMetric('paperwork_reminder_batch', {
      _users_notified: sent,
      _users_failed: failed,
      _total_unfiled: totalRescues,
    }, `Paperwork reminders: ${sent} users notified, ${totalRescues} unfiled rescues`)
  } catch (error) {
    logger.error(`Paperwork reminder cron failed: ${error.message}`)
    logger.error(error.stack)
  }
}

/**
 * Schedule daily paperwork reminders at 08:00 UTC
 */
export function schedulePaperworkReminders () {
  const now = new Date()
  let nextRun = new Date(now)
  nextRun.setUTCHours(8, 0, 0, 0)

  // If it's already past 08:00 UTC today, schedule for tomorrow
  if (now >= nextRun) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1)
  }

  const msUntilNext = nextRun.getTime() - now.getTime()

  setTimeout(() => {
    // Run immediately, then every 24 hours
    sendPaperworkReminders()
    setInterval(sendPaperworkReminders, 24 * 60 * 60 * 1000)
  }, msUntilNext)

  logger.info(`Paperwork reminders scheduled, next run at ${nextRun.toISOString()}`)
}
