;(function (root) {
  'use strict'
  const A = typeof module !== 'undefined' && module.exports ? require('./pet-actions') : root.SonoraPetActions
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
  const idleActions = A.actions
  const idleWords = ['不放音乐也没关系，陪你发会儿呆。', '今天的第一首歌，想听什么？', '刚刚那朵云，好像一个音符。', '伸个懒腰，继续陪你。', '要不要试试把我拖到另一边？', '我在这里，慢慢挑一首喜欢的吧。', '安静的时间，也很适合放松。', '偷偷练一下舞步，等你放歌。', '想看我表演？点旁边的小气泡。', '休息一下眼睛吧，我替你守着歌单。']
  const musicWords = ['这段旋律真好听，忍不住想跳舞。', '把烦恼交给音乐，今天慢慢来。', '每一个音符，都有自己的小宇宙。', '跟着节拍，轻轻晃一下。', '好歌要慢慢听，我陪你。']
  function createIdleDirector({ now = Date.now(), random = Math.random } = {}) {
    let nextAction = now + 1800, nextSpeech = now + 5200, wordIndex = 0
    const picker = A.createActionPicker(random)
    const delay = (base, spread) => base + random() * spread
    function defer(time) { nextAction = time + delay(2500, 2000); nextSpeech = time + delay(8000, 5000) }
    function poll({ now: time, visible = true, quiet = false, busy = false, playing = false, reduced = false, acting = false }) {
      if (!visible || quiet || busy) { defer(time); return {} }
      const result = {}
      if (!playing && !reduced && !acting && time >= nextAction) {
        result.action = picker.next()
        nextAction = time + result.action.duration + delay(1500, 2300)
      }
      if (time >= nextSpeech) {
        const words = playing ? musicWords : idleWords
        result.speech = words[wordIndex++ % words.length]
        nextSpeech = time + delay(playing ? 24000 : 11000, playing ? 12000 : 7000)
      }
      return result
    }
    return { poll, defer }
  }
  function mount({ stage, names, syllables, reduced, getMode }) {
    const $ = id => document.getElementById(id)
    const pet = $('music-pet'), home = pet.parentElement, touch = $('pet-touch'), keyboard = $('stage-keyboard'), lane = $('stage-note-lane')
    const mobile = matchMedia('(max-width: 760px)'), follower = createNoteFollower(), director = createIdleDirector(), actionPicker = A.createActionPicker()
    let enabled = true, follow = true, position = null, drag = null, energy = 0, landing = null, reactionUntil = 0, reactionCount = 0, hop, reactionTimer, suppressClick = false, clickTimer
    let quiet = false, lastPlaying = false, musicPose = 'idle', actionPose = null, actionUntil = 0, actionTimer, idleTimer, lifecycleActive = true, actionManual = false, wokeByTouch = false, playActivity = null, playFrame = 0, playTimer, playPaused = false
    const monologue = $('pet-monologue'), menu = $('pet-menu'), playground = $('pet-playground'), sprite = touch.querySelector('.pet-sprite')
    try {
      quiet = localStorage.getItem('sonora-pet-quiet') === 'on'
      enabled = localStorage.getItem('sonora-music-pet') !== 'hidden'
      follow = localStorage.getItem('sonora-pet-follow') !== 'off'
      const saved = JSON.parse(localStorage.getItem('sonora-pet-position'))
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) position = { x: Math.max(0, Math.min(1, saved.x)), y: Math.max(0, Math.min(1, saved.y)) }
    } catch { /* Optional preferences never block the player. */ }
    const sheetLoads = new Map()
    function paintSprite(pose) {
      const frame = A.poses[pose] || A.poses.idle
      const apply = () => {
        if (pet.dataset.pose !== pose) return
        sprite.style.backgroundImage = `url("${frame.src}")`; sprite.style.backgroundSize = `${frame.columns * 100}% ${frame.rows * 100}%`
        sprite.style.backgroundPosition = `${frame.column / (frame.columns - 1) * 100}% ${frame.row / (frame.rows - 1) * 100}%`
      }
      if (typeof root.Image !== 'function') { apply(); return }
      if (!sheetLoads.has(frame.src)) sheetLoads.set(frame.src, new Promise(resolve=>{const image=new root.Image();image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=frame.src}))
      sheetLoads.get(frame.src).then(ready=>{if(ready)apply()})
    }
    function renderPose() {
      const action = Date.now() < actionUntil ? actionPose : null
      const pose = reduced.matches ? pet.classList.contains('is-loved') ? 'wave' : 'idle' : pet.classList.contains('is-loved') ? 'wave' : action || (lastPlaying ? musicPose : 'idle')
      if (pet.dataset.pose !== pose) {
        pet.dataset.pose = pose
        paintSprite(pose)
      }
      pet.classList.toggle('is-sleeping', ['sleep','drowse','curl-sleep'].includes(pose))
      pet.dataset.playing = String(lastPlaying)
      pet.classList.toggle('is-idle-alive', enabled && !quiet && !lastPlaying && !reduced.matches && !document.hidden && lifecycleActive)
    }
    function stopAction() {
      clearTimeout(actionTimer); actionTimer = undefined; actionUntil = 0; actionPose = null; actionManual = false; delete pet.dataset.motion
    }
    function perform(action, manual = false) {
      stopAction(); actionManual = manual; actionUntil = Date.now() + action.duration; pet.dataset.motion = action.pose
      const frames = action.frames || [{ pose: action.pose, duration: action.duration }]
      let index = 0
      function advance() {
        if (index >= frames.length) { stopAction(); renderPose(); return }
        const frame = frames[index++]; actionPose = frame.pose; renderPose(); actionTimer = setTimeout(advance, frame.duration)
      }
      advance()
    }
    function stopPlay(restoreFocus = false) {
      clearTimeout(playTimer); playActivity = null; playground.hidden = true; pet.classList.remove('is-in-playground'); director.defer(Date.now()); renderPose()
      if (restoreFocus) $('pet-chat').focus({ preventScroll: true })
    }
    function paintPlay() {
      if (!playActivity) return
      const row = playActivity.frames[playFrame % playActivity.frames.length]
      $('pet-play-scene').style.backgroundPosition = `${playActivity.column / 3 * 100}% ${row / 2 * 100}%`
      playground.dataset.activity = playActivity.id; playground.dataset.frame = String(row)
    }
    function advancePlay() {
      clearTimeout(playTimer)
      if (!playActivity || document.hidden || !lifecycleActive || playPaused || reduced.matches) return
      playFrame++; paintPlay(); playTimer = setTimeout(advancePlay, playActivity.delay)
    }
    function startPlay(activity) {
      stopPlay(); stopAction(); closeMenu(); monologue.hidden = true; hop?.cancel(); pet.classList.remove('is-loved')
      playActivity = activity; playFrame = 0; playPaused = false
      $('pet-play-title').textContent = activity.label; $('pet-play-text').textContent = activity.text
      $('pet-play-pause').textContent = '暂停表演'; $('pet-play-pause').setAttribute('aria-pressed','false')
      playground.hidden = false; pet.classList.add('is-in-playground'); paintPlay(); positionPopup(playground)
      playground.querySelectorAll('[data-pet-play]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.petPlay===activity.id)))
      if (!reduced.matches) playTimer = setTimeout(advancePlay, activity.delay)
      $('pet-play-close').focus({ preventScroll:true })
    }
    function closeMenu() { menu.hidden = true; $('pet-chat').setAttribute('aria-expanded', 'false') }
    function positionPopup(element, above = true) {
      const rect = pet.getBoundingClientRect(), box = element.getBoundingClientRect(), deck = document.querySelector('.player').getBoundingClientRect()
      const ceiling = deck.top > 0 ? deck.top : window.innerHeight
      const left = Math.max(8, Math.min(window.innerWidth - box.width - 8, rect.left + rect.width / 2 - box.width / 2))
      const preferred = above && rect.top - box.height - 8 >= 8 ? rect.top - box.height - 8 : rect.bottom + 8
      element.style.left = `${left}px`; element.style.top = `${Math.max(8, Math.min(ceiling - box.height - 8, preferred))}px`
    }
    function setQuiet(value) {
      quiet = value; pet.classList.toggle('is-quiet', value)
      $('pet-quiet').setAttribute('aria-pressed', String(value)); $('pet-quiet').textContent = value ? '安静模式 · 开' : '安静模式 · 关'
      try { localStorage.setItem('sonora-pet-quiet', value ? 'on' : 'off') } catch { /* optional */ }
      director.defer(Date.now()); stopAction()
      if (value) { monologue.hidden = true; hop?.cancel() }
      renderPose()
    }
    function idleTick() {
      clearTimeout(idleTimer)
      if (!lifecycleActive) return
      const visible = enabled && !document.hidden
      const result = director.poll({ now: Date.now(), visible, quiet, playing: lastPlaying, reduced: reduced.matches, acting: Date.now() < actionUntil, busy: Boolean(drag) || !menu.hidden || Boolean(playActivity) || Date.now() < reactionUntil })
      if (result.action) perform(result.action)
      if (result.speech) say(result.speech, false, 4800)
      if (!monologue.hidden && visible) positionPopup(monologue)
      if (!menu.hidden && visible) positionPopup(menu)
      if (playActivity && visible) positionPopup(playground)
      idleTimer = setTimeout(idleTick, 800)
    }
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
      if (!visible) { finishDrag(); closeMenu(); monologue.hidden = true; stopAction(); stopPlay() }
      enabled = visible; pet.hidden = !visible
      $('pet-toggle').setAttribute('aria-pressed', String(visible)); $('pet-toggle').textContent = `音乐宠物 · ${visible ? '开' : '关'}`
      try { localStorage.setItem('sonora-music-pet', visible ? 'visible' : 'hidden') } catch { /* optional */ }
      layout(); renderPose()
      if (notify) document.dispatchEvent(new Event('sonora:layout'))
    }
    function resetPosition() {
      finishDrag(); position = null
      try { localStorage.removeItem('sonora-pet-position') } catch { /* optional */ }
      setFollow(true); say('回到舞台啦 ♪'); touch.focus({ preventScroll: true })
      document.dispatchEvent(new Event('sonora:layout'))
    }
    function say(message, loved = false, duration = 2400) {
      reactionUntil = Date.now() + duration; $('pet-status').textContent = loved ? '好开心 ♡' : '音符碎碎念 ♪'; $('pet-status').title = message
      monologue.textContent = message; monologue.hidden = false; positionPopup(monologue)
      pet.classList.toggle('is-loved', loved); renderPose(); clearTimeout(reactionTimer)
      reactionTimer = setTimeout(() => { pet.classList.remove('is-loved'); renderPose(); monologue.hidden = true; reactionUntil = 0; if (!lastPlaying) $('pet-status').textContent = quiet ? '安静陪着你 ♡' : '等你放首歌 ♪' }, duration)
    }
    function finishDrag(event) {
      if (!drag || event && event.pointerId !== undefined && event.pointerId !== drag.id) return
      const previous = drag; drag = null; pet.classList.remove('is-dragging')
      if (touch.hasPointerCapture?.(previous.id)) touch.releasePointerCapture(previous.id)
      if (previous.moved) { const rect = pet.getBoundingClientRect(); place({ x: rect.left, y: rect.top }); savePosition(); say('自由活动啦 ♪'); clearTimeout(clickTimer); clickTimer = setTimeout(() => { suppressClick = false }, 400) }
    }
    touch.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.isPrimary === false || drag) return
      closeMenu(); monologue.hidden = true; wokeByTouch = pet.classList.contains('is-sleeping'); stopAction(); director.defer(Date.now())
      const rect = pet.getBoundingClientRect()
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false }
      touch.setPointerCapture?.(event.pointerId)
    })
    document.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y
      if (!drag.moved && Math.hypot(dx, dy) < 6) return
      if (!drag.moved) {
        drag.moved = true; wokeByTouch = false; suppressClick = true; hop?.cancel(); setFollow(false, false)
        pet.classList.remove('is-following-notes'); pet.classList.add('is-positioned', 'is-dragging')
        home.append(pet); touch.setPointerCapture?.(event.pointerId)
      }
      event.preventDefault(); place({ x: drag.left + dx, y: drag.top + dy })
    }, { passive: false })
    document.addEventListener('pointerup', finishDrag); document.addEventListener('pointercancel', finishDrag)
    window.addEventListener('blur', () => finishDrag())
    touch.onclick = () => {
      if (suppressClick) { suppressClick = false; return }
      if (wokeByTouch || pet.classList.contains('is-sleeping')) { wokeByTouch = false; stopAction(); say('醒啦！你回来啦 ♡'); perform(A.actions.find(action=>action.pose==='wake'),true); return }
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
      const started = playing && !lastPlaying
      lastPlaying = Boolean(playing)
      if (started) stopAction()
      if (playing && !actionManual) stopAction()
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
      musicPose = pose; renderPose()
      if (Date.now() >= reactionUntil && !drag?.moved) {
        const label = isFollowing() ? note !== null ? `${names[note]} · ${syllables[note]} ♪` : playing ? '等下一颗音符 ♪' : '等你放首歌 ♪' : active ? '跟上节拍 ♪' : playing ? '安静听一会儿 ♡' : quiet ? '安静陪着你 ♡' : '等你放首歌 ♪'
        if ($('pet-status').textContent !== label) $('pet-status').textContent = label
      }
    }
    $('pet-chat').onclick = () => {
      if (!menu.hidden) { closeMenu(); return }
      monologue.hidden = true; menu.hidden = false; positionPopup(menu); $('pet-chat').setAttribute('aria-expanded', 'true')
    }
    $('pet-talk').onclick = () => { closeMenu(); say(idleWords[reactionCount++ % idleWords.length], false, 4800); perform(A.actions.find(action=>action.pose==='wave'), true) }
    $('pet-act').onclick = () => { closeMenu(); const action = actionPicker.next(); perform(action, true); say(action.text, false, 3000) }
    const choose = $('pet-move-picker')
    A.actions.forEach(action=>{ const button=document.createElement('button');button.type='button';button.textContent=action.label;button.dataset.petAction=action.pose;button.onclick=()=>{closeMenu();perform(action,true);say(action.text,false,3000)};choose.append(button) })
    $('pet-choose').onclick = () => { choose.hidden=!choose.hidden;$('pet-choose').setAttribute('aria-expanded',String(!choose.hidden));positionPopup(menu) }
    for (const activity of A.activities) {
      for (const target of [$('pet-play-choices'), $('pet-play-tabs')]) {
        const button=document.createElement('button');button.type='button';button.textContent=activity.label;button.dataset.petPlay=activity.id;button.onclick=()=>startPlay(activity);target.append(button)
      }
    }
    $('pet-play-close').onclick=()=>stopPlay(true)
    $('pet-play-pause').onclick=()=>{ playPaused=!playPaused;$('pet-play-pause').setAttribute('aria-pressed',String(playPaused));$('pet-play-pause').textContent=playPaused?'继续表演':'暂停表演';clearTimeout(playTimer);if(!playPaused)advancePlay() }
    $('pet-play-next').onclick=()=>{if(playActivity){playFrame++;paintPlay()}}
    $('pet-quiet').onclick = () => { setQuiet(!quiet); closeMenu() }
    document.addEventListener('pointerdown', event => { if (!menu.hidden && !menu.contains(event.target) && !$('pet-chat').contains(event.target)) closeMenu() })
    document.addEventListener('keydown', event => { if(event.key==='Escape'&&playActivity){stopPlay(true);return} if (event.key === 'Escape' && !menu.hidden) { closeMenu(); $('pet-chat').focus() } })
    document.addEventListener('visibilitychange', () => { if (document.hidden) { monologue.hidden = true; closeMenu(); hop?.cancel(); clearTimeout(playTimer) } else if(playActivity) advancePlay(); renderPose(); director.defer(Date.now()); idleTick() })
    window.addEventListener('pagehide', () => { lifecycleActive = false; clearTimeout(idleTimer); stopAction(); stopPlay(); clearTimeout(reactionTimer); clearTimeout(clickTimer); monologue.hidden = true; closeMenu(); hop?.cancel(); renderPose() })
    window.addEventListener('pageshow', () => { lifecycleActive = true; renderPose(); director.defer(Date.now()); idleTick() })
    $('pet-toggle').onclick = () => show(!enabled); $('pet-hide').onclick = () => show(false)
    $('pet-home').onclick = resetPosition
    $('pet-follow').onclick = () => { if (!enabled) { setFollow(true); show(true) } else setFollow(!follow); document.dispatchEvent(new Event('sonora:layout')) }
    document.addEventListener('sonora:layout', layout); mobile.addEventListener('change', layout)
    window.addEventListener('resize', () => { layout(); if (!menu.hidden) positionPopup(menu); if (!monologue.hidden) positionPopup(monologue);if(playActivity)positionPopup(playground) })
    reduced.addEventListener('change', () => { hop?.cancel(); stopAction(); clearTimeout(playTimer); if(!reduced.matches&&playActivity)advancePlay();renderPose() })
    setFollow(follow, false); show(enabled, false); setQuiet(quiet); idleTick()
    return { update, layout, reset: () => { follower.reset(); landing = null; delete pet.dataset.note; hop?.cancel() } }
  }
  const exported = { clampPosition, createNoteFollower, createIdleDirector, mount }
  if (typeof module !== 'undefined' && module.exports) module.exports = exported
  else root.SonoraPet = exported
})(typeof window !== 'undefined' ? window : globalThis)
