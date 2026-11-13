/* Shared, deterministic player helpers; also exercised by Node tests. */
;(function (root) {
  const safeImage = (value) => {
    try {
      const url = new URL(value)
      return ['https:', 'http:'].includes(url.protocol) ? url.href.replace(/^http:/, 'https:') : ''
    } catch { return '' }
  }
  const normalizeSong = (song) => ({
    id: String(song.id), title: song.name || '未知歌曲',
    artist: (song.ar || song.artists || []).map((artist) => artist.name).join(' / ') || '未知歌手',
    album: (song.al || song.album || {}).name || '未知专辑',
    cover: safeImage((song.al || song.album || {}).picUrl),
    duration: (song.dt || song.duration || 0) / 1000,
  })
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  }
  const parseLyrics = (text) => {
    const lines = []
    for (const line of (text || '').split('\n')) {
      const content = line.replace(/\[[^\]]*\]/g, '').trim()
      if (!content) continue
      for (const match of line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)) {
        lines.push({ time: Number(match[1]) * 60 + Number(match[2]), text: content })
      }
    }
    return lines.sort((a, b) => a.time - b.time)
  }
  const lyricIndex = (lines, time) => {
    let index = -1
    for (let i = 0; i < lines.length && lines[i].time <= time; i++) index = i
    return index
  }
  const nextIndex = (length, index, direction, shuffled, random = Math.random) => {
    if (!length) return -1
    if (shuffled && length > 1) return (index + 1 + Math.floor(random() * (length - 1))) % length
    return (index + direction + length) % length
  }
  const helpers = { safeImage, normalizeSong, formatTime, parseLyrics, lyricIndex, nextIndex }
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers
  else root.PlayerCore = helpers
})(typeof window !== 'undefined' ? window : globalThis)
