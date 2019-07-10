import Model, { column, validate, paranoid } from './'
import enumerated from '../classes/Enum'
import bcrypt from 'bcrypt'
import joinjs from '../classes/joinjs'
import UUID from 'pure-uuid'

@enumerated
export class Platform {
  static PC
  static Xbox
  static PS4

  static fromString (string) {
    switch (string) {
      case 'pc':
        return Platform.PC

      case 'xb':
        return Platform.Xbox

      case 'ps':
        return Platform.PS4

      default:
        return undefined
    }
  }
}

export default class Rat extends Model {
  @column({ type: UUID, defaultValue: () => { return (new UUID(4)) } })
  static id

  @column({ type: String, field: 'name' })
  static cmdrName

  @column({ type: Object, defaultValue: {} })
  static data

  @column({ type: Platform, defaultValue: Platform.PC })
  static platform

  @column({ defaultValue: UUID, optional: true })
  static userId
}
