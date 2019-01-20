import DatabaseView from './Database'
import RatView from './Rat'

export default class ShipView extends DatabaseView {
  static get type () {
    return 'ships'
  }

  get attributes () {
    const {
      name,
      shipId,
      shipType,
      createdAt,
      updatedAt
    } = this.object
    return {
      name,
      shipId,
      shipType,
      createdAt,
      updatedAt
    }
  }

  get relationships () {
    return {
      rat: RatView
    }
  }

  get related () {
    return [RatView]
  }
}
