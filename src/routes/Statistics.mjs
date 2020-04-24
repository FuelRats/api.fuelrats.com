import DatabaseDocument from '../Documents/DatabaseDocument'
import { NotFoundAPIError } from '../classes/APIError'
import { websocket } from '../classes/WebSocket'
import { db } from '../db'
import DatabaseQuery from '../query/DatabaseQuery'
import LeaderboardQuery from '../query/LeaderboardQuery'
import { UserStatisticsView, LeaderboardView } from '../view'
import API, {
  authenticated,
  GET, parameters
} from './API'

/**
 * Endpoint for user statistics and leaderboard
 */
class Statistics extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'statistics'
  }

  /**
   * Get the leaderboard
   * @endpoint
   */
  @GET('/leaderboard')
  @websocket('leaderboard')
  async leaderboard (ctx) {
    const query = new LeaderboardQuery({ connection: ctx })
    const sqlParams = query.searchObject

    const leaderboardSearch = leaderboardQuery(sqlParams.order, Boolean(sqlParams.filter.name))
    const leaderboardCountSearch = leaderboardCountQuery(Boolean(sqlParams.filter.name))

    const binds = {
      offset: sqlParams.offset,
      limit: sqlParams.limit,
    }

    const countBinds = {}

    if (sqlParams.filter.name) {
      binds.name = query.filter.name
      countBinds.name = query.filter.name
    }

    let [{ count }] = await db.query(leaderboardCountSearch, {
      bind: countBinds,
      type: db.QueryTypes.SELECT,
    })

    count = Number(count)

    let results = await db.query(leaderboardSearch, {
      bind: binds,
      type: db.QueryTypes.SELECT,
    })

    results = results.map((result) => {
      return {
        id: result.id,
        preferredName: result.preferredName,
        ratNames: result.ratNames,
        joinedAt: result.joinedAt,
        rescueCount: Number(result.rescueCount),
        codeRedCount: Number(result.codeRedCount),
        isDispatch: result.isDispatch || false,
        isEpic: result.isEpic || false,
      }
    })

    return new DatabaseDocument({
      query,
      result: {
        count,
        rows: results,
      },
      type: LeaderboardView,
    })
  }

  /**
   * Get statistics for a user
   * @endpoint
   */
  @GET('/users/:id/statistics')
  @websocket('users', 'statistics')
  @parameters('id')
  @authenticated
  async user (ctx) {
    const query = new DatabaseQuery({ connection: ctx })

    let results = await db.query(individualStatisticsQuery(), {
      bind: { userId: ctx.params.id },
      type: db.QueryTypes.SELECT,
    })

    if (results.length === 0) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    results = results.map((result) => {
      return {
        id: result.id,
        name: result.name,
        codeRed: Number(result.codeRed),
        firstLimpet: Number(result.firstLimpet),
        assists: Number(result.assists),
        failure: Number(result.failure),
        other: Number(result.other),
        invalid: Number(result.invalid),
      }
    })

    return new DatabaseDocument({ query, result: { rows: results }, type: UserStatisticsView })
  }
}

/**
 * Get the SQL query for retrieving inividual statistics
 * @returns {string}
 */
function individualStatisticsQuery () {
  return `
SELECT
	"Rats"."id" AS "id",
	"Rats"."name" AS "name",
	SUM(
		CASE WHEN "Rescues"."codeRed" = TRUE AND 
		"Rescues"."firstLimpetId" = "Rats"."id" AND 
		"outcome" = 'success' THEN 1 ELSE 0 END
	) AS "codeRed",
	SUM(CASE WHEN "Rescues"."firstLimpetId" = "Rats"."id" AND "outcome" = 'success' THEN 1 ELSE 0 END) AS "firstLimpet",
	SUM(CASE WHEN "Rescues"."firstLimpetId" != "Rats"."id" AND "outcome" = 'success' THEN 1 ELSE 0 END) AS "assists",
	SUM(CASE WHEN "outcome" = 'failure' THEN 1 ELSE 0 END) AS "failure",
	SUM(CASE WHEN "outcome" = 'other' THEN 1 ELSE 0 END) AS "other",
	SUM(CASE WHEN "outcome" = 'invalid' THEN 1 ELSE 0 END) AS "invalid"
FROM "Rats"
LEFT JOIN "RescueRats" ON "RescueRats"."ratId" = "Rats"."id"
LEFT JOIN "Rescues" ON "Rescues"."id" = "RescueRats"."rescueId"
WHERE
	"Rats"."deletedAt" IS NULL AND
	"Rescues"."deletedAt" IS NULL AND
	"Rats"."userId" = $userId
GROUP BY "Rats"."id"
`
}

/**
 * Get the SQL query for retrieving the total number of leaderboard results
 * @param {boolean} filterName Whether this query is filtered by a name
 * @returns {string} SQL query
 */
