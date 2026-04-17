/**
 * Serialize WebPushSubscription model instances to plain objects
 * for passing to the web push worker via postMessage.
 * @param {object[]} subscriptions Sequelize model instances
 * @returns {object[]} plain objects with only the fields the worker needs
 */
export default function serializeSubscriptions (subscriptions) {
  return subscriptions.map((sub) => {
    return {
      endpoint: sub.endpoint,
      auth: sub.auth,
      p256dh: sub.p256dh,
    }
  })
}
