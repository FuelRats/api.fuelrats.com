import config from '../config'

/**
 *
 */
export default class Jira {
  /**
   * @param {string} username the username to set the email address for
   * @param {string} newEmail the new email address to set
   * @returns {Promise<object>} a promise that resolves to the response from the Jira API
   */
  static async setEmail (username, newEmail) {
    if (!config.jira.username || !config.jira.password) {
      return
    }

    const auth = Buffer.from(`${config.jira.username}:${config.jira.password}`).toString('base64')
    await fetch(`${config.jira.url}/rest/api/2/user?username=${username}`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emailAddress: newEmail,
      }),
    })
  }
}
