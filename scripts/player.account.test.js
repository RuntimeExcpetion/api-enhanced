const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createClient } = require('../public/player/account.js')
const { normalizeSong } = require('../public/player/core.js')
const profile = { userId: 123, nickname: 'Test' }
function make(api, extra = {}) {
  return createClient({ api, normalizeSong, sameOrigin: () => true, ...extra })
}
test('phone SMS login uses POST and correct country code, rejects invalid input', async () => {
  const calls = []
  const client = make(async (...args) => {
    calls.push(args)
    return args[0] === '/captcha/sent'
      ? { code: 200, data: true }
      : { code: 200, profile }
  })
  await assert.rejects(client.sendCaptcha('abc', '86'), /手机号/)
  await client.sendCaptcha('13800000000', '86')
  assert.deepEqual(calls[0], [
    '/captcha/sent',
    { phone: '13800000000', ctcode: '86' },
    { method: 'POST', private: true },
  ])
  await assert.rejects(client.signIn('13800000000', '86', 'abc'), /验证码/)
  await client.signIn('13800000000', '86', '123456')
  assert.equal(client.state.profile.userId, 123)
  assert.deepEqual(calls[1], [
    '/login/cellphone',
    { phone: '13800000000', countrycode: '86', captcha: '123456' },
    { method: 'POST', private: true },
  ])
})
test('requires same-origin API and a logged-in account for private library calls', async () => {
  let requests = 0
  const client = make(
    async () => {
      requests++
      return {}
    },
    { sameOrigin: () => false },
  )
  await assert.rejects(client.sendCaptcha('13800000000', '86'), /同站 API/)
  await assert.rejects(client.playlists(), /同站 API/)
  assert.equal(requests, 0)
  await assert.rejects(make(async () => ({})).playlists(), /请先/)
})
test('restores cookie session, paginates playlists and tracks, and loads daily recommendations', async () => {
  const calls = [],
    lists = [{ id: 1, name: 'Favorites', specialType: 5, trackCount: 101 }]
  const client = make(async (path, params) => {
    calls.push([path, params])
    if (path === '/user/account') return { code: 200, profile }
    if (path === '/user/playlist')
      return {
        code: 200,
        more: params.offset === 0,
        playlist: params.offset === 0 ? lists : [{ id: 2, name: 'Saved' }],
      }
    if (path === '/playlist/track/all')
      return {
        code: 200,
        songs: Array.from({ length: params.offset ? 1 : 100 }, (_, i) => ({
          id: i + params.offset,
          name: `Track ${i}`,
          ar: [],
          al: {},
          dt: 1000,
        })),
      }
    if (path === '/recommend/songs')
      return { code: 200, data: { dailySongs: [{ id: 200, name: 'Daily' }] } }
  })
  await client.restore()
  await client.playlists()
  assert.equal(client.state.morePlaylists, true)
  await client.playlists(true)
  assert.equal(client.state.playlists.length, 2)
  assert.equal(client.state.morePlaylists, false)
  assert.deepEqual(calls[2][1], { uid: 123, offset: 1, limit: 100 })
  await client.tracks(lists[0])
  assert.equal(client.state.songs.length, 100)
  assert.equal(client.state.moreTracks, true)
  await client.tracks(lists[0], true)
  assert.equal(client.state.songs.length, 101)
  assert.equal(client.state.moreTracks, false)
  assert.equal(calls[4][1].offset, 100)
  await client.daily()
  assert.equal(client.state.songs[0].id, '200')
  assert.equal(client.state.active.id, 'daily')
})
test('logout and account expiration clear profile and private library state', async () => {
  let expired = false
  const client = make(async (path) => {
    if (path === '/user/account') return { profile }
    if (expired) {
      const error = new Error('Not logged in')
      error.code = 301
      throw error
    }
    return { code: 200, playlist: [{ id: 1 }] }
  })
  await client.restore()
  await client.playlists()
  await client.signOut()
  assert.equal(client.state.profile, null)
  assert.deepEqual(client.state.playlists, [])
  await client.restore()
  expired = true
  await assert.rejects(client.playlists(), /登录已失效/)
  assert.equal(client.state.profile, null)
})
test('late responses after reset or navigation cannot restore private data or replace the active playlist', async () => {
  let resolve
  const client = make((path) => {
    if (path === '/user/account') return Promise.resolve({ profile })
    return new Promise((done) => {
      resolve = done
    })
  })
  await client.restore()
  const pending = client.playlists()
  client.reset()
  resolve({ playlist: [{ id: 1 }], more: true })
  await pending
  assert.equal(client.state.profile, null)
  assert.deepEqual(client.state.playlists, [])
  await client.restore()
  const tracks = client.tracks({ id: 1, name: 'Old' })
  client.cancelPlaylist()
  resolve({ songs: [{ id: 1 }] })
  assert.equal(await tracks, null)
  assert.equal(client.state.active, null)
})
test('QR sign-in generates a PNG and handles waiting, scanned, authorized, and expired states', async () => {
  const calls = [],
    statuses = [801, 802, 803]
  const client = make(async (...args) => {
    calls.push(args)
    if (args[0] === '/login/qr/key')
      return { code: 200, data: { unikey: 'test-key' } }
    if (args[0] === '/login/qr/create')
      return { code: 200, data: { qrimg: 'data:image/png;base64,dGVzdA==' } }
    if (args[0] === '/login/qr/check') return { code: statuses.shift() || 800 }
    if (args[0] === '/user/account') return { code: 200, profile }
  })
  assert.deepEqual(await client.createQR(), {
    image: 'data:image/png;base64,dGVzdA==',
  })
  assert.deepEqual(calls[1][1], { key: 'test-key', qrimg: true })
  assert.equal((await client.checkQR()).code, 801)
  assert.equal((await client.checkQR()).code, 802)
  assert.equal(client.state.profile, null)
  assert.equal((await client.checkQR()).code, 803)
  assert.equal(client.state.profile.userId, 123)
  assert.equal(await client.checkQR(), null)
  assert.deepEqual(calls[2][2], {
    method: 'POST',
    private: true,
    allowedCodes: [800, 801, 802, 803],
  })
  await client.createQR()
  assert.equal((await client.checkQR()).code, 800)
  assert.equal(await client.checkQR(), null)
})
test('QR refresh and cancel ignore stale keys and authorization responses', async () => {
  let done
  const client = make(async (path) => {
    if (path === '/login/qr/key')
      return new Promise((resolve) => {
        done = resolve
      })
    if (path === '/login/qr/create')
      return { data: { qrimg: 'data:image/png;base64,dGVzdA==' } }
    if (path === '/login/qr/check')
      return new Promise((resolve) => {
        done = resolve
      })
    if (path === '/user/account') return { profile }
  })
  const oldQR = client.createQR()
  client.stopQR()
  done({ data: { unikey: 'stale' } })
  assert.equal(await oldQR, null)
  const freshQR = client.createQR()
  done({ data: { unikey: 'fresh' } })
  await freshQR
  const check = client.checkQR()
  client.reset()
  done({ code: 803 })
  assert.equal(await check, null)
  assert.equal(client.state.profile, null)
})
test('QR generation rejects unexpected images and check rejects missing status', async () => {
  const client = make(async (path) =>
    path === '/login/qr/key'
      ? { data: { unikey: 'key' } }
      : { data: { qrimg: 'javascript:alert(1)' } },
  )
  await assert.rejects(client.createQR(), /二维码生成失败/)
  const invalidStatus = make(async (path) => {
    if (path === '/login/qr/key') return { data: { unikey: 'key' } }
    if (path === '/login/qr/create')
      return { data: { qrimg: 'data:image/png;base64,dGVzdA==' } }
    return {}
  })
  await invalidStatus.createQR()
  await assert.rejects(invalidStatus.checkQR(), /扫码状态/)
})
test('QR API preserves upstream failures instead of throwing an undefined-result error', async () => {
  const qrCheck = require('../module/login_qr_check.js')
  const error = { status: 502, body: { code: 502, message: 'Network failure' } }
  await assert.rejects(
    qrCheck({ key: 'key' }, async () => {
      throw error
    }),
    (received) => received === error,
  )
  const result = await qrCheck({ key: 'key' }, async () => ({
    body: { code: 803 },
    cookie: ['MUSIC_U=test'],
  }))
  assert.equal(result.body.code, 803)
  assert.deepEqual(result.cookie, ['MUSIC_U=test'])
})
test('an older session restore cannot overwrite a newly completed phone login', async () => {
  let finishRestore
  const client = make(async (path) => {
    if (path === '/user/account')
      return new Promise((resolve) => {
        finishRestore = resolve
      })
    if (path === '/login/cellphone') return { code: 200, profile }
  })
  const restore = client.restore()
  await client.signIn('13800000000', '86', '123456')
  finishRestore({ code: 200, profile: null })
  await restore
  assert.equal(client.state.profile.userId, 123)
})
