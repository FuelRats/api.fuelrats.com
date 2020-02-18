import Model, { column, table, validate, type } from './Model'

const epicsNotesFieldMaxLength = 2048

@table({ paranoid: true })
/**
 * Model class for Epic nominations
 */
export default class Epic extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ len: [0, epicsNotesFieldMaxLength] })
  @column(type.TEXT)
  static notes = ''

  @validate({ isUUID: true })
  @column(type.UUID, { allowNull: true })
  static rescueId = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID, { allowNull: true })
  static approvedById = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static nominatedById = undefined

  /**
   * @inheritdoc
   */
  static getScopes (models) {
    return {
      defaultScope: [{
        include: [{
          model: models.User.scope('norelations'),
          as: 'nominees',
          required: false,
        }, {
          model: models.User.scope('norelations'),
          as: 'nominatedBy',
          required: false,
        }, {
          model: models.User.scope('norelations'),
          as: 'approvedBy',
          required: false,
        }],
      }],
    }
  }

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)
    models.Epic.belongsToMany(models.User, {
      as: 'nominees',
      foreignKey: 'epicId',
      through: {
        model: models.EpicUsers,
        foreignKey: 'epicId',
      },
    })
    models.Epic.belongsTo(models.Rescue, { as: 'rescue' })
    models.Epic.belongsTo(models.User, {
      as: 'approvedBy',
      foreignKey: 'approvedById',
    })
    models.Epic.belongsTo(models.User, {
      as: 'nominatedBy',
      foreignKey: 'nominatedById',
    })
  }
}
