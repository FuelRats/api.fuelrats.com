import { Op } from 'sequelize'
import { db, IrcOutbox } from '../db'
import Anope from '../classes/Anope'
import Announcer from '../classes/Announcer'
import config from '../config'
import logger, { logMetric } from '../logging'

// The outbox worker delivers `NickServ GROUPSYNC <email>` push-triggers to the
// Anope groupsync module with at-least-once semantics. Rows are leased with
// `FOR UPDATE SKIP LOCKED` so multiple API replicas can share the queue without
// double-delivering (Risk 49). A delivery counts as done only when the module
// acknowledges the modes were *applied* (Risk 48); otherwise it is retried with
// exponential backoff and eventually dead-lettered (Risk 50).

const BATCH_SIZE = 25
const POLL_INTERVAL_MS = 5_000
const MAX_ATTEMPTS = 10
// How long a claimed row stays invisible to other workers while it is being
// delivered — long enough to outlast a delivery (and a crashed worker's row is
// reclaimed after it lapses).
const LEASE_MS = 60_000
const BACKOFF_BASE_MS = 15_000
const BACKOFF_CAP_MS = 60 * 60_000
const RETENTION_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60_000
const ERROR_MAX_LENGTH = 500
// Delivered rows are pruned roughly once an hour (one purge per N ticks).
const PURGE_EVERY_TICKS = Math.round((60 * 60_000) / POLL_INTERVAL_MS)

let ticking = false

/**
 * Exponential backoff for the Nth attempt, capped.
 * @param {number} attempts attempts made so far (>= 1)
 * @returns {number} milliseconds to wait before the next attempt
 */
function backoffMs (attempts) {
  const exponential = BACKOFF_BASE_MS * (2 ** (attempts - 1))
  return Math.min(exponential, BACKOFF_CAP_MS)
}

/**
 * Claim a batch of due pending rows, leasing them so concurrent workers skip
 * them. Increments `attempts` and pushes `nextRetryAt` out by the lease window
 * inside the same short transaction, then returns the rows for delivery.
 * @returns {Promise<IrcOutbox[]>} the leased rows
 */
function claimBatch () {
  return db.transaction(async (transaction) => {
    const now = new Date()
    const rows = await IrcOutbox.findAll({
      where: {
        status: 'pending',
        [Op.or]: [{ nextRetryAt: null }, { nextRetryAt: { [Op.lte]: now } }],
      },
      order: [['nextRetryAt', 'ASC']],
      limit: BATCH_SIZE,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
      transaction,
    })

    const leaseUntil = new Date(now.getTime() + LEASE_MS)
    for (const row of rows) {
      row.attempts += 1
      row.nextRetryAt = leaseUntil
      await row.save({ transaction })
    }
    return rows
  })
}

/**
 * Record a failed delivery: dead-letter once attempts are exhausted, otherwise
 * schedule a backed-off retry.
 * @param {IrcOutbox} row the outbox row
 * @param {string} message the failure reason
 * @returns {Promise<void>} resolves when the row is updated
 */
async function handleFailure (row, message) {
  const lastError = String(message).slice(0, ERROR_MAX_LENGTH)

  if (row.attempts >= MAX_ATTEMPTS) {
    await row.update({ status: 'failed', lastError, nextRetryAt: null })
    logger.error(`groupsync outbox dead-lettered ${row.email} after ${row.attempts} attempts: ${lastError}`)
    logMetric('groupsync_outbox_deadletter', { _attempts: row.attempts }, `groupsync delivery permanently failed for ${row.email}`)
    try {
      await Announcer.sendTechnicalMessage({
        message: `[API] groupsync delivery permanently failed for ${row.email} after ${row.attempts} attempts: ${lastError}`,
      })
    } catch (error) {
      logger.error({ message: 'Failed to send groupsync dead-letter alert', error })
    }
    return
  }

  await row.update({ lastError, nextRetryAt: new Date(Date.now() + backoffMs(row.attempts)) })
}

/**
 * Deliver a single outbox row via the groupsync push, marking it delivered only
 * on an applied acknowledgement.
 * @param {IrcOutbox} row the outbox row
 * @returns {Promise<void>} resolves when the row reaches a terminal-or-retry state
 */
async function deliver (row) {
  try {
    const { applied, response } = await Anope.groupSync(row.email)
    if (applied) {
      await row.update({ status: 'delivered', lastError: null, nextRetryAt: null })
      return
    }
    await handleFailure(row, `not applied: ${response}`)
  } catch (error) {
    await handleFailure(row, error?.message ?? String(error))
  }
}

/**
 * Remove delivered rows past the retention window to keep the table small.
 * @returns {Promise<void>} resolves when old rows are purged
 */
async function purgeDelivered () {
  const cutoff = new Date(Date.now() - (RETENTION_DAYS * MS_PER_DAY))
  await IrcOutbox.destroy({ where: { status: 'delivered', updatedAt: { [Op.lt]: cutoff } } })
}

/**
 * Claim and deliver one batch of due groupsync pushes.
 * @returns {Promise<void>} resolves when the batch is processed
 */
export async function processOutbox () {
  if (!config.anope.jsonrpc) {
    return
  }

  const rows = await claimBatch()
  for (const row of rows) {
    // Sequential (not concurrent): the module applies each GROUPSYNC on Anope's
    // main thread, so deliveries are rate-limited by design.
    await deliver(row)
  }
}

/**
 * Start the in-process groupsync outbox worker. No-op when JSON-RPC is
 * unconfigured (e.g. local dev without services).
 * @returns {void}
 */
export function scheduleGroupsyncOutbox () {
  if (!config.anope.jsonrpc) {
    logger.info('groupsync outbox worker disabled (no Anope JSON-RPC configured)')
    return
  }

  let ticksSincePurge = 0
  const timer = setInterval(async () => {
    if (ticking) {
      return
    }
    ticking = true
    try {
      await processOutbox()
      ticksSincePurge += 1
      if (ticksSincePurge >= PURGE_EVERY_TICKS) {
        ticksSincePurge = 0
        await purgeDelivered()
      }
    } catch (error) {
      logger.error({ message: 'groupsync outbox tick failed', error })
    } finally {
      ticking = false
    }
  }, POLL_INTERVAL_MS)

  if (typeof timer.unref === 'function') {
    timer.unref()
  }

  logger.info('groupsync outbox worker started')
}
