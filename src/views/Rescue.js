import SequelizeView from './Sequelize'
import RatsView from './Rat'

export default class RescueView extends SequelizeView {
  get type () {
    return 'rescues'
  }

  get attributes () {
    const {
      client,
      codeRed,
      data,
      notes,
      platform,
      quotes,
      status,
      system,
      title,
      outcome,
      unidentifiedRats,
      createdAt,
      updatedAt
    } = this.object

    return {
      client,
      codeRed,
      data,
      notes,
      platform,
      quotes,
      status,
      system,
      title,
      outcome,
      unidentifiedRats,
      createdAt,
      updatedAt
    }
  }

  get relationships () {
    return {
      rats: RatsView,
      firstLimpet: RatsView
    }
  }

  get related () {
    return [RatsView]
  }
}
