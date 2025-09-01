import { logMetric } from '../logging'

/**
 * Add database query metrics to Sequelize
 * @param {object} sequelize - Sequelize instance
 */
export function addDatabaseMetrics (sequelize) {
  // Hook into all database queries
  sequelize.addHook('beforeQuery', (options) => {
    options.startTime = Date.now()
  })

  sequelize.addHook('afterQuery', (options, result) => {
    const duration = Date.now() - options.startTime
    const queryType = options.type || 'unknown'
    const tableName = options.model?.tableName || 'unknown'
    
    logMetric('database_query', {
      _query_type: queryType,
      _table_name: tableName,
      _duration_ms: duration,
      _sql_length: options.sql?.length || 0,
      _result_count: Array.isArray(result) ? result.length : (result ? 1 : 0),
    }, `DB Query: ${queryType} on ${tableName} (${duration}ms)`)
  })

  // Hook into database connection events
  sequelize.addHook('beforeConnect', () => {
    logMetric('database_connection', {
      _event: 'connecting',
    }, 'Database connection attempt')
  })

  sequelize.addHook('afterConnect', () => {
    logMetric('database_connection', {
      _event: 'connected',
    }, 'Database connected successfully')
  })

  sequelize.addHook('beforeDisconnect', () => {
    logMetric('database_connection', {
      _event: 'disconnecting',
    }, 'Database disconnecting')
  })

  // Track sync operations
  sequelize.addHook('beforeSync', () => {
    logMetric('database_sync', {
      _event: 'sync_start',
    }, 'Database sync started')
  })

  sequelize.addHook('afterSync', () => {
    logMetric('database_sync', {
      _event: 'sync_complete',
    }, 'Database sync completed')
  })
}