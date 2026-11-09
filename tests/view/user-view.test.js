/* global describe, it, expect */
import { BadRequestAPIError } from '../../src/classes/APIError'
import DatabaseQuery from '../../src/query/DatabaseQuery'
import UserView from '../../src/view/UserView'

const STAFF_ID = '4c0f9a5e-2b7d-4e61-9a43-7d1e5c8b2f90'

const connection = (permissions) => {
  return {
    state: {
      user: { id: STAFF_ID },
      permissions,
    },
  }
}

const listQuery = (permissions, include) => {
  return new DatabaseQuery({
    connection: {
      ...connection(permissions),
      query: {
        sort: '-createdAt',
        include,
        'page[offset]': '0',
        'page[limit]': '25',
        filter: '{}',
      },
    },
    view: UserView,
  })
}

describe('UserView without an object (collection query validation)', () => {
  it('lists relationships for a signed-in staff member', () => {
    const view = new UserView({ object: undefined, query: { connection: connection(['users.read']) } })
    expect(Object.keys(view.relationships)).toContain('authenticator')
  })

  it('omits authenticator for a signed-in user without users.read', () => {
    const view = new UserView({ object: undefined, query: { connection: connection(['users.read.me']) } })
    expect(Object.keys(view.relationships)).not.toContain('authenticator')
  })

  it('accepts include=rats,groups on the user list', () => {
    expect(() => listQuery(['users.read'], 'rats,groups').assertValidQuery()).not.toThrow()
  })

  it('rejects include=authenticator without users.read', () => {
    expect(() => listQuery(['users.read.me'], 'authenticator').assertValidQuery()).toThrow(BadRequestAPIError)
  })
})