function leaderboardCountQuery (filterName = false) {
  const nameFilterQuery = `
  INNER JOIN "Rats" matchRat ON matchRat."userId" = "Users"."id" AND matchRat."name" ILIKE $name`

  const filter = filterName ? nameFilterQuery : ''

  // language=PostgreSQL
  return `
  WITH "RescueStats" AS (
	SELECT
	"Users"."id" AS "id",
	SUM(CASE WHEN 
		"Rescues"."outcome" = 'success' AND 
		"Rescues"."firstLimpetId" = "Rats"."id" 
	THEN 1 ELSE 0 END) AS "rescueCount"
	FROM "Users"
	LEFT JOIN "Rats" ON "Rats"."userId" = "Users"."id"
	LEFT JOIN "Rats" "displayRat" ON "Rats"."id" = "Users"."displayRatId"
	LEFT JOIN "RescueRats" ON "RescueRats"."ratId" = "Rats"."id"
	LEFT JOIN "Rescues" ON "Rescues"."id" = "RescueRats"."rescueId"
	${filter}
	WHERE
		"Users"."deletedAt" IS NULL AND
		"Rescues"."deletedAt" IS NULL
	GROUP BY "Users"."id"
	HAVING SUM(CASE WHEN 
		"Rescues"."outcome" = 'success' AND 
		"Rescues"."firstLimpetId" = "Rats"."id" 
	THEN 1 ELSE 0 END) > 0
  )
  SELECT
      COUNT("RescueStats"."id")
  FROM "RescueStats"
  `
}

/**
 * Get the SQL query for searching the leaderboard
 * @param {string} order SQL order query
 * @param {boolean} filterName whether this query is filtered by name
 * @returns {string} SQL query
 */
function leaderboardQuery (order, filterName = false) {
  const nameFilterQuery = `
  INNER JOIN "Rats" matchRat ON matchRat."userId" = "Users"."id" AND matchRat."name" ILIKE $name`

  const filter = filterName ? nameFilterQuery : ''

  // language=PostgreSQL
  return `
WITH "RescueStats" AS (
	SELECT
	"Users"."id" AS "id",
	COALESCE(
		(array_agg(DISTINCT "displayRat"."name"))[1],
		(array_agg(DISTINCT "Rats"."name"))[1]
	) AS "preferredName",
	array_agg(DISTINCT "Rats"."name") AS "ratNames",
	min("Rats"."joined") AS "joinedAt",
	SUM(CASE WHEN 
		"Rescues"."outcome" = 'success' AND 
		"Rescues"."firstLimpetId" = "Rats"."id" 
	THEN 1 ELSE 0 END) AS "rescueCount",
	SUM(CASE WHEN 
		"Rescues"."outcome" = 'success' AND 
		"Rescues"."codeRed" = TRUE AND 
		"Rescues"."firstLimpetId" = "Rats"."id" 
	THEN 1 ELSE 0 END) AS "codeRedCount"
	FROM "Users"
	LEFT JOIN "Rats" ON "Rats"."userId" = "Users"."id"
	LEFT JOIN "Rats" "displayRat" ON "Rats"."id" = "Users"."displayRatId"
	LEFT JOIN "RescueRats" ON "RescueRats"."ratId" = "Rats"."id"
	LEFT JOIN "Rescues" ON "Rescues"."id" = "RescueRats"."rescueId"
	${filter}
	WHERE
		"Users"."deletedAt" IS NULL AND
		"Rescues"."deletedAt" IS NULL
	GROUP BY "Users"."id"
	HAVING SUM(CASE WHEN 
		"Rescues"."outcome" = 'success' AND 
		"Rescues"."firstLimpetId" = "Rats"."id" 
	THEN 1 ELSE 0 END) > 0
)
SELECT
	"RescueStats"."id" AS "id",
	min("RescueStats"."preferredName") AS "preferredName",
	min("RescueStats"."ratNames") AS "ratNames",
	min("RescueStats"."joinedAt") as "joinedAt",
	min("RescueStats"."rescueCount") as "rescueCount",
	min("RescueStats"."codeRedCount") AS "codeRedCount",
	bool_or("Groups"."name" = 'dispatch') AS "isDispatch",
	bool_or("Epics"."approvedById" IS NOT NULL) AS "isEpic"
FROM "RescueStats"
LEFT JOIN "UserGroups" ON "UserGroups"."userId" = "RescueStats"."id"
LEFT JOIN "Groups" ON "Groups"."id" = "UserGroups"."groupId"
LEFT JOIN "EpicUsers" ON "EpicUsers"."userId" = "RescueStats"."id"
LEFT JOIN "Epics" ON "Epics"."id" = "EpicUsers"."epicId"
GROUP BY "RescueStats"."id"
ORDER BY ${order}
OFFSET $offset
LIMIT $limit
`
}

export default Statistics
