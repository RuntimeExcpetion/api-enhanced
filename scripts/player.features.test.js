const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const express = require('express')
const { Readable } = require('node:stream')
const { buildCatalog } = require('./generate-player-catalog')
const {
  audioUrl,
  filename,
  createDownloadHandler,
} = require('../util/player-download')
const {
  extractSongs,
  redacted,
  payload,
} = require('../public/player/capabilities')

test('catalog covers every project module and documented route, with explicit legacy mappings', () => {
  const catalog = buildCatalog(),
    saved = require('../public/player/catalog.json')
  assert.deepEqual(catalog, saved)
  const modules = fs
    .readdirSync(path.join(__dirname, '../module'))
    .filter((name) => name.endsWith('.js'))
  assert.equal(catalog.moduleCount, modules.length)
  const exposed = new Set(
    catalog.endpoints
      .filter((entry) => entry.supported)
      .map((entry) => entry.module),
  )
  for (const module of modules) assert.ok(exposed.has(module), module)
  assert.equal(
    new Set(catalog.endpoints.map((entry) => entry.route)).size,
    catalog.endpoints.length,
  )
  const docs = fs.readFileSync(
    path.join(__dirname, '../public/docs/home.md'),
    'utf8',
  )
  for (const line of docs
    .split('\n')
    .filter((item) => /接口地址|接口路径/.test(item))) {
    for (const match of line.matchAll(/`(\/[\w/.-]+)(?:\?[^`]*)?`/g))
      assert.ok(
        catalog.endpoints.some((entry) => entry.route === match[1]),
        match[1],
      )
  }
  assert.equal(
    catalog.endpoints.find((entry) => entry.route === '/vip/task/v1')
      .requestRoute,
    '/vip/tasks/v1',
  )
  assert.equal(
    catalog.endpoints.find((entry) => entry.route === '/comment/hotwall/list')
      .supported,
    false,
  )
  assert.ok(
    catalog.endpoints
      .find((entry) => entry.route === '/cloud')
      .params.some((param) => param.name === 'songFile' && param.file),
  )
  assert.ok(
    catalog.endpoints
      .find((entry) => entry.route === '/playlist/cover/update')
      .params.some((param) => param.name === 'imgFile' && param.file),
  )
  assert.equal(
    catalog.endpoints.find((entry) => entry.route === '/playlist/delete')
      .mutating,
    true,
  )
  assert.equal(
    catalog.endpoints.find((entry) => entry.route === '/comment/music')
      .mutating,
    false,
  )
})

test('capability results identify playable songs and redact nested credentials', () => {
  const song = { id: 1, name: 'Test', ar: [{ name: 'Artist' }] }
  assert.deepEqual(extractSongs({ result: { songs: [song] } }), [song])
  assert.deepEqual(extractSongs({ playlist: { tracks: [song] } }), [song])
  assert.deepEqual(extractSongs({ result: [{ song }] }), [song])
  assert.deepEqual(extractSongs(null), [])
  const text = redacted({
    cookie: 'secret-cookie',
    data: { MUSIC_U: 'private', name: 'Visible' },
  })
  assert.doesNotMatch(text, /secret-cookie|private/)
  assert.match(text, /Visible/)
})

test('capability parameter payload supports JSON, form overrides, uploads, and validation', () => {
  const file = { name: 'track.mp3', size: 123 }
  assert.deepEqual(
    payload(
      [
        { name: 'id', value: '9' },
        { name: 'blank', value: '' },
        { name: 'songFile', file },
      ],
      '{"id":"1","limit":10}',
    ),
    { params: { id: '9', limit: 10 }, files: [{ name: 'songFile', file }] },
  )
  assert.throws(() => payload([], '{'), /JSON/)
  assert.throws(() => payload([], '[]'), /JSON 对象/)
  assert.throws(() => payload([], 'null'), /JSON 对象/)
})

test('download addresses only permit official audio CDN URLs and safe filenames', () => {
  assert.equal(
    audioUrl('http://m801.music.126.net/test.mp3'),
    'https://m801.music.126.net/test.mp3',
  )
  for (const url of [
    'https://example.com/a.mp3',
    'https://music.126.net.evil.com/a.mp3',
    'https://127.0.0.1/a.mp3',
    'https://user:pass@m801.music.126.net/a.mp3',
    'https://m801.music.126.net:8080/a.mp3',
    'file:///etc/passwd',
  ])
    assert.throws(() => audioUrl(url))
  assert.equal(
    filename('Song\r\nBad/Name', '1', 'FLAC').name,
    'Song__Bad_Name.flac',
  )
  assert.equal(filename('Song', '1', 'html').extension, 'mp3')
  assert.doesNotThrow(() =>
    encodeURIComponent(filename('Broken\ud800', '1', 'mp3').name),
  )
})

async function withDownload(options, run) {
  const app = express()
  app.use((req, _, next) => {
    req.cookies = { MUSIC_U: 'test-account' }
    next()
  })
  app.get('/download', createDownloadHandler(options))
  const server = app.listen(0)
  try {
    await run(`http://127.0.0.1:${server.address().port}/download`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('streams an authorized download with correct bytes and attachment filename', async () => {
  const bytes = Buffer.from('mock-audio-file')
  await withDownload(
    {
      resolveSong: async (query) => {
        assert.deepEqual(query, {
          id: '123',
          level: 'lossless',
          cookie: { MUSIC_U: 'test-account' },
        })
        return {
          body: {
            data: { url: 'http://m801.music.126.net/test.flac', type: 'flac' },
          },
        }
      },
      openStream: async (url) => {
        assert.equal(url, 'https://m801.music.126.net/test.flac')
        return {
          data: Readable.from([bytes]),
          headers: {
            'content-type': 'audio/flac',
            'content-length': String(bytes.length),
          },
        }
      },
    },
    async (url) => {
      const response = await fetch(
        url + '?id=123&level=lossless&title=%E6%B5%8B%E8%AF%95',
      )
      assert.equal(response.status, 200)
      assert.match(
        response.headers.get('content-disposition'),
        /filename\*=UTF-8''%E6%B5%8B%E8%AF%95.flac/,
      )
      assert.match(response.headers.get('cache-control'), /no-store/)
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
    },
  )
})

test('download rejects invalid input, missing permissions, and third-party sources before opening streams', async () => {
  let resolveCalls = 0,
    openCalls = 0
  await withDownload(
    {
      resolveSong: async () => {
        resolveCalls++
        return { body: { data: { url: null } } }
      },
      openStream: async () => {
        openCalls++
      },
    },
    async (url) => {
      assert.equal((await fetch(url + '?id=bad')).status, 400)
      assert.equal((await fetch(url + '?id=123&level=unknown')).status, 400)
      assert.equal(resolveCalls, 0)
      const response = await fetch(url + '?id=123')
      assert.equal(response.status, 403)
      assert.match((await response.json()).message, /下载权限/)
      assert.equal(openCalls, 0)
    },
  )
  await withDownload(
    {
      resolveSong: async () => ({
        body: { data: { url: 'https://example.com/a.mp3' } },
      }),
      openStream: async () => {
        openCalls++
      },
    },
    async (url) => {
      assert.equal((await fetch(url + '?id=123')).status, 502)
      assert.equal(openCalls, 0)
    },
  )
})

test('partial previews and non-audio upstream responses cannot be saved as full songs', async () => {
  await withDownload(
    {
      resolveSong: async () => ({
        body: {
          data: {
            url: 'https://m801.music.126.net/a.mp3',
            freeTrialInfo: { end: 30 },
          },
        },
      }),
      openStream: async () => {
        throw new Error('should not run')
      },
    },
    async (url) => assert.equal((await fetch(url + '?id=123')).status, 403),
  )
  await withDownload(
    {
      resolveSong: async () => ({
        body: { data: { url: 'https://m801.music.126.net/a.mp3' } },
      }),
      openStream: async () => ({
        data: Readable.from(['<html>Error</html>']),
        headers: { 'content-type': 'text/html' },
      }),
    },
    async (url) => {
      const response = await fetch(url + '?id=123')
      assert.equal(response.status, 502)
      assert.match((await response.json()).message, /音频文件/)
    },
  )
})

test('serverless-friendly downloads resolve a ticket once and stream bounded ranges', async () => {
  const size = 2 * 1024 * 1024 + 19,
    bytes = Buffer.alloc(size, 7)
  let resolves = 0
  await withDownload(
    {
      signingSecret: 'fixed-download-key',
      resolveSong: async () => {
        resolves++
        return {
          body: {
            data: {
              url: 'https://m801.music.126.net/song.flac',
              type: 'flac',
              size,
              level: 'jymaster',
            },
          },
        }
      },
      openStream: async (_, signal, range) => {
        assert.equal(signal.aborted, false)
        const match = range.match(/^bytes=(\d+)-(\d+)$/),
          start = Number(match[1]),
          end = Number(match[2])
        assert.ok(end - start + 1 <= 1024 * 1024)
        return {
          status: 206,
          data: Readable.from([bytes.subarray(start, end + 1)]),
          headers: {
            'content-type': 'audio/flac',
            'content-range': `bytes ${start}-${end}/${size}`,
          },
        }
      },
    },
    async (url) => {
      const infoResponse = await fetch(
        url + '?mode=info&id=346085&level=jymaster',
      )
      const info = await infoResponse.json()
      assert.equal(info.rangeSupported, true)
      assert.equal(info.size, size)
      assert.equal(info.level, 'jymaster')
      const chunks = []
      for (let start = 0; start < size; start += info.chunkSize) {
        const end = Math.min(start + info.chunkSize - 1, size - 1)
        const response = await fetch(url, {
          headers: {
            'X-Download-Ticket': info.ticket,
            Range: `bytes=${start}-${end}`,
          },
        })
        assert.equal(response.status, 206)
        assert.equal(
          response.headers.get('content-range'),
          `bytes ${start}-${end}/${size}`,
        )
        chunks.push(Buffer.from(await response.arrayBuffer()))
      }
      assert.deepEqual(Buffer.concat(chunks), bytes)
      assert.equal(resolves, 1)
      assert.equal(
        (
          await fetch(url, {
            headers: {
              'X-Download-Ticket': info.ticket,
              Range: `bytes=0-${2 * 1024 * 1024}`,
            },
          })
        ).status,
        416,
      )
    },
  )
})

test('expired download tickets are rejected before an upstream file is opened', async () => {
  let time = 1000,
    streams = 0
  await withDownload(
    {
      signingSecret: 'expiry-key',
      now: () => time,
      resolveSong: async () => ({
        body: {
          data: {
            url: 'https://m801.music.126.net/a.flac',
            type: 'flac',
            size: 10,
          },
        },
      }),
      openStream: async () => {
        streams++
        return {
          status: 206,
          data: Readable.from([Buffer.from('a')]),
          headers: { 'content-range': 'bytes 0-0/10' },
        }
      },
    },
    async (url) => {
      const info = await (await fetch(url + '?mode=info&id=1')).json()
      time += 16 * 60 * 1000
      const response = await fetch(url, {
        headers: { 'X-Download-Ticket': info.ticket, Range: 'bytes=0-9' },
      })
      assert.equal(response.status, 410)
      assert.equal(streams, 1)
    },
  )
})
