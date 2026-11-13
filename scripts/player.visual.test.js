const { test } = require('node:test')
const assert = require('node:assert/strict')
const { chroma } = require('../public/player/stage')
const V = require('../public/player/visual-core')
const { downloadChunks } = require('../public/player/download-engine')
const { ticketCodec } = require('../util/player-download')

test('twelve-note display follows real frequency bins and handles silence', () => {
  const bins = new Uint8Array(4096),
    rate = 44100,
    fft = 8192
  bins[Math.round((440 * fft) / rate)] = 255
  const a = chroma(bins, rate, fft)
  assert.equal(a.index, 9)
  assert.ok(Math.abs(a.frequency - 440) < 5)
  bins.fill(0)
  bins[Math.round((261.63 * fft) / rate)] = 255
  assert.equal(chroma(bins, rate, fft).index, 0)
  bins.fill(0)
  assert.equal(chroma(bins, rate, fft).strength, 0)
})
test('resource actions use named pickers rather than editable raw identifiers', () => {
  const playlist = V.spec({
    route: '/playlist/tracks',
    title: '收藏单曲到歌单',
    supported: true,
    params: [{ name: 'pid' }, { name: 'tracks' }, { name: 'op' }],
  })
  assert.equal(playlist.fields.find((x) => x.name === 'pid').entity, 'playlist')
  assert.equal(playlist.fields.find((x) => x.name === 'tracks').entity, 'song')
  assert.equal(playlist.fields.find((x) => x.name === 'tracks').multiple, true)
  assert.ok(
    playlist.fields
      .find((x) => x.name === 'op')
      .options.some((x) => x[1] === '添加'),
  )
  assert.equal(
    V.spec({
      route: '/login/qr/check',
      title: '扫码状态',
      supported: true,
      params: [{ name: 'key' }],
    }).internal,
    true,
  )
})
test('visual content classification recognizes albums, artists, cloud music and conversations', () => {
  assert.equal(V.kind({ id: 1, name: 'Playlist', trackCount: 5 }), 'playlist')
  assert.equal(
    V.kind({
      id: 2,
      name: 'Album',
      picUrl: 'https://example.com/a',
      artist: { name: 'Singer' },
    }),
    'album',
  )
  assert.equal(
    V.kind({ songId: 3, fileName: 'song.flac', simpleSong: { id: 3 } }),
    'cloud',
  )
  assert.equal(
    V.kind({ fromUser: { userId: 5 }, msg: 'hello' }),
    'conversation',
  )
  assert.equal(V.kind({ commentId: 7, content: 'Nice' }), 'comment')
  assert.deepEqual(
    V.records({ data: { dailySongs: [{ id: 1, name: 'song', ar: [] }] } }).map(
      (x) => x.id,
    ),
    [1],
  )
})
test('playlist editing safely serializes quotes and newlines', async () => {
  const update = require('../module/playlist_update')
  let submitted
  await update(
    {
      id: 9,
      name: 'A "quoted" title',
      desc: 'line1\nline2',
      tags: '夜晚;轻音乐',
    },
    async (_, data) => {
      submitted = data
      return { status: 200, body: { code: 200 } }
    },
  )
  assert.equal(
    JSON.parse(submitted['/api/playlist/update/name']).name,
    'A "quoted" title',
  )
  assert.equal(
    JSON.parse(submitted['/api/playlist/desc/update']).desc,
    'line1\nline2',
  )
})
test('small range downloads retry an interrupted chunk and assemble bytes in order', async () => {
  const source = Buffer.from('abcdefghijklmnop'),
    attempts = new Map(),
    progress = []
  const blob = await downloadChunks(
    { size: source.length, chunkSize: 4, contentType: 'audio/flac' },
    async (_, start, end) => {
      attempts.set(start, (attempts.get(start) || 0) + 1)
      if (start === 4 && attempts.get(start) === 1)
        throw new TypeError('connection closed after headers')
      const bytes = source.subarray(start, end + 1)
      return {
        status: 206,
        arrayBuffer: async () =>
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
      }
    },
    {
      signal: new AbortController().signal,
      onProgress: (done) => progress.push(done),
    },
  )
  assert.equal(
    Buffer.from(await blob.arrayBuffer()).toString(),
    source.toString(),
  )
  assert.equal(attempts.get(4), 2)
  assert.equal(progress.at(-1), source.length)
})
test('range downloader rejects partial bytes and respects cancellation', async () => {
  let calls = 0
  await assert.rejects(
    downloadChunks(
      { size: 5, chunkSize: 5 },
      async () => {
        calls++
        return {
          status: 206,
          arrayBuffer: async () => new Uint8Array(2).buffer,
        }
      },
      { signal: new AbortController().signal },
    ),
    /分段传输中断/,
  )
  assert.equal(calls, 3)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    downloadChunks(
      { size: 5, chunkSize: 5 },
      async () => {
        throw new Error('must not request')
      },
      { signal: controller.signal },
    ),
    (error) => error.name === 'AbortError',
  )
})
test('download tickets are reusable across instances with the same secret and reject tampering', () => {
  const first = ticketCodec('same-key'),
    second = ticketCodec('same-key'),
    ticket = first.seal({
      id: '1',
      url: 'https://m801.music.126.net/a.flac',
      account: 'a',
    })
  assert.equal(second.open(ticket).id, '1')
  assert.throws(
    () => second.open(ticket.slice(0, -5) + 'XXXXX'),
    /下载信息无效/,
  )
  assert.throws(() => ticketCodec('another-key').open(ticket), /下载信息无效/)
})
