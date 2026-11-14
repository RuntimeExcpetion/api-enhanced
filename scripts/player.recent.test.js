const { test } = require('node:test')
const assert = require('node:assert/strict')
const { recentSongs, recentTime } = require('../public/player/visual-core')
const { normalizeSong } = require('../public/player/core')

test('cloud recent records unwrap song data and keep the server playback timestamps', () => {
  const result = {
    code: 200,
    data: {
      total: 2,
      list: [
        {
          resourceId: 1,
          playTime: 1700000000000,
          data: {
            id: 1,
            name: 'Song One',
            ar: [{ name: 'Artist' }],
            al: { name: 'Album' },
            dt: 180000,
          },
        },
        {
          resourceId: 2,
          playTime: 1700000100000,
          data: { id: 2, name: 'Song Two', ar: [], al: {}, dt: 120000 },
        },
      ],
    },
  }
  const songs = recentSongs(result, normalizeSong)
  assert.deepEqual(
    songs.map((song) => song.id),
    ['2', '1'],
  )
  assert.equal(songs[0].playedAt, 1700000100000)
  assert.equal(songs[1].artist, 'Artist')
  assert.equal(songs[1].duration, 180)
})

test('duplicate cloud entries stay as separate plays and malformed records do not become songs', () => {
  const songs = recentSongs(
    {
      data: {
        list: [
          null,
          { data: null },
          { data: { id: 9 } },
          { playTime: 1700000000000, data: { id: 1, name: 'Song' } },
          { playTime: 1700000300000, data: { id: 1, name: 'Song' } },
          {
            resourceId: 2,
            resourceName: 'Fallback title',
            data: {},
            playTime: 0,
          },
        ],
      },
    },
    normalizeSong,
  )
  assert.equal(songs.length, 3)
  assert.equal(songs[0].playedAt, 1700000300000)
  assert.equal(songs[1].id, '1')
  assert.equal(songs[1].playedAt, 1700000000000)
  assert.equal(songs[2].title, 'Fallback title')
  assert.equal(songs[2].playedAt, 0)
  assert.deepEqual(recentSongs({ data: { list: {} } }, normalizeSong), [])
})

test('recent time formatting supports missing times, epoch seconds and explicit time zones', () => {
  const songs = recentSongs(
    {
      list: [
        { data: { id: 1, name: 'Seconds' }, playTime: 1700000000 },
        { data: { id: 2, name: 'Invalid' }, playTime: 'not-a-time' },
      ],
    },
    normalizeSong,
  )
  assert.equal(songs[0].playedAt, 1700000000000)
  assert.equal(songs[1].playedAt, 0)
  assert.match(recentTime(1700000000000, 'Asia/Shanghai'), /2023/)
  assert.equal(recentTime(0), '未提供播放时间')
})

test('recent summary distinguishes server count, usable records, repeated songs and upstream total', () => {
  const { recentSummary } = require('../public/player/visual-core')
  const result = {
    data: {
      total: 100,
      list: [
        { data: { id: 1, name: 'Song' } },
        { data: { id: 1, name: 'Song' } },
        null,
      ],
    },
  }
  assert.deepEqual(recentSummary(result, recentSongs(result, normalizeSong)), {
    returned: 3,
    displayed: 2,
    unique: 1,
    total: 100,
    unavailable: 1,
  })
  const fourteen = {
    data: {
      list: Array.from({ length: 14 }, (_, id) => ({
        data: { id, name: 'Song ' + id },
      })),
    },
  }
  assert.deepEqual(
    recentSummary(fourteen, recentSongs(fourteen, normalizeSong)),
    { returned: 14, displayed: 14, unique: 14, total: null, unavailable: 0 },
  )
})
