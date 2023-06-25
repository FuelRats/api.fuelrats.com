/* eslint-disable */
import workerpool from 'workerpool'
import webpush from 'web-push'
import config from '../config'

/**
 * Send a web push broadcast
 * @param subscribers {object} list of subscribers
 * @param {object} payload the web push payload
 * @returns {Promise<{}>}
 */
function webPushBroadcast (subscribers, payload) {
  let { privateKey, publicKey } = config.webpush
  if (!privateKey || !publicKey) {
    return
  }

  webpush.setVapidDetails(
    'mailto:support@fuelrats.com',
    publicKey,
    privateKey
  );

  const payloadString = JSON.stringify(payload)

  for (let subscription of subscribers) {
    webpush.sendNotification({
      endpoint: subscription.endpoint,
      keys: {
        auth: subscription.auth,
        p256dh: subscription.p256dh,
      },
    }, payloadString);
  }
}

workerpool.worker({
  webPushBroadcast
})
