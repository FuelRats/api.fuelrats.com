import webpush from 'web-push'

self.onmessage = async (event) => {
  const { id, subscribers, payload, vapidConfig, options = {} } = event.data
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

    for (const subscription of subscribers) {
      webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          auth: subscription.auth,
          p256dh: subscription.p256dh,
        },
      }, payloadString, sendOptions)
    }

    postMessage({ id, result: true })
  } catch (error) {
    postMessage({ id, error: error.message })
  }
}
