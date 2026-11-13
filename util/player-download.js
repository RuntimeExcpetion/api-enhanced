const axios = require('axios')
const crypto = require('crypto')
const { pipeline } = require('stream/promises')
const CHUNK_SIZE = 1024 * 1024
const levels = new Set([
  'standard',
  'higher',
  'exhigh',
  'lossless',
  'hires',
  'jyeffect',
  'sky',
  'dolby',
  'jymaster',
])
function audioUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('歌曲未返回可用的下载地址')
  }
  if (url.protocol === 'http:') url.protocol = 'https:'
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    !/(^|\.)music\.126\.net$/i.test(url.hostname)
  )
    throw new Error('下载音源不在网易云音乐 CDN 范围内')
  return url.href
}
function filename(title, id, type) {
  const extension = /^(mp3|flac|m4a|aac|wav|ogg|opus)$/i.test(type || '')
    ? type.toLowerCase()
    : 'mp3'
  const name =
    String(title || `song-${id}`)
      .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
      .trim()
      .slice(0, 150) || `song-${id}`
  return {
    name: `${Buffer.from(name, 'utf8').toString('utf8')}.${extension}`,
    extension,
  }
}
function ticketCodec(secret) {
  const key = crypto.createHash('sha256').update(secret).digest()
  return {
    seal(data) {
      const iv = crypto.randomBytes(12),
        cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
      const body = Buffer.concat([
        cipher.update(JSON.stringify(data), 'utf8'),
        cipher.final(),
      ])
      return Buffer.concat([iv, cipher.getAuthTag(), body]).toString(
        'base64url',
      )
    },
    open(ticket) {
      try {
        const bytes = Buffer.from(ticket, 'base64url')
        if (bytes.length < 29) throw new Error()
        const cipher = crypto.createDecipheriv(
          'aes-256-gcm',
          key,
          bytes.subarray(0, 12),
        )
        cipher.setAuthTag(bytes.subarray(12, 28))
        return JSON.parse(
          Buffer.concat([
            cipher.update(bytes.subarray(28)),
            cipher.final(),
          ]).toString('utf8'),
        )
      } catch {
        const error = new Error('下载信息无效，请重新开始下载。')
        error.status = 400
        throw error
      }
    },
  }
}
function accountId(cookies = {}) {
  return crypto
    .createHash('sha256')
    .update(cookies.MUSIC_U || 'anonymous')
    .digest('hex')
}
async function openAudio(url, signal, range) {
  return axios.get(audioUrl(url), {
    responseType: 'stream',
    timeout: 30000,
    maxRedirects: 3,
    signal,
    decompress: false,
    headers: {
      'Accept-Encoding': 'identity',
      Referer: 'https://music.163.com/',
      ...(range ? { Range: range } : {}),
    },
    beforeRedirect: (options) =>
      audioUrl(
        `${options.protocol}//${options.hostname}${options.port ? ':' + options.port : ''}${options.path || '/'}`,
      ),
  })
}
function createDownloadHandler({
  resolveSong,
  openStream = openAudio,
  signingSecret = crypto.randomBytes(32),
  now = Date.now,
}) {
  const codec = ticketCodec(signingSecret)
  return async (req, res) => {
    res.set('Cache-Control', 'private, no-store')
    const controller = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })
    let stream, manifest
    try {
      const ticket = req.get('x-download-ticket')
      if (ticket) {
        manifest = codec.open(ticket)
        if (manifest.account !== accountId(req.cookies)) {
          const error = new Error('账号已变更，请重新开始下载。')
          error.status = 403
          throw error
        }
        if (!Number.isFinite(manifest.expires) || manifest.expires <= now()) {
          const error = new Error('下载信息已过期，正在重新获取音源。')
          error.status = 410
          throw error
        }
        audioUrl(manifest.url)
      } else {
        const id = typeof req.query.id === 'string' ? req.query.id : '',
          level = req.query.level || 'standard'
        if (!/^\d{1,20}$/.test(id) || !levels.has(level))
          return res
            .status(400)
            .json({ code: 400, message: '请选择有效的歌曲和下载音质。' })
        const result = await resolveSong({ id, level, cookie: req.cookies }),
          data = Array.isArray(result.body?.data)
            ? result.body.data[0]
            : result.body?.data
        if (
          !data?.url ||
          (data.code && data.code !== 200) ||
          data.freeTrialInfo
        )
          return res.status(403).json({
            code: 403,
            message:
              '当前账号没有这首歌曲的完整下载权限，请登录有权限的账号或更换歌曲。',
          })
        manifest = {
          id,
          level: data.level || level,
          url: audioUrl(data.url),
          type: data.type || 'mp3',
          ...filename(
            typeof req.query.title === 'string' ? req.query.title : '',
            id,
            data.type,
          ),
          size: Number(data.size) || 0,
          md5: typeof data.md5 === 'string' ? data.md5 : '',
          account: accountId(req.cookies),
          expires: now() + 15 * 60 * 1000,
        }
      }
      if (controller.signal.aborted) return
      if (req.query.mode === 'info') {
        const probe = await openStream(
          manifest.url,
          controller.signal,
          'bytes=0-0',
        )
        stream = probe.data
        const range = String(probe.headers?.['content-range'] || '').match(
          /^bytes 0-0\/(\d+)$/,
        )
        manifest.rangeSupported = probe.status === 206 && Boolean(range)
        if (range) manifest.size = Number(range[1])
        else if (probe.status === 200)
          manifest.size =
            Number(probe.headers?.['content-length']) || manifest.size
        stream.destroy()
        stream = null
        return res.json({
          code: 200,
          ticket: codec.seal(manifest),
          url: manifest.url,
          filename: manifest.name,
          size: manifest.size,
          rangeSupported: manifest.rangeSupported,
          contentType: `audio/${manifest.extension === 'mp3' ? 'mpeg' : manifest.extension}`,
          md5: manifest.md5,
          chunkSize: CHUNK_SIZE,
          level: manifest.level,
          expires: manifest.expires,
        })
      }
      const rangeHeader = req.get('range')
      if (ticket) {
        const match = rangeHeader?.match(/^bytes=(\d+)-(\d+)$/),
          start = Number(match?.[1]),
          end = Number(match?.[2])
        if (
          !match ||
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start < 0 ||
          end < start ||
          end - start + 1 > CHUNK_SIZE ||
          end >= manifest.size
        )
          return res
            .status(416)
            .json({ code: 416, message: '下载分段无效，请重新开始。' })
        const upstream = await openStream(
          manifest.url,
          controller.signal,
          `bytes=${start}-${end}`,
        )
        stream = upstream.data
        const range = String(upstream.headers?.['content-range'] || '').match(
          /^bytes (\d+)-(\d+)\/(\d+)$/,
        )
        if (
          upstream.status !== 206 ||
          !range ||
          Number(range[1]) !== start ||
          Number(range[2]) !== end ||
          Number(range[3]) !== manifest.size
        ) {
          stream.destroy()
          stream = null
          return res.status(502).json({
            code: 502,
            message: '这个音源暂不支持分段下载，可以使用音源直连。',
            directAvailable: true,
          })
        }
        const contentType = String(
          upstream.headers?.['content-type'] || 'application/octet-stream',
        )
          .split(';')[0]
          .toLowerCase()
        if (
          !contentType.startsWith('audio/') &&
          !['application/octet-stream', 'application/x-flac'].includes(
            contentType,
          )
        )
          throw new Error('音源未返回音频文件，请稍后重试。')
        res.status(206).set({
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${end}/${manifest.size}`,
          'Content-Length': String(end - start + 1),
          'Accept-Ranges': 'bytes',
          'X-Content-Type-Options': 'nosniff',
        })
        await pipeline(stream, res, { signal: controller.signal })
        return
      }
      // Old clients on serverless hosts must not force a large response through
      // one function invocation. The current UI uses bounded byte ranges.
      if (process.env.VERCEL) return res.redirect(307, manifest.url)
      const upstream = await openStream(manifest.url, controller.signal)
      stream = upstream.data
      const contentType = String(
        upstream.headers?.['content-type'] || 'application/octet-stream',
      )
        .split(';')[0]
        .toLowerCase()
      if (
        !contentType.startsWith('audio/') &&
        !['application/octet-stream', 'application/x-flac'].includes(
          contentType,
        )
      )
        throw new Error('音源未返回音频文件，请稍后重试。')
      res
        .set('Content-Type', contentType)
        .set('X-Content-Type-Options', 'nosniff')
        .set(
          'Content-Disposition',
          `attachment; filename="song-${manifest.id}.${manifest.extension}"; filename*=UTF-8''${encodeURIComponent(manifest.name).replace(/'/g, '%27')}`,
        )
      await pipeline(stream, res, { signal: controller.signal })
    } catch (error) {
      stream?.destroy()
      error.response?.data?.destroy?.()
      if (controller.signal.aborted) return
      if (res.headersSent) {
        console.warn('[player-download-stream]', {
          id: manifest?.id,
          level: manifest?.level,
          code: error.code || 'STREAM_CLOSED',
        })
        res.destroy()
        return
      }
      res.removeHeader('Content-Disposition')
      res.type('json')
      const expiredSource =
        req.get('x-download-ticket') &&
        [403, 404].includes(error.response?.status)
      const status = expiredSource
        ? 410
        : [400, 401, 403, 410].includes(error.status)
          ? error.status
          : 502
      res.status(status).json({
        code: status,
        message:
          error.body?.message ||
          error.body?.msg ||
          error.message ||
          '下载失败，请稍后重试。',
      })
    }
  }
}
module.exports = {
  audioUrl,
  filename,
  ticketCodec,
  createDownloadHandler,
  CHUNK_SIZE,
}
