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
