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

test('duplicate cloud entries keep the newest occurrence and malformed records do not become songs', () => {
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
  assert.equal(songs.length, 2)
  assert.equal(songs[0].playedAt, 1700000300000)
  assert.equal(songs[1].title, 'Fallback title')
  assert.equal(songs[1].playedAt, 0)
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
