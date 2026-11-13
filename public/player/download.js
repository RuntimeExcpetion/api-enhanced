;(function () {
  'use strict'
  window.SonoraDownloads = { mount({ demoUrl, toast }) {
    const $ = (id) => document.getElementById(id)
    let selected, controller, running = false
    function saveFile(blob, name) {
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = name; link.hidden = true; document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    }
    function open(song) {
      if (running) { toast('当前歌曲正在下载，可在下载窗口取消后再选择其他歌曲。'); if (!$('download-dialog').open) $('download-dialog').showModal(); return }
      selected = song; $('download-title').textContent = song.title; $('download-artist').textContent = song.artist
      $('download-status').textContent = song.local || song.demo ? '保存当前音频文件。' : '选择音质后下载；可用音质由当前账号和歌曲权限决定。'
      $('download-quality').disabled = Boolean(song.local || song.demo); $('download-cancel').hidden = true; $('download-submit').disabled = false
      if (!$('download-dialog').open) $('download-dialog').showModal()
    }
    $('download-close').onclick = () => $('download-dialog').close()
    $('download-cancel').onclick = () => controller?.abort()
    $('download-form').onsubmit = async (event) => {
      event.preventDefault(); if (!selected || running) return
      const song = selected; running = true; controller = new AbortController()
      $('download-submit').disabled = true; $('download-cancel').hidden = false; $('download-status').textContent = '正在准备音频文件…'
      try {
        let response
        if (song.local || song.demo) response = await fetch(song.local ? song.url : demoUrl(), { signal: controller.signal })
        else {
          const url = new URL('/player/download', location.origin)
          url.searchParams.set('id', song.id); url.searchParams.set('level', $('download-quality').value); url.searchParams.set('title', `${song.title} - ${song.artist}`)
          response = await fetch(url, { credentials: 'same-origin', signal: controller.signal })
        }
        if (!response.ok) {
          if (response.status === 401) { location.replace('/auth'); throw new Error('登录已失效，请重新通过入口验证。') }
          let message = `下载失败（${response.status}），请稍后重试。`
          try { const result = await response.json(); message = result.message || result.msg || message } catch { /* retain status */ }
          throw new Error(message)
        }
        $('download-status').textContent = '正在下载，文件准备完成后会自动保存…'
        const blob = await response.blob()
        if (!blob.size) throw new Error('音频文件为空，请稍后重试。')
        const disposition = response.headers.get('content-disposition') || '', encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
        let name = song.demo ? `${song.title}.wav` : song.local ? song.filename || `${song.title}.mp3` : `${song.title} - ${song.artist}.mp3`
        if (encodedName) try { name = decodeURIComponent(encodedName) } catch { /* retain fallback */ }
        saveFile(blob, name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_'))
        $('download-status').textContent = '文件已交给浏览器保存，请查看浏览器下载列表。'; toast('歌曲文件已准备完成。')
      } catch (error) { $('download-status').textContent = error.name === 'AbortError' ? '已取消下载，可以重新开始。' : error.message || '下载失败，请稍后重试。' }
      finally { running = false; controller = null; $('download-submit').disabled = false; $('download-cancel').hidden = true }
    }
    return { open }
  } }
})()
