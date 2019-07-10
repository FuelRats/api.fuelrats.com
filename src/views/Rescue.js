import DatabaseView from './Database'
import RatsView from './Rat'
import enumerable from '../classes/Enum'

export default class RescueView extends DatabaseView {
  static get type () {
    return 'rescues'
  }

  get attributes () {
    return attributes
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

@enumerable
/**
 * Enumerable representing the different attributes of this view
 * @readonly
 * @enum {Symbol}
 */
export class attributes {
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
  static deletedAt = { permissions: ['rescue.internal'] }
  static status
  static outcome
  static quotes
}
