// groupsync channel/flag audit (Risk 11/33). Read-only, no DB writes.
//
// Cross-checks the approved role→channel→flags policy against:
//   - the valid Anope FLAGS-letter set (see groupsync-flags-priv-mapping.md), and
//   - a live snapshot of registered + invite-only (+i) channels.
//
// Regenerate the live snapshot (read-only) before a real audit:
//   ssh mozzarella 'sudo mysql anope -N -e "SELECT name FROM anope21_ChannelInfo;"'
//   ssh mozzarella "sudo mysql anope -N -e \"SELECT DISTINCT ci FROM anope21_ModeLock WHERE name='INVITE' AND \\\`set\\\`=1;\""
// then update thoughts/research/groupsync-live-channels.json.
//
// Usage:  bun scripts/groupsync-audit.mjs

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { VALID_FLAG_LETTERS } from '../src/helpers/groupFlagLetters'

const here = dirname(fileURLToPath(import.meta.url))
const research = join(here, '..', 'thoughts', 'research')

const policy = JSON.parse(readFileSync(join(research, 'groupsync-group-channels.json'), 'utf8'))
const live = JSON.parse(readFileSync(join(research, 'groupsync-live-channels.json'), 'utf8'))

const norm = (chan) => (chan.startsWith('#') ? chan : `#${chan}`).toLowerCase()
const registered = new Set(live.registered.map(norm))
const inviteOnly = new Set(live.inviteOnly.map(norm))

const invalidFlags = new Map()   // letter -> Set(role/channel)
const unregistered = new Map()   // normChan -> Set(role) — policy grants that would be no-ops (Risk 11)
const policyChannels = new Set()

for (const [role, channels] of Object.entries(policy)) {
  for (const [chan, flags] of Object.entries(channels)) {
    const nc = norm(chan)
    policyChannels.add(nc)
    if (!registered.has(nc)) {
      if (!unregistered.has(nc)) unregistered.set(nc, new Set())
      unregistered.get(nc).add(role)
    }
    for (const letter of flags) {
      if (!VALID_FLAG_LETTERS.has(letter)) {
        if (!invalidFlags.has(letter)) invalidFlags.set(letter, new Set())
        invalidFlags.get(letter).add(`${role}:${chan}`)
      }
    }
  }
}

// Risk 33: every group-managed +i channel must be covered by policy, else role-holders
// can't get in via the oracle once masks are gone.
const gatedNotInPolicy = [...inviteOnly].filter((c) => !policyChannels.has(c))
// +i channels NOT referenced by any policy role at all (informational — human-only access today).
const registeredUnused = [...registered].filter((c) => !policyChannels.has(c))

const line = (s = '') => console.info(s)
let problems = 0

line('=== groupsync audit ===')
line(`policy roles: ${Object.keys(policy).length}  ·  distinct policy channels: ${policyChannels.size}`)
line(`live: ${registered.size} registered, ${inviteOnly.size} invite-only (+i)`)
line()

line('--- Invalid FLAGS letters (Risk 41: dropped + warn-logged at runtime) ---')
if (invalidFlags.size === 0) {
  line('  none')
} else {
  problems += 1
  for (const [letter, where] of invalidFlags) {
    const sample = [...where].slice(0, 3).join(', ')
    line(`  '${letter}' → invalid, in ${where.size} entr${where.size === 1 ? 'y' : 'ies'} (e.g. ${sample})`)
  }
}
line()

line('--- Policy channels NOT registered in Anope (Risk 11: grant is a no-op) ---')
if (unregistered.size === 0) {
  line('  none')
} else {
  problems += 1
  for (const [chan, roles] of unregistered) line(`  ${chan} — roles: ${[...roles].join(', ')}`)
}
line()

line('--- Invite-only (+i) channels NOT covered by policy (Risk 33: no groupsync entry) ---')
if (gatedNotInPolicy.length === 0) {
  line('  none — every +i channel is policy-covered')
} else {
  problems += 1
  for (const chan of gatedNotInPolicy) line(`  ${chan}`)
}
line()

line('--- Registered channels not referenced by any policy role (informational) ---')
line(registeredUnused.length ? `  ${registeredUnused.join(', ')}` : '  none')
line()

line(problems === 0 ? 'AUDIT: clean' : `AUDIT: ${problems} problem categor${problems === 1 ? 'y' : 'ies'} — review above`)
process.exit(problems === 0 ? 0 : 1)
