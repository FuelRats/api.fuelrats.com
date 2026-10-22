// Hosts of the browser push services the API is willing to POST notifications to. Restricting the
// subscription endpoint to these prevents a subscriber from aiming the worker at an internal host
// (SSRF). Suffix entries match a service's subdomains (e.g. updates.push.services.mozilla.com).
const allowedHosts = new Set([
  'fcm.googleapis.com',
  'android.googleapis.com',
  'web.push.apple.com',
])
const allowedHostSuffixes = [
  '.push.services.mozilla.com',
  '.notify.windows.com',
]

/**
 * Whether a web-push subscription endpoint points at a known push service over https
 * @param {string} endpoint the subscription endpoint URL
 * @returns {boolean} true if the endpoint is an allowed https push-service URL
 */
export default function isAllowedPushEndpoint (endpoint) {
  if (typeof endpoint !== 'string') {
    return false
  }

  let url
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }

  if (url.protocol !== 'https:') {
    return false
  }

  const host = url.hostname.toLowerCase()
  if (allowedHosts.has(host)) {
    return true
  }
  return allowedHostSuffixes.some((suffix) => {
    return host.endsWith(suffix)
  })
}
