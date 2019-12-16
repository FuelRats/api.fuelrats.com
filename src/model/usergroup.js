/* eslint-disable */
import Model, { column, validate, paranoid } from './'
import UUID from 'pure-uuid'

export default class UserGroup extends Model {
  @column({ type: UUID, defaultValue: () => { return (new UUID(4)) } })
  static id

  @column({ defaultValue: UUID })
  static groupId

  @column({ defaultValue: UUID })
  static userId
}
