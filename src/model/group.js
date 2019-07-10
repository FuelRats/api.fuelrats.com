import Model, { column, validate, paranoid } from './'
import enumerated from '../classes/Enum'
import bcrypt from 'bcrypt'
import UUID from 'pure-uuid'

export default class Group extends Model {
  @column({ type: UUID, defaultValue: () => { return (new UUID(4)) } })
  static id

  @column({ type: String, optional: true })
  static vhost

  @column({ type: Boolean, defaultValue: false })
  static isAdministrator

  @column({ type: Number, defaultValue: 0 })
  static priority

  @column({ type: [String], defaultValue: [] })
  static permissions
}
