;(function (root) {
  'use strict'
  function clampPosition(position, size, viewport, footerTop = viewport.height) {
    const maxX = Math.max(8, viewport.width - size.width - 8)
    const maxY = Math.max(8, Math.min(viewport.height, footerTop) - size.height - 8)
    return { x: Math.min(maxX, Math.max(8, Number(position.x) || 8)), y: Math.min(maxY, Math.max(8, Number(position.y) || 8)) }
  }
  // Require a sustained dominant pitch class before changing the landing key.
  function createNoteFollower({ holdMs = 110, restMs = 350 } = {}) {
    let current = null, candidate = null, since = 0, quietSince = null
    function reset() { current = candidate = quietSince = null; since = 0 }
    function update(analysis, playing, now) {
      if (!playing) { reset(); return null }
      if (!analysis || !Number.isFinite(analysis.strength) || analysis.strength < .06 || !Number.isInteger(analysis.index) || analysis.index < 0 || analysis.index > 11) {
        candidate = null
        if (quietSince === null) quietSince = now
        if (now - quietSince >= restMs) current = null
        return current
      }
      quietSince = null
      if (analysis.index === current) { candidate = null; return current }
      if (candidate !== analysis.index) { candidate = analysis.index; since = now }
      if (now - since >= holdMs) { current = candidate; candidate = null }
      return current
    }
    return { update, reset }
  }
  function mount({ stage, names, syllables, reduced, getMode }) {
    const $ = id => document.getElementById(id)
    const pet = $('music-pet'), home = pet.parentElement, touch = $('pet-touch'), keyboard = $('stage-keyboard'), lane = $('stage-note-lane')
    const mobile = matchMedia('(max-width: 760px)'), follower = createNoteFollower()
    let enabled = true, follow = true, position = null, drag = null, energy = 0, landing = null, reactionUntil = 0, reactionCount = 0, hop, reactionTimer, suppressClick = false, clickTimer
    try {
      enabled = localStorage.getItem('sonora-music-pet') !== 'hidden'
      follow = localStorage.getItem('sonora-pet-follow') !== 'off'
      const saved = JSON.parse(localStorage.getItem('sonora-pet-position'))
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) position = { x: Math.max(0, Math.min(1, saved.x)), y: Math.max(0, Math.min(1, saved.y)) }
    } catch { /* Optional preferences never block the player. */ }
    function viewport() { return { width: window.innerWidth, height: window.innerHeight } }
    function bounds() {
      const size = pet.getBoundingClientRect(), deck = document.querySelector('.player').getBoundingClientRect()
      return { size, viewport: viewport(), footerTop: deck.top > 0 ? deck.top : window.innerHeight }
    }
    function place(point) {
      const b = bounds(), next = clampPosition(point, b.size, b.viewport, b.footerTop)
      pet.style.left = `${next.x}px`; pet.style.top = `${next.y}px`
      return next
    }
    function savePosition() {
      const rect = pet.getBoundingClientRect(), view = viewport()
      position = { x: rect.left / view.width, y: rect.top / view.height }
      try { localStorage.setItem('sonora-pet-position', JSON.stringify(position)) } catch { /* optional */ }
    }
    function clearPlacement() { pet.classList.remove('is-positioned'); pet.style.removeProperty('left'); pet.style.removeProperty('top') }
    function isFollowing() { return enabled && follow && getMode() === 'notes' && !stage.hidden && !drag?.moved }
    function jump() {
      hop?.cancel()
      if (!reduced.matches && typeof touch.animate === 'function') hop = touch.animate([
        { transform: 'translateY(0)' }, { transform: 'translateY(-25px)', offset: .45 }, { transform: 'translateY(0)' },
      ], { duration: 270, easing: 'ease-in-out' })
    }
    function placeOnKey(index, animate = false) {
      const key = keyboard.children[index]
      if (!key || lane.hidden) return
      const keyBox = key.getBoundingClientRect(), laneBox = lane.getBoundingClientRect(), petBox = pet.getBoundingClientRect()
      // The pet may peek out over the first/last key, but remains inside the stage.
      const x = Math.max(0, Math.min(laneBox.width - petBox.width, keyBox.left - laneBox.left + keyBox.width / 2 - petBox.width / 2))
      pet.style.left = `${x}px`
      if (animate) jump()
    }
    function layout() {
      if (drag?.moved) return
      const following = isFollowing()
      pet.classList.toggle('is-following-notes', following)
      if (!following) { follower.reset(); landing = null; delete pet.dataset.note }
      const target = following ? lane : position ? home : mobile.matches && !stage.hidden ? document.querySelector('.stage-art') : home
      if (pet.parentElement !== target) target.append(pet)
      clearPlacement()
      if (following) placeOnKey(landing ?? 0)
      else if (position) { pet.classList.add('is-positioned'); place({ x: position.x * window.innerWidth, y: position.y * window.innerHeight }) }
    }
    function setFollow(value, notify = true) {
      follow = value; follower.reset(); landing = null; delete pet.dataset.note
      $('pet-follow').setAttribute('aria-pressed', String(value)); $('pet-follow').textContent = value ? '跟随音级 · 开' : '跟随音级 · 关'
      try { localStorage.setItem('sonora-pet-follow', value ? 'on' : 'off') } catch { /* optional */ }
      if (notify) layout()
    }
    function show(visible, notify = true) {
      if (!visible) finishDrag()
      enabled = visible; pet.hidden = !visible
      $('pet-toggle').setAttribute('aria-pressed', String(visible)); $('pet-toggle').textContent = `音乐宠物 · ${visible ? '开' : '关'}`
      try { localStorage.setItem('sonora-music-pet', visible ? 'visible' : 'hidden') } catch { /* optional */ }
      layout()
      if (notify) document.dispatchEvent(new Event('sonora:layout'))
    }
    function resetPosition() {
      finishDrag(); position = null
      try { localStorage.removeItem('sonora-pet-position') } catch { /* optional */ }
      setFollow(true); say('回到舞台啦 ♪'); touch.focus({ preventScroll: true })
      document.dispatchEvent(new Event('sonora:layout'))
    }
    function say(message, loved = false) {
      reactionUntil = Date.now() + 1800; $('pet-status').textContent = message; $('pet-status').title = message
      pet.classList.toggle('is-loved', loved); clearTimeout(reactionTimer)
      reactionTimer = setTimeout(() => { pet.classList.remove('is-loved'); reactionUntil = 0; if (!stage.classList.contains('is-playing')) $('pet-status').textContent = '等你放首歌 ♪' }, 1800)
    }
    function finishDrag(event) {
      if (!drag || event && event.pointerId !== undefined && event.pointerId !== drag.id) return
      const previous = drag; drag = null; pet.classList.remove('is-dragging')
      if (touch.hasPointerCapture?.(previous.id)) touch.releasePointerCapture(previous.id)
      if (previous.moved) { const rect = pet.getBoundingClientRect(); place({ x: rect.left, y: rect.top }); savePosition(); say('自由活动啦 ♪'); clearTimeout(clickTimer); clickTimer = setTimeout(() => { suppressClick = false }, 400) }
    }
    touch.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.isPrimary === false || drag) return
      const rect = pet.getBoundingClientRect()
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false }
      touch.setPointerCapture?.(event.pointerId)
    })
    document.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y
      if (!drag.moved && Math.hypot(dx, dy) < 6) return
      if (!drag.moved) {
        drag.moved = true; suppressClick = true; hop?.cancel(); setFollow(false, false)
        pet.classList.remove('is-following-notes'); pet.classList.add('is-positioned', 'is-dragging')
        home.append(pet); touch.setPointerCapture?.(event.pointerId)
      }
      event.preventDefault(); place({ x: drag.left + dx, y: drag.top + dy })
    }, { passive: false })
    document.addEventListener('pointerup', finishDrag); document.addEventListener('pointercancel', finishDrag)
    window.addEventListener('blur', () => finishDrag())
    touch.onclick = () => {
      if (suppressClick) { suppressClick = false; return }
      const messages = ['摸摸头，最喜欢你啦 ♡', '陪你再听一首 ♪', '这首真好听 ♡']
      say(messages[reactionCount++ % messages.length], true); jump()
    }
    touch.addEventListener('keydown', event => {
      const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      if (event.key === 'Home') { event.preventDefault(); resetPosition(); return }
      const move = moves[event.key]
      if (!move) return
      event.preventDefault(); event.stopPropagation(); finishDrag()
      const rect = pet.getBoundingClientRect(), step = event.shiftKey ? 32 : 12
      setFollow(false, false); pet.classList.remove('is-following-notes'); home.append(pet); pet.classList.add('is-positioned')
      place({ x: rect.left + move[0] * step, y: rect.top + move[1] * step }); savePosition(); touch.focus(); say('自由活动啦 ♪')
    })
    function update({ energy: nextEnergy = 0, playing, time = 0, analysis }) {
      if (!enabled) return
      energy = playing ? energy * .55 + nextEnergy * .45 : 0
      const active = playing && energy > .025, phase = time * 8, motion = reduced.matches || drag?.moved ? 0 : energy
      pet.classList.toggle('is-dancing', active)
      pet.style.setProperty('--pet-hop', `${(-Math.abs(Math.sin(phase)) * motion * 32).toFixed(2)}px`)
      pet.style.setProperty('--pet-turn', `${(Math.sin(phase / 2) * motion * 14).toFixed(2)}deg`)
      pet.style.setProperty('--pet-arm', `${(Math.sin(phase) * motion * 38).toFixed(2)}deg`)
      let note = null
      if (isFollowing()) {
        note = follower.update(analysis, playing, Date.now())
        if (note !== null) { pet.dataset.note = names[note]; if (note !== landing) { const animate = landing !== null; landing = note; placeOnKey(note, animate) } }
        if (note === null) { delete pet.dataset.note; if (!playing) hop?.cancel() }
      }
      const pose = reduced.matches || !playing || drag?.moved ? 'idle' : active || note !== null ? Math.floor(time * 3) % 2 ? 'left' : 'right' : 'idle'
      if (pet.dataset.pose !== pose) pet.dataset.pose = pose
      if (Date.now() >= reactionUntil && !drag?.moved) {
        const label = isFollowing() ? note !== null ? `${names[note]} · ${syllables[note]} ♪` : playing ? '等下一颗音符 ♪' : '等你放首歌 ♪' : active ? '跟上节拍 ♪' : playing ? '安静听一会儿 ♡' : '等你放首歌 ♪'
        if ($('pet-status').textContent !== label) $('pet-status').textContent = label
      }
    }
    $('pet-toggle').onclick = () => show(!enabled); $('pet-hide').onclick = () => show(false)
    $('pet-home').onclick = resetPosition
    $('pet-follow').onclick = () => { if (!enabled) { setFollow(true); show(true) } else setFollow(!follow); document.dispatchEvent(new Event('sonora:layout')) }
    document.addEventListener('sonora:layout', layout); mobile.addEventListener('change', layout)
    window.addEventListener('resize', layout)
    reduced.addEventListener('change', () => { hop?.cancel() })
    setFollow(follow, false); show(enabled, false)
    return { update, layout, reset: () => { follower.reset(); landing = null; delete pet.dataset.note; hop?.cancel() } }
  }
  const exported = { clampPosition, createNoteFollower, mount }
  if (typeof module !== 'undefined' && module.exports) module.exports = exported
  else root.SonoraPet = exported
})(typeof window !== 'undefined' ? window : globalThis)
