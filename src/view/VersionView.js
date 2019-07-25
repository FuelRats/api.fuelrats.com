import { ReadPermission, DatabaseView } from './'

export default class VersionView extends DatabaseView {
  static get type () {
    return 'versions'
  }

  get id () {
    return this.object.commit
  }

  get attributes () {
    return class {
      static version
      static commit
      static branch
      static tags
      static date
    }
  }

  get defaultReadPermission () {
    return ReadPermission.all
  }

  get relationships () {
    return {}
  }

  get related () {
    return []
  }

  get includes () {
    return []
  }
}
