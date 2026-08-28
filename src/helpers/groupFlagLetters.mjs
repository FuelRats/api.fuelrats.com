/**
 * The 26 FLAGS letters Anope 2.1.26 honours for channel access. Authoritative
 * set from the running chanserv.conf — see
 * `thoughts/research/groupsync-flags-priv-mapping.md`. Any other letter (notably
 * lowercase `g`) is invalid. Kept dependency-free so both the API write
 * validator and the standalone `scripts/groupsync-audit.mjs` can share it.
 */
export const VALID_FLAG_LETTERS = new Set('ABFGHIKNOQUVabcfhikmoqstuv'.split(''))
