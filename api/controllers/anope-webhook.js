'use strict'

class AnopeWebhook {
  static update (ctx) {
    if (AnopeWebhook.matchesCachedRequestItem(ctx.data)) {
      console.log('matches cache')
    }

    if (ctx.data.event) {
      switch (ctx.data.event) {
        case 'ns_register':
          console.log('register', ctx.data.user)
          break

        case 'ns_drop':
          console.log('drop', ctx.data.user)
          break

        case 'ns_group':
          console.log('group', ctx.data.user, ctx.data.account)
      }
    }
    return true
  }

  static cacheRequest (type, nickname, account = null) {
    let cacheItem = new AnopeRequestCacheItem(type, nickname, account)
    AnopeWebhook.recentAnopeRequestsCache.push(cacheItem)
    setTimeout(() => {
      cacheItem.remove()
    }, 5000)
  }

  static matchesCachedRequestItem (ctx) {
    return AnopeWebhook.recentAnopeRequestsCache.find((item) => {
      return item.matchesEvent(ctx.data.event, ctx.data.user, ctx.data.account)
    })
  }
}

AnopeWebhook.recentAnopeRequestsCache = []

class AnopeRequestCacheItem {
  constructor (type, nickname, account = null) {
    this.type = type
    this.nickname = nickname
    this.account = account
  }

  matchesEvent (type, nickname, account) {
    return this.type === type && this.nickname === nickname && this.account === account
  }

  remove () {
    let index = AnopeWebhook.recentAnopeRequestsCache.indexOf(this)
    if (index) {
      AnopeWebhook.recentAnopeRequestsCache.splice(index, 1)
      return true
    }
    return false
  }
}

module.exports = {
  AnopeWebhook,
  AnopeRequestCacheItem
}