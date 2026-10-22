/**
 * Resolve the real client IP for a request.
 *
 * With a single trusted reverse proxy (`proxyEnabled`), the proxy appends the connecting peer to
 * `X-Forwarded-For` (e.g. nginx `$proxy_add_x_forwarded_for`), so the rightmost entry is the real
 * client and any value a client prepended is ignored. Without a proxy, `X-Forwarded-For` is fully
 * attacker-controlled and is ignored in favour of the socket peer address.
 * @param {object} arg function arguments object
 * @param {string} [arg.forwardedFor] the raw `X-Forwarded-For` header value
 * @param {string} [arg.socketAddress] the transport peer address (e.g. Bun `server.requestIP`)
 * @param {boolean} [arg.proxyEnabled] whether the API runs behind a trusted reverse proxy
 * @returns {string} the resolved client IP
 */
export default function resolveClientIp ({ forwardedFor, socketAddress, proxyEnabled }) {
  if (proxyEnabled && typeof forwardedFor === 'string') {
    const parts = forwardedFor.split(',').map((part) => {
      return part.trim()
    }).filter(Boolean)
    if (parts.length > 0) {
      return parts[parts.length - 1]
    }
  }
  return socketAddress || '127.0.0.1'
}
