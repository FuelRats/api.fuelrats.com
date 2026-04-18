const SYSTEMS_API = 'https://systems.api.fuelrats.com'

/**
 * Look up a system's landmark description from the Fuel Rats Systems API.
 * Returns a human-readable string like "near Sol" or "~500LY from Colonia".
 * @param {string} systemName the system name to look up
 * @returns {Promise<string|null>} description or null if lookup fails
 */
export default async function getSystemDescription (systemName) {
  if (!systemName) {
    return null
  }

  try {
    const url = new URL('/landmark', SYSTEMS_API)
    url.searchParams.set('name', systemName)

    const response = await fetch(url, {
      headers: { 'User-Agent': 'FuelRatsAPI/4.0' },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const landmark = data.landmarks?.[0]
    if (!landmark) {
      return null
    }

    const distance = landmark.distance

    if (distance < 50) {
      return `near ${landmark.name}`
    }
    if (distance < 500) {
      return `~${Math.ceil(distance / 10) * 10}LY from ${landmark.name}`
    }
    if (distance < 2000) {
      return `~${Math.ceil(distance / 100) * 100}LY from ${landmark.name}`
    }
    return `~${Math.ceil(distance / 1000)}kLY from ${landmark.name}`
  } catch {
    return null
  }
}
