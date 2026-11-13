const axios = require('axios')
const { pipeline } = require('stream/promises')
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
async function openAudio(url, signal) {
  return axios.get(audioUrl(url), {
    responseType: 'stream',
    timeout: 30000,
    maxRedirects: 3,
    signal,
    beforeRedirect: (options) =>
      audioUrl(
        `${options.protocol}//${options.hostname}${options.port ? ':' + options.port : ''}${options.path || '/'}`,
      ),
  })
}
function createDownloadHandler({ resolveSong, openStream = openAudio }) {
  return async (req, res) => {
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    const level = req.query.level || 'standard'
    res.set('Cache-Control', 'private, no-store')
    if (!/^\d{1,20}$/.test(id) || !levels.has(level))
      return res
        .status(400)
        .json({ code: 400, message: '请选择有效的歌曲和下载音质。' })
    const controller = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })
    let stream
    try {
      const result = await resolveSong({ id, level, cookie: req.cookies })
      const data = Array.isArray(result.body?.data)
        ? result.body.data[0]
        : result.body?.data
      if (!data?.url || (data.code && data.code !== 200) || data.freeTrialInfo)
        return res.status(403).json({
          code: 403,
          message:
            '当前账号没有这首歌曲的完整下载权限，请登录有权限的账号或更换歌曲。',
        })
      const url = audioUrl(data.url)
      if (controller.signal.aborted) return
      const upstream = await openStream(url, controller.signal)
      stream = upstream.data
      const contentType = String(
        upstream.headers?.['content-type'] || 'application/octet-stream',
      )
        .split(';')[0]
        .toLowerCase()
      if (
        !contentType.startsWith('audio/') &&
        contentType !== 'application/octet-stream' &&
        contentType !== 'application/x-flac'
      )
        throw new Error('音源未返回音频文件，请稍后重试。')
      const title = typeof req.query.title === 'string' ? req.query.title : ''
      const file = filename(title, id, data.type)
      res.set('Content-Type', contentType)
      res.set('X-Content-Type-Options', 'nosniff')
      res.set(
        'Content-Disposition',
        `attachment; filename="song-${id}.${file.extension}"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, '%27')}`,
      )
      await pipeline(stream, res, { signal: controller.signal })
    } catch (error) {
      stream?.destroy()
      if (controller.signal.aborted) return
      if (res.headersSent) {
        res.destroy()
        return
      }
      res.removeHeader('Content-Disposition')
      res.type('json')
      const status =
        error.status === 401 || error.status === 403 ? error.status : 502
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
module.exports = { audioUrl, filename, createDownloadHandler }
