/* global PlayerCore */
;(function () {
  'use strict'
  const $ = (id) => document.getElementById(id)
  const { normalizeSong, safeImage, formatTime, parseLyrics, lyricIndex, nextIndex } = PlayerCore
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Private browsing can disable storage. */ } }
  const demo = { id: 'sonora-demo', title: '微光 · First Light', artist: 'SONORA · 原创合成试听', album: 'SONORA Sessions / 001', duration: 16, cover: '', demo: true }
  let audio = $('audio')
  const storedFavorites = read('sonora-favorites', [])
  const favorites = new Map((Array.isArray(storedFavorites) ? storedFavorites : []).filter((song) => song && song.id && !song.local).map((song) => [String(song.id), song]))
  let discovered = [demo], searchResults = [], playlistSongs = [], queue = [demo], view = 'discover', current = demo
  let playingIndex = 0, currentLines = [], activeLyric = -1, playRequest = 0, listingRequest = 0, loading = false
  let shuffle = false, repeat = 'list', audioContext, analyser, frequency, waveform, source, visualization = 'bars', demoUrl, frame
  const objectUrls = new Set()
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  let toastTimer
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4500) }
  function apiError(error) {
    if (error.name === 'AbortError') return '请求超时，请稍后重试。'
    if (error.message === 'Failed to fetch') return '无法连接音乐服务，请检查网络或稍后重试。'
    return error.message || '请求失败，请稍后重试。'
  }
  async function api(path, params = {}, options = {}) {
    const base = location.origin
    const url = new URL(base.replace(/\/$/, '') + path)
    const method = options.method || 'GET'
    if (method === 'GET') Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
    if (options.private) url.searchParams.set('timestamp', Date.now())
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(url, { signal: controller.signal, method, body: method === 'POST' ? JSON.stringify(params) : undefined, cache: options.private ? 'no-store' : 'default', headers: { ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, credentials: 'same-origin' })
      if (response.status === 401 && response.headers.get('WWW-Authenticate')?.includes('NeteaseCloudMusicApiEnhanced')) {
        location.replace('/auth')
        throw new Error('登录已失效，请在网站入口重新验证。')
      }
      let result
      try { result = await response.json() } catch { throw new Error(`音乐服务返回了无法识别的响应（${response.status}）。`) }
      if (!response.ok || (result.code && result.code !== 200 && !(options.allowedCodes || []).includes(result.code))) {
        const error = new Error(result.message || result.msg || `接口返回 ${result.code}`)
        error.code = result.code || response.status
        throw error
      }
      $('connection-dot').classList.add('online')
      return result
    } finally { clearTimeout(timeout) }
  }
  function visibleSongs() { return view === 'favorites' ? [...favorites.values()] : view === 'queue' ? queue : view === 'search' ? searchResults : view === 'playlist' ? playlistSongs : discovered }
  function updateCounts() { $('favorite-count').textContent = favorites.size; $('queue-count').textContent = queue.length; $('current-favorite').setAttribute('aria-pressed', favorites.has(current.id)) }
  function heart(song) {
    if (song.local) { toast('本地文件仅在本次会话中可用，已保留在播放队列。'); return }
    if (favorites.has(song.id)) favorites.delete(song.id)
    else favorites.set(song.id, song)
    save('sonora-favorites', [...favorites.values()]); updateCounts(); renderTracks()
  }
  function renderTracks() {
    const songs = visibleSongs(), container = $('tracks')
    container.replaceChildren(); $('result-count').textContent = `${songs.length} 首`; updateCounts()
    if (!songs.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = view === 'favorites' ? '还没有喜欢的歌曲。点击歌曲旁的爱心，把好声音留下。' : view === 'search' ? '没有找到歌曲，试试其他关键词。' : '这里还没有音乐，搜索歌曲或导入本地音频吧。'; container.append(empty); return }
    songs.forEach((song, index) => {
      const row = document.createElement('div'); row.className = 'track-row' + (current.id === song.id ? ' current' : '')
      const number = document.createElement('span'); number.className = 'track-number'; number.textContent = current.id === song.id && !audio.paused ? '▂▅▃' : String(index + 1).padStart(2, '0')
      const main = document.createElement('button'); main.className = 'track-main'; main.setAttribute('aria-label', `播放 ${song.title}，${song.artist}`)
      const cover = document.createElement('span'); cover.className = 'track-cover'; cover.textContent = 'S.'
      const imageUrl = safeImage(song.cover)
      if (imageUrl) { const image = document.createElement('img'); image.src = imageUrl; image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.onerror = () => image.remove(); cover.replaceChildren(image) }
      const text = document.createElement('span'); text.className = 'track-text'
      const title = document.createElement('strong'); title.textContent = song.title
      const artist = document.createElement('small'); artist.textContent = song.artist
      text.append(title, artist); main.append(cover, text)
      main.addEventListener('click', () => { if (view !== 'queue') queue = [...songs]; playingIndex = index; playSong(song) })
      const album = document.createElement('span'); album.className = 'track-album'; album.textContent = song.album
      const duration = document.createElement('span'); duration.className = 'track-duration'; duration.textContent = formatTime(song.duration)
      const like = document.createElement('button'); like.className = 'icon-button'; like.setAttribute('aria-label', `${favorites.has(song.id) ? '取消喜欢' : '喜欢'} ${song.title}`); like.setAttribute('aria-pressed', favorites.has(song.id)); like.innerHTML = '<svg><use href="#i-heart"/></svg>'; like.addEventListener('click', () => heart(song))
      row.append(number, main, album, duration, like); container.append(row)
    })
  }
  function changeView(next) {
    if (next !== 'playlist') account?.cancelPlaylistView()
    view = next
    $('my-playlists').classList.toggle('active', next === 'playlists' || next === 'playlist')
    $('playlist-library').hidden = next !== 'playlists'
    document.querySelector('.music-section').hidden = next === 'playlists'
    if (next !== 'playlist') $('load-more-tracks').hidden = true
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view))
    const titles = { discover: '今天，想听点什么？', favorites: '把喜欢，留在这里。', queue: '好音乐，接着听。', search: '寻找你的下一首喜欢。', playlists: '你的音乐，都在这里。', playlist: '把喜欢的旋律，听一遍。' }
    const lists = { discover: '为你发现', favorites: '本地收藏', queue: '播放队列', search: '搜索结果', playlists: '网易云歌单', playlist: '歌单曲目' }
    $('page-title').textContent = titles[view]; $('list-title').firstChild.textContent = lists[view] + ' '
    $('breadcrumb').textContent = lists[view]; $('hero').classList.toggle('hidden', view !== 'discover')
    $('list-eyebrow').textContent = view === 'discover' ? 'CURATED FOR YOUR EARS' : view === 'favorites' ? 'SOUNDS YOU LOVE' : view === 'queue' ? 'UP NEXT' : 'FIND YOUR SOUND'
    $('refresh-button').classList.toggle('hidden', view !== 'discover')
    $('list-message').textContent = view === 'discover' ? discoverMessage : view === 'search' ? '搜索结果来自音乐 API，点击歌曲即可播放。' : view === 'favorites' ? '喜欢的在线歌曲保存在当前浏览器。' : '点击歌曲即可切换；导入本地音频会追加到队列。'
    renderTracks()
  }
  let discoverMessage = '正在连接音乐服务…'
  async function discover() {
    const request = ++listingRequest; $('refresh-button').disabled = true; discoverMessage = '正在发现新的声音…'
    if (view === 'discover') $('list-message').textContent = discoverMessage
    try {
      const result = await api('/personalized/newsong', { limit: 12, timestamp: Date.now() })
      if (request !== listingRequest) return
      const songs = (result.result || []).map((item) => normalizeSong(item.song || item)).filter((song) => song.id !== 'undefined')
      discovered = songs.length ? songs : [demo]
      discoverMessage = songs.length ? '新鲜好声音，来自网易云音乐。' : '服务暂未返回推荐，可以搜索音乐或试听原创氛围音。'
    } catch (error) {
      if (request !== listingRequest) return
      discovered = [demo]; discoverMessage = `${apiError(error)} 你也可以先试听「微光」或导入本地音乐。`; $('connection-dot').classList.remove('online')
    } finally { if (request === listingRequest) { $('refresh-button').disabled = false; if (view === 'discover') { $('list-message').textContent = discoverMessage; renderTracks() } } }
  }
  function updateCurrent(song) {
    $('song-title').textContent = $('mini-title').textContent = song.title
    $('song-artist').textContent = $('mini-artist').textContent = song.artist
    const cover = safeImage(song.cover); $('cover-image').hidden = !cover
    $('cover-image').referrerPolicy = 'no-referrer'; $('cover-image').onerror = () => { $('cover-image').hidden = true }
    if (cover) $('cover-image').src = cover; else $('cover-image').removeAttribute('src')
    document.querySelector('.mini-cover').style.backgroundImage = cover ? `url("${cover.replaceAll('"', '%22')}")` : ''
    document.querySelector('.mini-cover').textContent = cover ? '' : 'S.'
    $('elapsed').textContent = '0:00'; $('duration').textContent = formatTime(song.duration); $('seek').value = 0; renderTracks()
  }
  function lyricPlaceholder(message) { $('lyrics').replaceChildren(); const line = document.createElement('p'); line.className = 'lyric-placeholder'; line.textContent = message; $('lyrics').append(line) }
  async function loadLyrics(song, request) {
    currentLines = []; activeLyric = -1; lyricPlaceholder(song.demo || song.local ? '纯音乐，让旋律替你说话。' : '正在寻找歌词…')
    if (song.demo || song.local) return
    try {
      const result = await api('/lyric', { id: song.id })
      if (request !== playRequest) return
      currentLines = parseLyrics(result.lrc?.lyric)
      if (!currentLines.length) { lyricPlaceholder('暂无歌词，让旋律替你说话。'); return }
      $('lyrics').replaceChildren(...currentLines.map((line) => { const p = document.createElement('p'); p.textContent = line.text; return p }))
    } catch { if (request === playRequest) lyricPlaceholder('歌词暂不可用，音乐继续。') }
  }
  function makeDemo() {
    if (demoUrl) return demoUrl
    const sampleRate = 22050, length = sampleRate * 16, buffer = new ArrayBuffer(44 + length * 2), bytes = new DataView(buffer)
    const write = (offset, text) => [...text].forEach((char, i) => bytes.setUint8(offset + i, char.charCodeAt(0)))
    write(0, 'RIFF'); bytes.setUint32(4, 36 + length * 2, true); write(8, 'WAVE'); write(12, 'fmt '); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true); bytes.setUint32(24, sampleRate, true); bytes.setUint32(28, sampleRate * 2, true); bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true); write(36, 'data'); bytes.setUint32(40, length * 2, true)
    const chords = [[130.81, 164.81, 196], [110, 130.81, 164.81], [87.31, 110, 130.81], [98, 123.47, 146.83]]
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate, local = t % 4, chord = chords[Math.floor(t / 4)]
      const pad = chord.reduce((sum, hz) => sum + Math.sin(2 * Math.PI * hz * t) + .28 * Math.sin(4 * Math.PI * hz * t), 0) / 4
      const pulse = Math.sin(2 * Math.PI * chord[Math.floor(local * 2) % 3] * 4 * t) * Math.exp(-(local % .5) * 8) * .17
      const envelope = Math.min(1, local / .5) * Math.min(1, (4 - local) / .8) * Math.min(1, (16 - t) / 1.5)
      bytes.setInt16(44 + i * 2, Math.max(-1, Math.min(1, (pad * .3 + pulse) * envelope)) * 28000, true)
    }
    demoUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' })); objectUrls.add(demoUrl); return demoUrl
  }
  function ensureAudioGraph() {
    if (!audioContext) {
      const Context = window.AudioContext || window.webkitAudioContext
      if (!Context) { $('visual-hint').textContent = '当前浏览器不支持实时频谱'; return }
      audioContext = new Context(); analyser = audioContext.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = .82
      source = audioContext.createMediaElementSource(audio); source.connect(analyser); analyser.connect(audioContext.destination)
      frequency = new Uint8Array(analyser.frequencyBinCount); waveform = new Uint8Array(analyser.fftSize)
    }
    if (audioContext?.state === 'suspended') return audioContext.resume()
  }
  async function playSong(song) {
    const request = ++playRequest; audio.pause(); audio.removeAttribute('src'); audio.load(); current = song; loading = true; $('play').disabled = true; updateCurrent(song); $('audio-state').textContent = 'LOADING'
    // Start the audio context in the original click gesture, before network I/O.
    try { await ensureAudioGraph() } catch { toast('实时频谱暂不可用，仍可尝试播放音乐。') }
    if (request !== playRequest) return
    loadLyrics(song, request)
    try {
      let url = song.local ? song.url : song.demo ? makeDemo() : ''
      if (!url) {
        const result = await api('/song/url/v1', { id: song.id, level: 'standard' })
        if (request !== playRequest) return
        const entry = result.data?.[0]
        if (!entry?.url) throw new Error('这首歌曲暂无播放权限，请更换歌曲或在服务端登录有权限的账号。')
        if (entry.freeTrialInfo) toast('当前播放的是歌曲试听片段。')
        url = safeImage(entry.url)
        if (!url) throw new Error('服务未返回有效的音频地址。')
      }
      if (request !== playRequest) return
      audio.src = url; await audio.play()
    } catch (error) {
      if (request !== playRequest) return
      $('audio-state').textContent = 'UNAVAILABLE'; toast(error.name === 'NotAllowedError' ? '浏览器已暂停自动播放，请再点击播放。' : apiError(error))
    } finally { if (request === playRequest) { loading = false; $('play').disabled = false; updatePlayback() } }
  }
  async function togglePlay() {
    if (loading) return
    if (!audio.getAttribute('src')) { await playSong(current); return }
    if (!audio.paused) { audio.pause(); return }
    try { await ensureAudioGraph(); await audio.play() } catch (error) { toast(apiError(error)) }
  }
  function step(direction, ended = false) {
    if (!queue.length) return
    if (ended && repeat === 'single') { audio.currentTime = 0; audio.play().catch(() => toast('请点击播放继续。')); return }
    if (ended && repeat === 'none' && playingIndex === queue.length - 1 && !shuffle) return
    playingIndex = nextIndex(queue.length, playingIndex, direction, shuffle)
    playSong(queue[playingIndex])
  }
  function updatePlayback() {
    const playing = !audio.paused && !audio.ended
    $('play').setAttribute('aria-label', playing ? '暂停' : '播放'); $('play').innerHTML = `<svg><use href="#i-${playing ? 'pause' : 'play'}"/></svg>`
    $('vinyl').classList.toggle('playing', playing)
    if (playing) { $('audio-state').textContent = 'PLAYING'; $('visual-hint').textContent = 'WEB AUDIO · 跟随此刻的声音' }
    else if (!loading && $('audio-state').textContent !== 'UNAVAILABLE') { $('audio-state').textContent = 'PAUSED'; $('visual-hint').textContent = '播放音乐，唤醒实时频谱' }
    renderTracks(); draw()
  }
  function draw() {
    cancelAnimationFrame(frame)
    const canvas = $('visualizer'), context = canvas.getContext('2d')
    if (!context) return
    const width = canvas.width, height = canvas.height, playing = analyser && !audio.paused && !audio.ended
    context.clearRect(0, 0, width, height)
    if (playing) { analyser.getByteFrequencyData(frequency); analyser.getByteTimeDomainData(waveform) }
    if (visualization === 'wave' && playing) {
      context.beginPath(); context.strokeStyle = '#7b9653'; context.lineWidth = 3
      for (let i = 0; i < waveform.length; i++) { const x = i / (waveform.length - 1) * width, y = waveform[i] / 255 * height; if (i) context.lineTo(x, y); else context.moveTo(x, y) }
      context.stroke()
    } else {
      const count = 48, gap = 6, barWidth = (width - gap * (count - 1)) / count
      for (let i = 0; i < count; i++) {
        const bin = Math.floor(2 + (i / count) ** 1.8 * (frequency?.length || 128) * .8)
        const value = playing ? frequency[bin] / 255 : 0, barHeight = Math.max(3, value * (height - 12))
        context.fillStyle = i % 5 === 0 ? '#a9bd81' : '#7f9b59'; context.fillRect(i * (barWidth + gap), (height - barHeight) / 2, barWidth, barHeight)
      }
    }
    if (playing && !document.hidden) frame = requestAnimationFrame(draw)
  }
  audio.volume = .7
  audio.addEventListener('play', updatePlayback); audio.addEventListener('pause', updatePlayback); audio.addEventListener('ended', () => { updatePlayback(); step(1, true) })
  audio.addEventListener('error', () => { if (!audio.getAttribute('src')) return; $('audio-state').textContent = 'UNAVAILABLE'; toast('音频加载失败，可能是播放地址已过期、格式不支持或音频跨域受限。请重试或更换歌曲。') })
  audio.addEventListener('loadedmetadata', () => { $('duration').textContent = formatTime(audio.duration) })
  audio.addEventListener('timeupdate', () => {
    $('elapsed').textContent = formatTime(audio.currentTime); $('seek').value = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration * 1000 : 0
    const index = lyricIndex(currentLines, audio.currentTime)
    if (index !== activeLyric) { const children = $('lyrics').children; if (children[activeLyric]) children[activeLyric].classList.remove('current'); if (children[index]) { children[index].classList.add('current'); $('lyrics').scrollTo({ top: children[index].offsetTop - $('lyrics').offsetTop - 43, behavior: reducedMotion.matches ? 'instant' : 'smooth' }) } activeLyric = index }
    if (reducedMotion.matches) draw()
  })
  $('play').onclick = togglePlay; $('previous').onclick = () => step(-1); $('next').onclick = () => step(1)
  $('hero-play').onclick = () => { queue = [demo]; playingIndex = 0; playSong(demo) }
  $('play-all').onclick = () => { const songs = visibleSongs(); if (!songs.length) { toast('先搜索或导入一些音乐吧。'); return } queue = [...songs]; playingIndex = 0; playSong(queue[0]) }
  $('shuffle').onclick = () => { shuffle = !shuffle; $('shuffle').setAttribute('aria-pressed', shuffle); toast(shuffle ? '已开启随机播放' : '已切换为顺序播放') }
  $('repeat').onclick = () => { repeat = repeat === 'list' ? 'single' : repeat === 'single' ? 'none' : 'list'; const label = { list: '列表循环', single: '单曲循环', none: '播完停止' }[repeat]; $('repeat').setAttribute('aria-label', label); $('repeat').title = label; $('repeat').style.opacity = repeat === 'none' ? '.4' : '1'; $('repeat').innerHTML = repeat === 'single' ? '↻₁' : '<svg><use href="#i-repeat"/></svg>'; toast(label) }
  $('current-favorite').onclick = () => heart(current)
  $('seek').oninput = () => { if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = $('seek').value / 1000 * audio.duration }
  $('volume').oninput = () => { audio.volume = Number($('volume').value); audio.muted = false; $('mute').setAttribute('aria-label', '静音'); $('mute').style.opacity = audio.volume === 0 ? '.4' : '1' }
  $('mute').onclick = () => { audio.muted = !audio.muted; $('mute').setAttribute('aria-label', audio.muted ? '取消静音' : '静音'); $('mute').style.opacity = audio.muted ? '.4' : '1' }
  $('visual-mode').onclick = () => { visualization = visualization === 'bars' ? 'wave' : 'bars'; $('visual-mode').textContent = visualization === 'bars' ? '频谱 ↔ 波形' : '波形 ↔ 频谱'; draw() }
  document.querySelectorAll('[data-view]').forEach((button) => button.onclick = () => changeView(button.dataset.view))
  $('show-queue').onclick = () => changeView('queue'); $('refresh-button').onclick = discover
  $('search-form').onsubmit = async (event) => {
    event.preventDefault(); const keywords = $('search').value.trim(); if (!keywords) return
    const request = ++listingRequest; $('refresh-button').disabled = false; changeView('search'); $('list-message').textContent = `正在搜索「${keywords}」…`; searchResults = []; renderTracks()
    try { const result = await api('/cloudsearch', { keywords, type: 1, limit: 30 }); if (request !== listingRequest) return; searchResults = (result.result?.songs || []).map(normalizeSong); if (view === 'search') { $('list-message').textContent = `「${keywords}」的搜索结果 · 点击歌曲播放`; renderTracks() } }
    catch (error) { if (request === listingRequest && view === 'search') { $('list-message').textContent = apiError(error); $('connection-dot').classList.remove('online') } }
  }
  $('import-button').onclick = () => $('files').click()
  $('files').onchange = () => {
    let count = 0
    for (const file of $('files').files) {
      if (!file.type.startsWith('audio/') && !/\.(mp3|flac|wav|m4a|ogg)$/i.test(file.name)) continue
      const url = URL.createObjectURL(file); objectUrls.add(url)
      queue.push({ id: `local-${Date.now()}-${count++}`, title: file.name.replace(/\.[^.]+$/, ''), artist: '本地音乐', album: '本地导入', duration: 0, cover: '', local: true, url })
    }
    $('files').value = ''; changeView('queue'); toast(count ? `已导入 ${count} 首本地音乐，点击歌曲开始播放。` : '请选择可播放的音频文件。')
  }
  $('logout-button').onclick = async () => {
    $('logout-button').disabled = true
    try {
      const response = await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' })
      if (!response.ok) throw new Error('退出失败，请稍后重试。')
      ++playRequest; audio.pause()
      location.replace('/auth')
    } catch (error) { toast(apiError(error)); $('logout-button').disabled = false }
  }
  window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload() })
  $('connection-button').onclick = () => account.open()
  document.addEventListener('keydown', (event) => { if (event.code === 'Space' && !/INPUT|TEXTAREA|BUTTON|SELECT/.test(document.activeElement.tagName) && !$('music-account').open) { event.preventDefault(); togglePlay() } })
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(frame); else draw() })
  window.addEventListener('pagehide', (event) => { if (!event.persisted) objectUrls.forEach((url) => URL.revokeObjectURL(url)) })
  const account = SonoraAccount.mount({
    api, normalizeSong, toast,
    sameOrigin: () => true,
    onLibrary: () => changeView('playlists'),
    onSignedOut: () => { playlistSongs = []; if (view === 'playlist') changeView('discover') },
    onSongs: (songs, title, more, total) => {
      playlistSongs = songs; changeView('playlist')
      $('list-title').firstChild.textContent = title + ' '
      $('list-message').textContent = `已加载 ${songs.length} 首${total ? ` / 共 ${total} 首` : ''} · 播放全部将播放当前已加载的曲目`
      $('load-more-tracks').hidden = !more
      $('breadcrumb').textContent = title
    },
  })
  $('load-more-tracks').onclick = () => account.loadMoreTracks()
  renderTracks(); draw(); discover(); account.restore()
})()
