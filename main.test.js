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

describe('player login and private library integration', () => {
  async function withServer(token, run) {
    let loginCalls = 0
    const app = await main.server.constructServer(
      [
        {
          route: '/protected',
          module: async () => ({ status: 200, body: { code: 200 } }),
        },
        {
          route: '/login/cellphone',
          module: async (query) => {
            loginCalls++
            assert.strictEqual(query.phone, '13800000000')
            assert.strictEqual(query.captcha, '123456')
            return {
              status: 200,
              body: { code: 200, calls: loginCalls },
              cookie: ['MUSIC_U=mock-music-session; Path=/'],
            }
          },
        },
        {
          route: '/user/account',
          module: async (query) => {
            assert.strictEqual(query.cookie.api_token, undefined)
            return {
              status: 200,
              body: {
                code: 200,
                profile: query.cookie.MUSIC_U ? { userId: 123 } : null,
              },
            }
          },
        },
      ],
      token,
    )
    const server = app.listen(0)
    try {
      await run(`http://127.0.0.1:${server.address().port}`)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  }

  it('uses POST to log in, protects all player assets, and clears the browser login cookie', async () => {
    await withServer('test-token', async (base) => {
      const unauthenticated = await fetch(`${base}/index.html`, {
        headers: { Accept: 'text/html' },
        redirect: 'manual',
      })
      assert.strictEqual(unauthenticated.status, 302)
      assert.strictEqual(unauthenticated.headers.get('location'), '/auth')
      for (const resource of [
        '/player/app.js',
        '/player/account.js',
        '/player/style.css',
        '/api-console.html',
      ]) {
        assert.strictEqual((await fetch(base + resource)).status, 401)
      }
      const failed = await fetch(`${base}/auth`, {
        method: 'POST',
        body: new URLSearchParams({ token: 'wrong' }),
        redirect: 'manual',
      })
      assert.strictEqual(failed.status, 303)
      assert.strictEqual(failed.headers.get('location'), '/auth?error=1')
      assert.strictEqual(failed.headers.get('set-cookie'), null)
      const login = await fetch(`${base}/auth`, {
        method: 'POST',
        body: new URLSearchParams({ token: 'test-token' }),
        redirect: 'manual',
      })
      assert.strictEqual(login.status, 303)
      assert.strictEqual(login.headers.get('location'), '/')
      assert.match(login.headers.get('set-cookie'), /HttpOnly/)
      assert.match(login.headers.get('set-cookie'), /SameSite=Strict/)
      const cookie = login.headers.get('set-cookie').split(';')[0]
      const home = await fetch(`${base}/`, { headers: { Cookie: cookie } })
      assert.strictEqual(home.status, 200)
      assert.match(home.headers.get('cache-control'), /no-store/)
      assert.match(await home.text(), /登录并获取歌单/)
      assert.strictEqual(
        (
          await fetch(`${base}/player/account.js`, {
            headers: { Cookie: cookie },
          })
        ).status,
        200,
      )
      const logout = await fetch(`${base}/auth/logout`, {
        method: 'POST',
        headers: { Cookie: cookie },
      })
      assert.strictEqual(logout.status, 204)
      assert.match(logout.headers.get('set-cookie'), /api_token=;/)
      assert.match(logout.headers.get('set-cookie'), /Expires=/)
      assert.strictEqual((await fetch(`${base}/player/app.js`)).status, 401)
    })
  })

  it('rejects cross-origin login forms and marks HTTPS login cookies Secure', async () => {
    await withServer('test-token', async (base) => {
      for (const endpoint of ['/auth', '/auth/logout']) {
        const response = await fetch(base + endpoint, {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
          body: new URLSearchParams({ token: 'test-token' }),
        })
        assert.strictEqual(response.status, 403)
      }
      const response = await fetch(`${base}/auth`, {
        method: 'POST',
        headers: { 'X-Forwarded-Proto': 'https' },
        body: new URLSearchParams({ token: 'test-token' }),
        redirect: 'manual',
      })
      assert.match(response.headers.get('set-cookie'), /; Secure/)
    })
  })

  it('requires API_TOKEN to expose static pages while preserving API-only operation', async () => {
    await withServer('', async (base) => {
      assert.strictEqual((await fetch(`${base}/`)).status, 503)
      assert.strictEqual((await fetch(`${base}/index.html`)).status, 503)
      for (const resource of [
        '/%69ndex.html',
        '/player/app.js',
        '/player/account.js',
        '/api-console.html',
      ]) {
        const response = await fetch(base + resource)
        assert.notStrictEqual(response.status, 200)
        assert.doesNotMatch(
          await response.text(),
          /<title>拾音|function createClient/,
        )
      }
      assert.strictEqual((await fetch(`${base}/protected`)).status, 200)
      const login = await fetch(`${base}/auth`, {
        method: 'POST',
        body: new URLSearchParams({ token: 'anything' }),
      })
      assert.strictEqual(login.status, 503)
      assert.strictEqual(login.headers.get('set-cookie'), null)
    })
  })

  it('carries music login cookies into account requests and never caches login responses', async () => {
    await withServer('test-token', async (base) => {
      const headers = { Cookie: 'api_token=test-token' }
      const signIn = (suffix = '') =>
        fetch(`${base}/login/cellphone${suffix}`, {
          method: 'POST',
          headers,
          body: new URLSearchParams({
            phone: '13800000000',
            captcha: '123456',
          }),
        })
      const first = await signIn()
      assert.strictEqual((await first.json()).calls, 1)
      assert.match(first.headers.get('cache-control'), /no-store/)
      assert.match(first.headers.get('set-cookie'), /HttpOnly/)
      const second = await signIn('/')
      assert.strictEqual((await second.json()).calls, 2)
      const third = await signIn('/')
      assert.strictEqual((await third.json()).calls, 3)
      const account = await fetch(`${base}/user/account`, {
        headers: { Cookie: 'api_token=test-token; MUSIC_U=mock-music-session' },
      })
      assert.strictEqual((await account.json()).profile.userId, 123)
      const anonymous = await fetch(`${base}/user/account`, { headers })
      assert.strictEqual((await anonymous.json()).profile, null)
    })
  })
})

describe('methods in module', () => {
  it('has activate_init_profile', () => {
    assert.strictEqual(typeof main.activate_init_profile, 'function')
  })
})
