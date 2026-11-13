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
