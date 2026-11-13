;(function (root) {
  'use strict'
  function extractSongs(result) {
    if (!result || typeof result !== 'object') return []
    const value = result.songs || result.result?.songs || result.data?.songs || result.data?.dailySongs || result.playlist?.tracks || (Array.isArray(result.result) ? result.result.map((item) => item.song || item) : [])
    return Array.isArray(value) ? value.filter((song) => song && song.id != null && song.name && (song.ar || song.artists || song.al || song.album)) : []
  }
  function redacted(value) {
    return JSON.stringify(value, (key, item) => /cookie|password|secret|token|authorization|^MUSIC_[UA]$/i.test(key) ? '[已隐藏凭证]' : item, 2)
  }
  function payload(fields, extraText) {
    let extra
    try { extra = JSON.parse(extraText || '{}') } catch { throw new Error('额外参数必须是有效的 JSON 对象。') }
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) throw new Error('额外参数请填写 JSON 对象。')
    const params = { ...extra }, files = []
    for (const { name, value, file } of fields) {
      if (file) { if (file.size) files.push({ name, file }) }
      else if (value !== '') params[name] = value
    }
    return { params, files }
  }
  function mount({ toast, onOpen, onSongs, onAccountChange }) {
    const $ = (id) => document.getElementById(id)
    let catalog, selected, filtered = [], shown = 40, generation = 0, controller, lastOutput = '', resultBlob, currentUrl, loadingCatalog
    function node(tag, text, className) { const element = document.createElement(tag); if (text != null) element.textContent = text; if (className) element.className = className; return element }
    function revoke() { if (currentUrl) URL.revokeObjectURL(currentUrl); currentUrl = null }
    async function load() {
      if (catalog) return catalog
      if (loadingCatalog) return loadingCatalog
      loadingCatalog = (async () => {
        const response = await fetch('/player/catalog.json', { credentials: 'same-origin' })
        if (response.status === 401) { location.replace('/auth'); throw new Error('登录已失效，请重新验证。') }
        if (!response.ok) throw new Error('功能目录加载失败，请稍后重试。')
        catalog = await response.json()
        $('capability-summary').textContent = `${catalog.moduleCount} 个项目接口 · ${catalog.documentedCount} 条文档路径 · 自动沿用本站登录状态`
        const categories = [...new Set(catalog.endpoints.map((entry) => entry.category))]
        $('capability-category').replaceChildren(node('option', '全部分类'))
        $('capability-category').firstChild.value = ''
        for (const category of categories) { const option = node('option', category); option.value = category; $('capability-category').append(option) }
        filter(); select(catalog.endpoints.find((entry) => entry.route === '/cloudsearch') || catalog.endpoints[0])
        return catalog
      })()
      try { return await loadingCatalog } finally { loadingCatalog = null }
    }
    async function open() { onOpen(); try { await load() } catch (error) { $('capability-summary').textContent = error.message; toast(error.message) } }
    function filter() {
      const query = $('capability-search').value.trim().toLowerCase(), category = $('capability-category').value
      filtered = catalog.endpoints.filter((entry) => (!category || entry.category === category) && (!query || `${entry.route} ${entry.title} ${entry.description}`.toLowerCase().includes(query)))
      shown = 40; renderList()
    }
    function renderList() {
      const container = $('capability-list'); container.replaceChildren()
      $('capability-count').textContent = `${filtered.length} 项功能`
      for (const entry of filtered.slice(0, shown)) {
        const button = node('button', null, 'capability-item' + (selected?.route === entry.route ? ' selected' : ''))
        button.type = 'button'; button.setAttribute('aria-pressed', selected?.route === entry.route)
        button.append(node('span', entry.title, 'capability-item-title'), node('code', entry.route), node('small', entry.supported ? entry.category : '官方已下架 / 当前版本不可用'))
        button.onclick = () => select(entry); container.append(button)
      }
      if (!filtered.length) container.append(node('p', '未找到匹配功能，换个关键词试试。', 'empty'))
      $('capability-more').hidden = shown >= filtered.length
    }
    function clearResult() { $('capability-result').textContent = '执行后在这里查看结果。'; $('capability-result-actions').hidden = true; $('capability-preview').replaceChildren(); lastOutput = ''; resultBlob = null; revoke() }
    function select(entry, defaults = {}) {
      generation++; controller?.abort(); selected = entry; clearResult()
      $('capability-run').disabled = !entry.supported; $('capability-cancel').hidden = true
      $('capability-title').textContent = entry.title; $('capability-route').textContent = entry.requestRoute ? `${entry.route} → ${entry.requestRoute}` : entry.route
      $('capability-description').textContent = entry.description || '填写下方参数后执行。完整说明可在接口文档中查看。'
      $('capability-operation').textContent = !entry.supported ? '该接口已下架，当前项目没有可执行模块。' : entry.mutating ? '账号操作 · 执行前请核对参数，部分操作会修改账号内容。' : '数据查询 · 结果中的歌曲可转入播放器。'
      $('capability-operation').classList.toggle('mutating', Boolean(entry.mutating))
      $('capability-documentation').textContent = entry.documentation || '当前模块未提供独立文档。可根据字段填写参数，或在额外参数中补充。'
      $('capability-extra').value = '{}'
      const fields = $('capability-fields'); fields.replaceChildren()
      for (const param of entry.params) {
        const wrapper = node('label', null, 'capability-field'), label = node('span', `${param.name}${param.required ? ' · 文档必选' : ''}`)
        const input = document.createElement('input'); input.name = param.name; input.dataset.parameter = param.name
        input.type = param.file ? 'file' : /password|secret|token/i.test(param.name) ? 'password' : 'text'; input.autocomplete = 'off'
        if (param.file && /img/i.test(param.name)) input.accept = 'image/*'
        if (param.file && /song|audio/i.test(param.name)) input.accept = 'audio/*'
        input.value = param.file ? '' : defaults[param.name] ?? ''
        input.placeholder = param.file ? '' : param.description || '参照说明填写'
        wrapper.append(label, input, node('small', param.description)); fields.append(wrapper)
      }
      if (!entry.params.length) fields.append(node('p', '此接口没有已识别的业务参数，可直接执行或在下方补充参数。', 'list-message'))
      $('capability-status').textContent = ''; renderList()
    }
    function getPayload() {
      return payload([...$('capability-fields').querySelectorAll('[data-parameter]')].map((input) => ({ name: input.dataset.parameter, value: input.value, file: input.type === 'file' ? input.files[0] : null })), $('capability-extra').value)
    }
    function renderPreview(result) {
      if (!result || typeof result !== 'object') return
      const preview = $('capability-preview'); preview.replaceChildren()
      const songs = extractSongs(result)
      if (songs.length) {
        const button = node('button', `在播放器中打开 ${songs.length} 首歌曲 ↗`, 'primary-button')
        button.type = 'button'; button.onclick = () => onSongs(songs, selected.title); preview.append(button)
      }
      const playlists = [result.playlist, result.playlists, result.result?.playlists, result.data?.list].flat().filter((list) => list && list.id && list.name && ('trackCount' in list || 'coverImgUrl' in list))
      for (const list of playlists.slice(0, 12)) {
        const button = node('button', `读取歌单「${list.name}」的歌曲`, 'outline-button')
        button.type = 'button'; button.onclick = () => { const endpoint = catalog.endpoints.find((entry) => entry.route === '/playlist/track/all'); if (endpoint) select(endpoint, { id: list.id, limit: 100 }) }; preview.append(button)
      }
    }
    $('capability-form').onsubmit = async (event) => {
      event.preventDefault(); if (!selected?.supported) return
      let value
      try { value = getPayload() } catch (error) { $('capability-status').textContent = error.message; return }
      const endpoint = selected
      if (endpoint.mutating && !window.confirm(`执行「${endpoint.title}」？\n${endpoint.requestRoute || endpoint.route}\n请确认已核对参数；该操作可能改变账号内容。`)) return
      const run = ++generation; controller?.abort(); controller = new AbortController(); const signal = controller.signal
      $('capability-run').disabled = true; $('capability-cancel').hidden = false; $('capability-status').textContent = '正在执行…'; clearResult()
      const requestController = controller
      const timeout = setTimeout(() => requestController.abort(), 60000)
      try {
        const url = new URL(endpoint.requestRoute || endpoint.route, location.origin); url.searchParams.set('timestamp', `${Date.now()}-${run}`)
        let body, headers = {}
        if (value.files.length) { body = new FormData(); for (const [key, item] of Object.entries(value.params)) body.append(key, typeof item === 'object' ? JSON.stringify(item) : item); value.files.forEach(({ name, file }) => body.append(name, file)) }
        else { body = JSON.stringify(value.params); headers = { 'Content-Type': 'application/json' } }
        const response = await fetch(url, { method: 'POST', credentials: 'same-origin', cache: 'no-store', body, headers, signal })
        if (response.status === 401 && response.headers.get('WWW-Authenticate')?.includes('NeteaseCloudMusicApiEnhanced')) { location.replace('/auth'); throw new Error('站点登录已失效，请重新通过入口验证。') }
        const type = response.headers.get('content-type') || ''
        if (/json|text|javascript|xml/.test(type)) {
          const text = await response.text(); if (run !== generation) return
          let result
          try { result = JSON.parse(text) } catch { /* Non-JSON text remains readable. */ }
          if (result === undefined) lastOutput = text
          else { lastOutput = redacted(result); renderPreview(result) }
          $('capability-result').textContent = lastOutput.length > 180000 ? lastOutput.slice(0, 180000) + '\n…预览已截断，可保存完整结果。' : lastOutput
        } else {
          resultBlob = await response.blob(); if (run !== generation) return
          $('capability-result').textContent = `返回文件：${type || '二进制文件'} · ${(resultBlob.size / 1024).toFixed(1)} KB，点击“保存结果”下载。`
        }
        if (run !== generation) return
        $('capability-status').textContent = `HTTP ${response.status} · ${response.ok ? '请求完成，业务状态请查看返回结果。' : '请求未成功，请查看返回信息。'}`
        $('capability-result-actions').hidden = false
        if (/^\/(login|logout|user\/update)/.test(endpoint.requestRoute || endpoint.route)) onAccountChange()
      } catch (error) { if (run === generation) $('capability-status').textContent = error.name === 'AbortError' ? '已停止等待响应；已提交的账号操作不会因此撤销。' : error.message || '请求失败，请稍后重试。' }
      finally { clearTimeout(timeout); if (run === generation) { $('capability-run').disabled = false; $('capability-cancel').hidden = true } }
    }
    $('capability-cancel').onclick = () => controller?.abort()
    $('capability-copy').onclick = async () => { try { await navigator.clipboard.writeText(lastOutput || $('capability-result').textContent); toast('已复制结果。') } catch { toast('复制失败，可在结果区域选择文字复制。') } }
    $('capability-save').onclick = () => {
      revoke(); currentUrl = URL.createObjectURL(resultBlob || new Blob([lastOutput], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = currentUrl; link.download = `result-${Date.now()}.${resultBlob ? 'bin' : 'json'}`; document.body.append(link); link.click(); link.remove()
    }
    $('capability-more').onclick = () => { shown += 40; renderList() }
    $('capability-search').oninput = () => { if (catalog) filter() }
    $('capability-category').onchange = () => { if (catalog) filter() }
    $('capability-open').onclick = open
    window.addEventListener('pagehide', () => { controller?.abort(); revoke() })
    return { open }
  }
  const api = { mount, extractSongs, redacted, payload }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.SonoraCapabilities = api
})(typeof window !== 'undefined' ? window : globalThis)
