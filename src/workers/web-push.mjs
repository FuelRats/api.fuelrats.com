import webpush from 'web-push'

self.onmessage = async (event) => {
  const {
    id, subscribers, payload, vapidConfig, options = {},
  } = event.data
  try {
    if (!vapidConfig?.privateKey || !vapidConfig?.publicKey) {
      postMessage({ id, result: null })
      return
    }

    webpush.setVapidDetails(
      'mailto:support@fuelrats.com',
      vapidConfig.publicKey,
      vapidConfig.privateKey,
    )

    const payloadString = JSON.stringify(payload)

    const sendOptions = {
      TTL: options.TTL ?? 60,
      urgency: options.urgency ?? 'normal',
      topic: options.topic,
    }

    const results = await Promise.allSettled(subscribers.map((subscription) => {
      return webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          auth: subscription.auth,
          p256dh: subscription.p256dh,
        },
      }, payloadString, sendOptions)
    }))

    const sent = results.filter((result) => {
      return result.status === 'fulfilled'
    }).length
    const failed = results.filter((result) => {
      return result.status === 'rejected'
    }).length

    postMessage({ id, result: { sent, failed } })
  } catch (error) {
    postMessage({ id, error: error.message })
  }
}
