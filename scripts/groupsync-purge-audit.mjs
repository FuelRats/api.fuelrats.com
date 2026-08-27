// groupsync cutover purge audit (Phase G, Risk 42).
//
// Reports (and, with --execute, removes) the API-created channel-access rows in
// the Anope DB once the groupsync module is the source of truth for channel
// access. Dry-run by default.
//
//   bun scripts/groupsync-purge-audit.mjs                 # dry-run report
//   bun scripts/groupsync-purge-audit.mjs --execute       # DELETE ChanAccess creator='API'
//   bun scripts/groupsync-purge-audit.mjs --execute --include-modelocks
//
// SAFETY: back up the Anope DB (restic) before --execute. Review the creator
// breakdown first — every non-'API' creator is preserved; confirm 'API' is not
// also used by a human before purging.

import Anope from '../src/classes/Anope'

const execute = process.argv.includes('--execute')
const includeModeLocks = process.argv.includes('--include-modelocks')

const line = (message = '') => console.info(message)

const audit = await Anope.auditApiChannelAccess()
if (!audit) {
  line('Anope database not configured (config.anope.database is unset) — nothing to audit.')
  process.exit(1)
}

line('=== groupsync purge audit — ChanAccess creator breakdown ===')
for (const row of audit.byCreator) {
  line(`  ${String(row.creator ?? '(null)').padEnd(20)} ${row.count}`)
}
line('')
line(`API-created rows:   active=${audit.apiActive}  soft-deleted=${audit.apiSoftDeleted}`)
line(`API INVITEOVERRIDE mode-locks: ${audit.inviteModeLocks}${includeModeLocks ? ' (will purge)' : ' (left in place)'}`)
line('')
line('Sample of API-created ChanAccess rows:')
for (const row of audit.sample) {
  const state = row.timestamp === null ? 'soft-deleted' : 'active'
  line(`  ${String(row.ci).padEnd(20)} ${String(row.mask).padEnd(24)} data=${row.data} [${state}]`)
}
line('')

if (!execute) {
  line('DRY RUN — no rows deleted. Re-run with --execute (after a DB backup) to purge.')
  process.exit(0)
}

const result = await Anope.purgeApiChannelAccess({ execute: true, includeModeLocks })
line(`PURGED: ${result.deletedAccess} ChanAccess row(s), ${result.deletedModeLocks} mode-lock(s).`)
process.exit(0)
