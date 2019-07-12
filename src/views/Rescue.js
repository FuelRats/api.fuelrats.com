import DatabaseView from './Database'
import { ReadPermission } from './'
import RatsView from './Rat'
import enumerable from '../classes/Enum'

export default class RescueView extends DatabaseView {
  static get type () {
    return 'rescues'
  }

  get attributes () {
    return class {
      static client
      static codeRed
      static data
      static notes
      static platform
      static system
      static title
      static unidentifiedRats
      static createdAt
      static updatedAt
      static deletedAt = ReadPermission.internal
      static status
      static outcome
      static quotes
    }
  }

  get defaultReadPermission () {
    return ReadPermission.group
  }

  get isSelf () {
    const { user } = this.query.connection.state
    if (!user) {
      return false
    }

    const isAssigned = this.object.rats.some((rat) => {
      return rat.userId === user.id
    })

    let isFirstLimpet = false
    if (this.object.firstLimpet) {
      isFirstLimpet = this.object.firstLimpet.userId === user.id
    }

    if (isAssigned || isFirstLimpet) {
      return this.query.connection.state.permissions.includes('rescue.read.me')
    }
    return false
  }

  get isGroup () {
    return this.query.connection.state.permissions.includes('rescue.read')
  }

  get isInternal () {
    return this.query.connection.state.permissions.includes('rescue.internal')
  }

  get relationships () {
    return {
      rats: RatsView,
      firstLimpet: RatsView
    }
  }

  get includes () {
    return ['rats', 'firstLimpet']
  }

  get related () {
    return [RatsView]
  }
}
