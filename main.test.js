const assert = require('assert')
const main = require('./main')

describe('methods in server.js', () => {
  it('has serveNcmApi', () => {
    assert.strictEqual(typeof main.serveNcmApi, 'function')
  })

  it('has getModulesDefinitions', () => {
    assert.strictEqual(typeof main.getModulesDefinitions, 'function')
  })

  it('requires the configured token for API and page requests', async () => {
    const app = await main.server.constructServer(
      [
        {
          route: '/protected',
          module: async () => ({ status: 200, body: { code: 200 } }),
        },
      ],
      'test-token',
    )
    const server = app.listen(0)
    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}`

    try {
      const unauthorizedApi = await fetch(`${baseUrl}/protected`)
      assert.strictEqual(unauthorizedApi.status, 401)
      assert.deepStrictEqual(await unauthorizedApi.json(), {
        code: 401,
        msg: 'Unauthorized',
      })

      const loginPage = await fetch(`${baseUrl}/`, {
        headers: { Accept: 'text/html' },
      })
      assert.strictEqual(loginPage.url, `${baseUrl}/auth`)
      assert.match(loginPage.headers.get('content-type'), /^text\/html\b/)
      assert.match(await loginPage.text(), /請輸入管理員提供的訪問令牌/)

      const authorizedApi = await fetch(`${baseUrl}/protected`, {
        headers: { Authorization: 'Bearer test-token' },
      })
      assert.strictEqual(authorizedApi.status, 200)

      const authorizedPage = await fetch(`${baseUrl}/?token=test-token`, {
        headers: { Accept: 'text/html' },
        redirect: 'manual',
      })
      assert.strictEqual(authorizedPage.status, 303)
      assert.strictEqual(authorizedPage.headers.get('location'), '/')
      assert.match(
        authorizedPage.headers.get('set-cookie'),
        /api_token=test-token/,
      )
      const homePage = await fetch(`${baseUrl}/`, {
        headers: {
          Accept: 'text/html',
          Cookie: 'api_token=test-token',
        },
      })
      assert.strictEqual(homePage.status, 200)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })
})

describe('methods in module', () => {
  it('has activate_init_profile', () => {
    assert.strictEqual(typeof main.activate_init_profile, 'function')
  })
})
