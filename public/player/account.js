/* global PlayerCore */
;(function (root) {
  'use strict'
  function createClient({ api, normalizeSong, sameOrigin, onChange = () => {} }) {
    let revision = 0, playlistRequest = 0
    const state = { profile: null, playlists: [], morePlaylists: false, active: null, songs: [], moreTracks: false }
    function reset() { revision++; playlistRequest++; Object.assign(state, { profile: null, playlists: [], morePlaylists: false, active: null, songs: [], moreTracks: false }); onChange(state) }
    function requireOrigin() { if (!sameOrigin()) throw new Error('网易云账号功能需要连接同站 API，请在连接设置中选择“使用同站 API”。') }
    function requireLogin() { requireOrigin(); if (!state.profile) throw new Error('请先通过手机号登录网易云账号。') }
    async function request(path, params, method = 'GET') {
      requireOrigin()
      try { return await api(path, params || {}, { method, private: true }) }
      catch (error) { if (error.code === 301) { reset(); throw new Error('网易云登录已失效，请重新登录。') } throw error }
    }
    function phoneParams(phone, countrycode) {
      phone = String(phone).trim(); countrycode = String(countrycode).trim()
      if (!/^\d{5,15}$/.test(phone) || !/^\d{1,4}$/.test(countrycode)) throw new Error('请填写有效的手机号与国家区号，不需要输入 + 号。')
      return { phone, countrycode }
    }
    async function restore() {
      if (!sameOrigin()) { reset(); return null }
      const expected = revision
      const result = await request('/user/account')
      if (revision !== expected) return null
      state.profile = result.profile?.userId ? result.profile : null; onChange(state)
      return state.profile
    }
    async function sendCaptcha(phone, countrycode) {
      const params = phoneParams(phone, countrycode)
      const result = await request('/captcha/sent', { phone: params.phone, ctcode: params.countrycode }, 'POST')
      if (result.data === false) throw new Error(result.message || '验证码发送失败，请稍后重试。')
      return result
    }
    async function signIn(phone, countrycode, captcha) {
      const params = phoneParams(phone, countrycode)
      if (!/^\d{4,8}$/.test(String(captcha).trim())) throw new Error('请输入 4 至 8 位短信验证码。')
      const expected = revision
      const result = await request('/login/cellphone', { ...params, captcha: String(captcha).trim() }, 'POST')
      if (expected !== revision) return null
      if (!result.profile?.userId) throw new Error('服务未返回账号资料，请重新登录。')
      state.profile = result.profile; state.playlists = []; state.morePlaylists = false; onChange(state)
      return state.profile
    }
    async function playlists(append = false) {
      requireLogin(); const expected = revision, uid = state.profile.userId, offset = append ? state.playlists.length : 0
      const result = await request('/user/playlist', { uid, limit: 100, offset })
      if (revision !== expected) return state.playlists
      const incoming = result.playlist || []
      const existing = append ? state.playlists : []
      state.playlists = [...new Map([...existing, ...incoming].map((list) => [String(list.id), list])).values()]
      state.morePlaylists = Boolean(result.more) && incoming.length > 0; onChange(state)
      return state.playlists
    }
    function cancelPlaylist() { playlistRequest++ }
    async function tracks(list, append = false) {
      requireLogin(); const expected = revision, requestId = ++playlistRequest, offset = append && state.active?.id === list.id ? state.songs.length : 0
      const result = await request('/playlist/track/all', { id: list.id, limit: 100, offset })
      if (revision !== expected || requestId !== playlistRequest) return null
      const songs = (result.songs || []).map(normalizeSong)
      state.songs = offset ? [...state.songs, ...songs] : songs; state.active = list
      state.moreTracks = songs.length === 100 && (!Number.isFinite(list.trackCount) || state.songs.length < list.trackCount)
      onChange(state); return state.songs
    }
    async function daily() {
      requireLogin(); const expected = revision, requestId = ++playlistRequest
      const result = await request('/recommend/songs')
      if (revision !== expected || requestId !== playlistRequest) return null
      state.active = { id: 'daily', name: '每日推荐', trackCount: result.data?.dailySongs?.length || 0 }
      state.songs = (result.data?.dailySongs || []).map(normalizeSong); state.moreTracks = false; onChange(state); return state.songs
    }
    async function signOut() { await request('/logout', {}, 'POST'); reset() }
    return { state, reset, restore, sendCaptcha, signIn, playlists, tracks, daily, signOut, cancelPlaylist }
  }

  function mount({ api, normalizeSong, sameOrigin, toast, onLibrary, onSongs, onSignedOut = () => {} }) {
    const $ = (id) => document.getElementById(id)
    let client, countdownTimer, countdownUntil = 0, viewRequest = 0, previousProfile = null
    function showError(error) { $('music-login-status').textContent = error.message || '请求失败，请稍后重试。'; toast(error.message || '请求失败') }
    function render(state) {
      const profile = state.profile
      if (previousProfile && !profile) onSignedOut()
      previousProfile = profile
      $('phone-login-form').hidden = Boolean(profile); $('music-profile').hidden = !profile
      $('music-account-title').textContent = profile ? '我的网易云账号' : '登录网易云音乐'
      $('account-name').textContent = profile?.nickname || '网易云用户'
      $('account-user-id').textContent = profile ? `UID ${profile.userId}` : ''
      $('connection-button').setAttribute('aria-label', profile ? `网易云账号：${profile.nickname}` : '登录网易云音乐')
      $('connection-button').title = profile ? profile.nickname : '登录网易云音乐'
      const avatar = PlayerCore.safeImage(profile?.avatarUrl)
      $('account-avatar').hidden = !avatar; if (avatar) $('account-avatar').src = avatar
      const cards = $('playlist-cards'); cards.replaceChildren()
      for (const list of state.playlists) {
        const button = document.createElement('button'); button.className = 'playlist-card'
        const cover = document.createElement('div'); cover.className = 'playlist-cover'
        const imageUrl = PlayerCore.safeImage(list.coverImgUrl)
        if (imageUrl) { const img = document.createElement('img'); img.src = imageUrl; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.onerror = () => img.remove(); cover.append(img) } else cover.textContent = '♫'
        const badge = document.createElement('span'); badge.className = 'playlist-badge'; badge.textContent = list.specialType === 5 ? '喜欢的音乐' : String(list.creator?.userId) === String(profile?.userId) ? '我创建的' : '我收藏的'; cover.append(badge)
        const name = document.createElement('strong'); name.textContent = list.name
        const count = document.createElement('small'); count.textContent = `${list.trackCount || 0} 首 · ${list.creator?.nickname || '网易云音乐'}`
        button.append(cover, name, count); button.onclick = () => openPlaylist(list); cards.append(button)
      }
      $('playlist-more').hidden = !state.morePlaylists
      $('playlist-status').textContent = !profile ? '登录网易云账号后，查看你创建、收藏的歌单和喜欢的音乐。' : state.playlists.length ? `已加载 ${state.playlists.length} 个歌单` : '暂无歌单，点击刷新重新获取。'
    }
    client = createClient({ api, normalizeSong, sameOrigin, onChange: render })
    async function restore() {
      try { if (await client.restore()) await client.playlists() }
      catch (error) { $('playlist-status').textContent = error.message || '账号状态暂不可用，请重新登录。' }
    }
    function open() { $('music-login-status').textContent = sameOrigin() ? '' : '账号功能需要同站 API，请先调整连接设置。'; $('music-account').showModal() }
    async function library() {
      viewRequest++; client.cancelPlaylist(); onLibrary()
      if (!client.state.profile) { open(); return }
      await loadPlaylists()
    }
    async function loadPlaylists(append = false) {
      $('playlist-refresh').disabled = $('playlist-more').disabled = true; $('playlist-status').textContent = '正在获取歌单…'
      try { await client.playlists(append) } catch (error) { $('playlist-status').textContent = error.message; if (!client.state.profile) open() }
      finally { $('playlist-refresh').disabled = $('playlist-more').disabled = false }
    }
    async function openPlaylist(list, append = false) {
      const expected = ++viewRequest
      $('load-more-tracks').disabled = true; $('playlist-status').textContent = `正在加载「${list.name}」…`
      try {
        const songs = await client.tracks(list, append)
        if (expected !== viewRequest || !songs) return
        onSongs(songs, list.name, client.state.moreTracks, list.trackCount)
      } catch (error) { toast(error.message); $('playlist-status').textContent = error.message }
      finally { $('load-more-tracks').disabled = false }
    }
    async function daily() {
      const expected = ++viewRequest
      if (!client.state.profile) { open(); return }
      $('daily-button').disabled = true
      try { const songs = await client.daily(); if (expected === viewRequest && songs) onSongs(songs, '每日推荐', false, songs.length) }
      catch (error) { toast(error.message) } finally { $('daily-button').disabled = false }
    }
    $('music-account-close').onclick = () => $('music-account').close()
    $('my-playlists').onclick = library
    $('account-playlists').onclick = () => { $('music-account').close(); library() }
    $('playlist-login').onclick = open
    $('playlist-refresh').onclick = () => loadPlaylists()
    $('playlist-more').onclick = () => loadPlaylists(true)
    $('daily-button').onclick = daily
    function updateCountdown() {
      const seconds = Math.max(0, Math.ceil((countdownUntil - Date.now()) / 1000))
      $('send-captcha').disabled = seconds > 0; $('send-captcha').textContent = seconds ? `${seconds} 秒后重发` : '获取验证码'
      if (!seconds) { clearInterval(countdownTimer); countdownTimer = null }
    }
    $('send-captcha').onclick = async () => {
      if (countdownUntil > Date.now()) return
      $('send-captcha').disabled = true; $('music-login-status').textContent = '正在发送短信验证码…'
      try {
        await client.sendCaptcha($('phone-number').value, $('phone-country').value)
        countdownUntil = Date.now() + 60000; updateCountdown(); countdownTimer = setInterval(updateCountdown, 1000)
        $('music-login-status').textContent = '验证码已发送，请查收短信。'; $('phone-captcha').focus()
      } catch (error) { $('send-captcha').disabled = false; showError(error) }
    }
    $('phone-login-form').onsubmit = async (event) => {
      event.preventDefault(); $('phone-login-submit').disabled = true; $('music-login-status').textContent = '正在登录网易云音乐…'
      try {
        const profile = await client.signIn($('phone-number').value, $('phone-country').value, $('phone-captcha').value)
        if (!profile) return
        $('phone-number').value = $('phone-captcha').value = ''; $('music-account').close(); toast(`欢迎回来，${profile.nickname || '网易云用户'}`)
        onLibrary(); await loadPlaylists()
      } catch (error) { showError(error) } finally { $('phone-login-submit').disabled = false }
    }
    $('music-signout').onclick = async () => {
      $('music-signout').disabled = true
      try { await client.signOut(); viewRequest++; onLibrary(); $('music-login-status').textContent = '已退出网易云账号，项目访问验证仍有效。' }
      catch (error) { showError(error) } finally { $('music-signout').disabled = false }
    }
    render(client.state)
    return { open, restore, reset: () => { viewRequest++; client.reset() }, cancelPlaylistView: () => { viewRequest++; client.cancelPlaylist() }, loadMoreTracks: () => { if (client.state.active && client.state.moreTracks) return openPlaylist(client.state.active, true) } }
  }
  const exported = { createClient, mount }
  if (typeof module !== 'undefined' && module.exports) module.exports = exported
  else root.SonoraAccount = exported
})(typeof window !== 'undefined' ? window : globalThis)
