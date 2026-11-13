const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  normalizeSong,
  safeImage,
  parseLyrics,
  lyricIndex,
  nextIndex,
  formatTime,
} = require('../public/player/core.js')
test('normalizes search and recommendation API payloads', () => {
  assert.deepEqual(
    normalizeSong({
      id: 12,
      name: '<unsafe>',
      ar: [{ name: 'A' }, { name: 'B' }],
      al: { name: 'Album', picUrl: 'http://example.com/a.jpg' },
      dt: 61000,
    }),
    {
      id: '12',
      title: '<unsafe>',
      artist: 'A / B',
      album: 'Album',
      cover: 'https://example.com/a.jpg',
      duration: 61,
    },
  )
  assert.equal(
    normalizeSong({
      id: 2,
      artists: [{ name: 'C' }],
      album: { name: 'D' },
      duration: 120000,
    }).duration,
    120,
  )
  assert.equal(safeImage('javascript:alert(1)'), '')
})
test('LRC supports repeated timestamps, decimals, metadata, and unordered lines', () => {
  const lines = parseLyrics(
    '[ar:Artist]\n[00:10.25][01:00.5]hello\n[00:02]world\n[00:03.000]\n',
  )
  assert.deepEqual(lines, [
    { time: 2, text: 'world' },
    { time: 10.25, text: 'hello' },
    { time: 60.5, text: 'hello' },
  ])
  assert.equal(lyricIndex(lines, 1), -1)
  assert.equal(lyricIndex(lines, 10.25), 1)
  assert.equal(lyricIndex(lines, 100), 2)
})
test('queue wraps and shuffle never immediately repeats with multiple tracks', () => {
  assert.equal(nextIndex(0, 0, 1, false), -1)
  assert.equal(nextIndex(3, 0, -1, false), 2)
  assert.equal(nextIndex(3, 2, 1, false), 0)
  for (let i = 0; i < 5; i++)
    for (const value of [0, 0.25, 0.5, 0.99999])
      assert.notEqual(
        nextIndex(5, i, 1, true, () => value),
        i,
      )
  assert.equal(nextIndex(1, 0, 1, true), 0)
})
test('formats unknown duration safely', () => {
  assert.equal(formatTime(Infinity), '0:00')
  assert.equal(formatTime(-1), '0:00')
  assert.equal(formatTime(125.9), '2:05')
})
