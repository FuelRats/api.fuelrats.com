import API, { GET, authenticated } from './API'
import { websocket } from '../classes/WebSocket'
import { db } from '../db'
import { AnniversaryView } from '../view'
import Anope from '../classes/Anope'
import DatabaseDocument from '../Documents/DatabaseDocument'
import DatabaseQuery from '../query/DatabaseQuery'


/**
 * Endpoints for listing rat anniversaries
 */
export default class Anniversaries extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'anniversaries'
  }

  /**
   * List anniversaries for today
   * @endpoint
   */
  @GET('/anniversaries')
  @websocket('anniversaries', 'list')
  @authenticated
  async list (ctx) {
    const results = await db.query(anniversaryQuery, {
      type: db.QueryTypes.SELECT
    })

    let result = {
      count: undefined,
      rows: results
    }

    result = await Anope.mapNicknames(result)
    const query = new DatabaseQuery({ connection: ctx })

    return new DatabaseDocument({
      query,
      result,
      type: AnniversaryView
    })
  }
}

const anniversaryQuery = `
SELECT
	"Users"."id" AS "id",
	"Users"."email" AS "email",
	COALESCE(
		(array_agg(DISTINCT "displayRat"."name"))[1],
		(array_agg(DISTINCT "Rats"."name"))[1]
	) AS "preferredName",
	EXTRACT(YEAR FROM NOW()) - EXTRACT(YEAR FROM min("Rats"."joined")) AS "years",
	min("Rats"."joined") AS "joined"
FROM "Users"
LEFT JOIN "Rats" ON "Users"."id" = "Rats"."userId"
LEFT JOIN "Rats" "displayRat" ON "Rats"."id" = "Users"."displayRatId"
WHERE
	"Rats"."deletedAt" IS NULL AND
	"Users"."deletedAt" IS NULL AND
	EXTRACT(DAY FROM "Rats"."joined") = EXTRACT(DAY from NOW()) AND
	EXTRACT(MONTH FROM "Rats"."joined") = EXTRACT(MONTH from NOW())
GROUP BY "Users"."id"
HAVING
	EXTRACT(YEAR FROM NOW()) != EXTRACT(YEAR FROM min("Rats"."joined")) AND
	EXTRACT(DAY FROM min("Rats"."joined")) = EXTRACT(DAY from NOW()) AND
	EXTRACT(MONTH FROM min("Rats"."joined")) = EXTRACT(MONTH from NOW())
ORDER BY min("Rats"."joined")
`
