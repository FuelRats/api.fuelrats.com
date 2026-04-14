import webpush from 'web-push'

self.onmessage = async (event) => {
  const { id, subscribers, payload, vapidConfig } = event.data
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

    for (const subscription of subscribers) {
      webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          auth: subscription.auth,
          p256dh: subscription.p256dh,
        },
      }, payloadString)
    }

    postMessage({ id, result: true })
  } catch (error) {
    postMessage({ id, error: error.message })
  }
}
