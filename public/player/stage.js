;(function (root) {
  'use strict'
  const names = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B']
  const syllables = ['Do','Do♯','Re','Re♯','Mi','Fa','Fa♯','Sol','Sol♯','La','La♯','Si']
  function chroma(bins, sampleRate, fftSize) {
    const peak = Array(12).fill(0), sums = Array(12).fill(0), counts = Array(12).fill(0), frequencies = Array(12).fill(0)
    let strongest = 0, frequency = 0
    for (let i = 1; i < bins.length; i++) {
      const hz = i * sampleRate / fftSize
      if (hz < 65 || hz > 2100) continue
      const note = Math.round(69 + 12 * Math.log2(hz / 440)), index = (note % 12 + 12) % 12
      const energy = Math.max(0, (bins[i] - 28) / 227) ** 2
      if (energy > peak[index]) frequencies[index] = hz
      peak[index] = Math.max(peak[index], energy); sums[index] += energy; counts[index]++
      if (energy > strongest) { strongest = energy; frequency = hz }
    }
    const values = peak.map((value, i) => .65 * value + .35 * Math.sqrt(sums[i] / Math.max(1, counts[i])))
    const index = values.indexOf(Math.max(...values))
    return { values, index, frequency: frequencies[index] || frequency, strength: strongest }
  }
  function beatEnergy(bins, sampleRate, fftSize) {
    if (!bins?.length || !sampleRate || !fftSize) return 0
    const first = Math.max(1, Math.ceil(45 * fftSize / sampleRate)), last = Math.min(bins.length - 1, Math.floor(180 * fftSize / sampleRate))
    let sum = 0, count = 0
    for (let i = first; i <= last; i++) { sum += (bins[i] / 255) ** 2; count++ }
    return count ? Math.sqrt(sum / count) : 0
  }
  function mount({ onPlay, onPrevious, onNext, onList, safeImage }) {
    const $ = id => document.getElementById(id), reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let mode = 'ring', smoothed = Array(12).fill(0), lastLabels = 0, songAnimation, coverHue = 166
    const stage = $('listening-stage')
    try { const saved = localStorage.getItem('sonora-visual-mode'); if (['ring','bars','wave','notes'].includes(saved)) mode = saved } catch { /* optional */ }
    const keyboard = $('stage-keyboard')
    names.forEach((name, i) => { const key = document.createElement('div'); key.className = 'tone-key' + (name.includes('♯') ? ' accidental' : ''); key.innerHTML = '<span></span><strong></strong><small></small>'; key.querySelector('strong').textContent = name; key.querySelector('small').textContent = syllables[i]; keyboard.append(key) })
    const pet = root.SonoraPet.mount({ stage, names, syllables, reduced, getMode: () => mode })
    function setMode(value) {
      mode = value; $('listening-stage').dataset.visual = mode
      document.querySelectorAll('[data-visual-mode]').forEach(button => { button.setAttribute('aria-pressed', button.dataset.visualMode === mode) })
      keyboard.hidden = mode !== 'notes'
      $('stage-note-playground').hidden = mode !== 'notes'
      $('stage-note-help').hidden = mode !== 'notes'
      try { localStorage.setItem('sonora-visual-mode', mode) } catch { /* optional */ }
      pet.layout()
    }
    document.querySelectorAll('[data-visual-mode]').forEach(button => button.onclick = () => { setMode(button.dataset.visualMode); document.dispatchEvent(new Event('sonora:layout')) })
    $('stage-play').onclick = onPlay; $('stage-previous').onclick = onPrevious; $('stage-next').onclick = onNext; $('stage-list').onclick = onList
    function updateSong(song) {
      $('stage-title').textContent = song.title; $('stage-artist').textContent = song.artist; $('stage-album').textContent = song.album || '音乐，让此刻不同。'
      pet.reset(); songAnimation?.cancel()
      if (!reduced.matches && typeof document.querySelector('.stage-song')?.animate === 'function') songAnimation = document.querySelector('.stage-song').animate([{ opacity: .2, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 450, easing: 'ease-out' })
      coverHue = 155 + Array.from(String(song.id || song.title)).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 135
      stage.style.setProperty('--stage-hue', String(coverHue))
      const cover = safeImage(song.cover); $('stage-cover-image').hidden = !cover
      if (cover) $('stage-cover-image').src = cover; else $('stage-cover-image').removeAttribute('src')
      $('stage-cover-image').onerror = () => { $('stage-cover-image').hidden = true }
      const atmosphere = $('stage-atmosphere-image'); atmosphere.hidden = !cover
      if (cover) atmosphere.src = cover; else atmosphere.removeAttribute('src')
      atmosphere.onerror = () => { atmosphere.hidden = true }
      smoothed = Array(12).fill(0); $('stage-note').textContent = '等待声音'; $('stage-frequency').textContent = '音级能量'
    }
    function playback(playing) { if (!playing) pet.update({ playing: false }); $('stage-play').setAttribute('aria-label', playing ? '暂停' : '播放'); $('stage-play').innerHTML = `<svg><use href="#i-${playing ? 'pause' : 'play'}"/></svg>`; $('listening-stage').classList.toggle('is-playing', playing) }
    function lyrics(lines, index) {
      const children = $('stage-lyrics').children
      const values = lines.length ? [lines[index - 1]?.text || '', lines[index]?.text || lines[0]?.text || '', lines[index + 1]?.text || ''] : ['', '让旋律，替你说话。', '']
      values.forEach((value, i) => { if (children[i].textContent !== value) children[i].textContent = value })
    }
    function draw({ bins, waveform, playing, sampleRate, fftSize, time }) {
      const analysis = !$('listening-stage').hidden && playing && bins ? chroma(bins, sampleRate, fftSize) : { values: Array(12).fill(0), strength: 0, frequency: 0, index: 0 }
      const pulse = playing ? beatEnergy(bins, sampleRate, fftSize) : 0
      pet.update({ energy: pulse, playing, time, analysis })
      if ($('listening-stage').hidden) return
      const canvas = $('stage-canvas'), context = canvas.getContext('2d')
      if (!context) return
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2)
      const width = Math.max(300, Math.round(rect.width * dpr)), height = Math.max(160, Math.round(rect.height * dpr))
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      context.clearRect(0, 0, width, height)
      smoothed = smoothed.map((value, i) => .78 * value + .22 * analysis.values[i])
      stage.style.setProperty('--stage-energy', (pulse || 0).toFixed(3))
      $('stage-record').style.setProperty('--pulse', (pulse || 0).toFixed(3))
      keyboard.querySelectorAll('.tone-key').forEach((key, i) => { key.style.setProperty('--energy', smoothed[i].toFixed(3)); key.classList.toggle('dominant', playing && analysis.strength > .03 && analysis.index === i) })
      if (Date.now() - lastLabels > 160) {
        $('stage-note').textContent = playing && analysis.strength > .03 ? `${names[analysis.index]} · ${syllables[analysis.index]}` : '等待声音'
        $('stage-frequency').textContent = playing && analysis.frequency ? `${Math.round(analysis.frequency)} Hz · 峰值频率` : '音级能量'
        lastLabels = Date.now()
      }
      const green = `hsl(${coverHue} 85% 72%)`, highlight = `hsl(${(coverHue + 65) % 360} 90% 78%)`, count = 128
      context.shadowColor = green; context.shadowBlur = reduced.matches ? 0 : 8 * dpr
      if (mode === 'ring' || mode === 'notes') {
        const cover = $('stage-record').getBoundingClientRect()
        const cx = width / 2, cy = height / 2, radius = Math.max(cover.width, cover.height) * dpr / 2 + 8 * dpr
        const maxLength = Math.max(3 * dpr, Math.min(40 * dpr, Math.min(width, height) / 2 - radius - 3 * dpr))
        for (let i = 0; i < count; i++) {
          const bin = Math.floor(4 + (i / count) ** 1.8 * Math.min(bins?.length || 100, 380)), energy = playing && bins ? bins[bin] / 255 : 0
          const angle = i / count * Math.PI * 2 + (reduced.matches ? 0 : time * .08), length = 3 * dpr + energy * (maxLength - 3 * dpr)
          context.beginPath(); context.strokeStyle = i % 4 === 0 ? highlight : green; context.lineWidth = 2 * dpr; context.lineCap = 'round'
          context.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
          context.lineTo(cx + Math.cos(angle) * (radius + length), cy + Math.sin(angle) * (radius + length)); context.stroke()
        }
      } else if (mode === 'wave') {
        context.beginPath(); context.strokeStyle = green; context.lineWidth = 2 * dpr
        const steps = 240
        for (let i = 0; i <= steps; i++) {
          const value = playing && waveform ? (waveform[Math.floor(i / steps * (waveform.length - 1))] - 128) / 128 : 0
          const x = i / steps * width, y = height * .72 + value * height * .28
          if (!i) context.moveTo(x, y); else context.lineTo(x, y)
        }
        context.stroke()
      } else {
        const gap = 4 * dpr, barWidth = (width - gap * (count - 1)) / count
        for (let i = 0; i < count; i++) {
          const bin = Math.floor(2 + (Math.abs(i - count / 2) / (count / 2)) ** 1.5 * 180), energy = playing && bins ? bins[bin] / 255 : 0
          const h = Math.max(2 * dpr, energy * height * .52)
          context.fillStyle = i % 3 === 0 ? highlight : green; context.globalAlpha = .65; context.fillRect(i * (barWidth + gap), height - h - 3 * dpr, Math.max(1, barWidth), h)
        }
        context.globalAlpha = 1
      }
    }
    setMode(mode)
    return { updateSong, playback, lyrics, draw }
  }
  const exported = { chroma, beatEnergy, names, mount }
  if (typeof module !== 'undefined' && module.exports) module.exports = exported
  else root.SonoraStage = exported
})(typeof window !== 'undefined' ? window : globalThis)
