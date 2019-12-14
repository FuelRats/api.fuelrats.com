/* eslint-disable */
import Model, { column, validate, paranoid } from './'
import enumerated from '../classes/Enum'
import bcrypt from 'bcrypt'
import joinjs from '../classes/joinjs'
import UUID from 'pure-uuid'
import Rat, { Platform } from './rat'
import Group from './group'
import UserGroup from './usergroup'

const passwordMinLength = 12
const passwordMaxLength = 1024

@enumerated
export class UserStatus {
  static active
  static inactive
  static legacy
  static deactivated
}

/**
 * User Model
 */
export default class User extends Model {
  @column({ type: UUID, defaultValue: () => { return (new UUID(4)) } })
  static id

  @column({ type: Object, defaultValue: {} })
  static data

  @column({ type: String })
  static email

  @column({ type: String })
  static password

  @column({ type: Buffer, optional: true })
  static image

  @column({ type: UserStatus, defaultValue: UserStatus.active })
  static status

  @column({ type: Date, optional: true })
  static suspended

  @column({ defaultValue: UUID, optional: true })
  static displayRatId

  static async findByEmail (email) {
    let results = await User.select({
      Users: ['id', 'data', 'email', 'password', 'status', 'suspended', 'displayRatId', paranoid],
      rats: ['id', 'name', 'data', 'platform', 'userId', paranoid],
      displayRat: ['id', 'name', 'data', 'platform', paranoid],
      userGroups: ['id', 'groupId', 'userId']
    }).from('Users')
      .leftJoin('Rats as rats', (table) => {
        table.on('Users.id', 'rats.userId').andOnNull('rats.deletedAt')
      })
      .leftJoin('Rats as displayRat', (table) => {
        table.on('Users.displayRatId', 'displayRat.id').andOnNull('rats.deletedAt')
      })
      .leftJoin('UserGroups as userGroups', 'Users.id', 'userGroups.userId')
      .leftJoin('Groups as groups', 'userGroups.groupId', 'groups.id')
      .whereNull('Users.deletedAt')
      .andWhere('email', 'ilike', email)

    let users = User.map(results)
    console.log(users)
  }

  static map (results) {
    return joinjs.map(results, [{
      mapId: 'userMap',
      properties: [
        'id',
        'data',
        'email',
        'password',
        'status',
        'suspended',
        'displayRatId',
        'createdAt',
        'updatedAt',
        'deletedAt'
      ],
      createNew: () => {
        return new User()
      },
      collections: [{
        name: 'rats',
        mapId: 'ratMap',
        columnPrefix: 'rats.'
      }, {
        name: 'userGroups',
        mapId: 'userGroupMap',
        columnPrefix: 'userGroup.'
      }],
      associations: [{
        name: 'displayRat',
        mapId: 'ratMap',
        columnPrefix: 'displayRat.'
      }]
    }, {
      mapId: 'ratMap',
      properties: [
        'name',
        'data',
        { column: 'platform', name: 'platform', transform: Platform.fromString },
        'createdAt',
        'updatedAt',
        'deletedAt'
      ],
      createNew: () => {
        return new Rat()
      }
    }, {
      mapId: 'userGroupMap',
      properties: [
        'createdAt',
        'updatedAt'
      ],
      createNew: () => {
        return new UserGroup()
      },
      associations: [{
        name: 'group',
        mapId: 'groupMap',
        columnPrefix: 'group.'
      }]
    }, {
      mapId: 'groupMap',
      properties: [
        'admin',
        'vhost',
        'priority',
        'permissions',
        'createdAt',
        'updatedAt',
        'deletedAt'
      ],
      createNew: () => {
        return new Group()
      }
    }], 'userMap', 'Users.')
  }

  get permissions () {

  }

  async setPassword () {

  }

  async getImage () {

  }

  async setImage (value) {

  }

  async authenticate (password) {

  }

  get isSuspended () {
    if (!this.suspended) {
      return false
    }
    return this.suspended - (new Date()) > 0
  }

  get isDeactivated () {
    return this.status === UserStatus.deactivated
  }

  get isConfirmed () {
    return this.groups.length > 0
  }

  get preferredRat () {
    if (this.displayRat) {
      return this.displayRat
    } else if (this.rats.length > 0) {
      return this.rats[0]
    } else {
      return undefined
    }
  }
}
