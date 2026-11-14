/* Independent panel layout: hiding UI never stops playback or reloads songs. */
;(function () {
  'use strict'
  const $ = (id) => document.getElementById(id)
  const mobile = matchMedia('(max-width: 760px)')
  const sidebar = $('navigation-panel'), details = $('details-panel')
  const workspace = document.querySelector('.workspace'), player = document.querySelector('.player')
  let preferences = { sidebarCollapsed: true, detailsOpen: false, storyOpen: false }
  try {
    const saved = JSON.parse(localStorage.getItem('sonora-layout'))
    for (const key of Object.keys(preferences)) if (typeof saved?.[key] === 'boolean') preferences[key] = saved[key]
  } catch { /* Layout works when browser storage is unavailable. */ }
  let focused = false, mobileNavigation = false, mobileDetails = false, view = 'discover', returnFocus, stageActive = false
  function persist() { try { localStorage.setItem('sonora-layout', JSON.stringify(preferences)) } catch { /* optional */ } }
  function render() {
    const navigationOpen = mobile.matches ? mobileNavigation : !focused && !preferences.sidebarCollapsed
    const detailsOpen = !stageActive && (mobile.matches ? mobileDetails : !focused && preferences.detailsOpen)
    document.body.classList.toggle('sidebar-collapsed', !navigationOpen)
    document.body.classList.toggle('details-open', detailsOpen && !mobile.matches)
    document.body.classList.toggle('focus-mode', focused && !mobile.matches)
    document.body.classList.toggle('mobile-navigation-open', mobile.matches && navigationOpen)
    document.body.classList.toggle('mobile-details-open', mobile.matches && detailsOpen)
    sidebar.inert = mobile.matches ? !navigationOpen : focused
    details.hidden = !detailsOpen; details.inert = !detailsOpen
    workspace.inert = mobile.matches && (navigationOpen || detailsOpen)
    player.inert = false
    $('panel-backdrop').hidden = !mobile.matches || (!navigationOpen && !detailsOpen)

    $('navigation-toggle').setAttribute('aria-expanded', navigationOpen)
    $('navigation-toggle').setAttribute('aria-label', navigationOpen ? '收起导航' : '展开导航')
    $('navigation-toggle').title = navigationOpen ? '收起导航' : '展开导航'
    for (const id of ['details-toggle', 'mini-details']) {
      $(id).setAttribute('aria-expanded', stageActive)
      $(id).setAttribute('aria-controls', 'listening-stage')
      $(id).setAttribute('aria-label', stageActive ? '中央播放舞台已展开' : '打开中央播放舞台')
      $(id).title = stageActive ? '中央播放舞台已展开' : '打开中央播放舞台'
    }
    $('focus-toggle').setAttribute('aria-pressed', focused)
    $('focus-toggle').querySelector('span').textContent = focused ? '退出专注' : '专注模式'
    $('hero-toggle').hidden = view !== 'discover' || focused
    const storyOpen = preferences.storyOpen && view === 'discover' && !focused && !stageActive
    $('hero').hidden = !storyOpen
    $('hero-toggle').setAttribute('aria-expanded', storyOpen)
    $('hero-toggle').firstChild.textContent = storyOpen ? '收起音乐故事 ' : '展开音乐故事 '
    document.dispatchEvent(new Event('sonora:layout'))
  }
  function closeDrawers(restore = true) {
    const hadDrawer = mobileNavigation || mobileDetails
    mobileNavigation = mobileDetails = false; render()
    if (restore && hadDrawer && returnFocus?.isConnected) returnFocus.focus()
  }
  function toggleNavigation() {
    focused = false
    if (mobile.matches) {
      mobileNavigation = !mobileNavigation; mobileDetails = false; returnFocus = $('navigation-toggle')
      render()
      if (mobileNavigation) $('sidebar-collapse').focus(); else returnFocus.focus()
    } else { preferences.sidebarCollapsed = !preferences.sidebarCollapsed; persist(); render(); $('navigation-toggle').focus() }
  }
  function toggleDetails(button = $('details-toggle')) {
    focused = false
    if (mobile.matches) {
      mobileDetails = !mobileDetails; mobileNavigation = false; returnFocus = button
      render()
      if (mobileDetails) $('close-details').focus(); else button.focus()
    } else { preferences.detailsOpen = !preferences.detailsOpen; persist(); render(); if (preferences.detailsOpen) $('close-details').focus(); else button.focus() }
  }
  $('navigation-toggle').onclick = toggleNavigation
  $('sidebar-collapse').onclick = () => {
    if (mobile.matches) closeDrawers()
    else { preferences.sidebarCollapsed = true; persist(); render(); $('navigation-toggle').focus() }
  }
  $('details-toggle').onclick = () => toggleDetails()
  $('mini-details').onclick = () => document.dispatchEvent(new Event('sonora:show-stage'))
  $('close-details').onclick = () => {
    if (mobile.matches) closeDrawers()
    else { preferences.detailsOpen = false; persist(); render(); $('details-toggle').focus() }
  }
  $('focus-toggle').onclick = () => { focused = !focused; closeDrawers(false); render() }
  $('hero-toggle').onclick = () => { preferences.storyOpen = !preferences.storyOpen; persist(); render() }
  $('panel-backdrop').onclick = () => closeDrawers()
  sidebar.querySelectorAll('.nav-item').forEach((button) => {
    const label = button.querySelector('.nav-text')?.textContent || button.textContent.trim()
    if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', label)
    button.title = label
    button.addEventListener('click', () => { if (mobile.matches) closeDrawers() })
  })
  function focusable(root) { return [...root.querySelectorAll('button, a[href], input, [tabindex="0"]')].filter((element) => !element.disabled && !element.hidden && element.getClientRects().length > 0) }
  document.addEventListener('keydown', (event) => {
    if (document.querySelector('dialog[open]')) return
    if (event.key === 'Escape') {
      if (mobileNavigation || mobileDetails) { event.preventDefault(); closeDrawers() }
      else if (focused) { focused = false; render(); $('focus-toggle').focus() }
      else if (preferences.detailsOpen) { preferences.detailsOpen = false; persist(); render(); $('details-toggle').focus() }
    }
    if (event.key === 'Tab' && mobile.matches && (mobileNavigation || mobileDetails)) {
      const elements = [...focusable(mobileNavigation ? sidebar : details), ...focusable(player)]
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  })
  mobile.addEventListener('change', () => { closeDrawers(false); focused = false; render() })
  window.SonoraLayout = { setStage(active) { stageActive = active; document.body.classList.toggle('stage-active', active); if (active) mobileNavigation = mobileDetails = false; render() }, setView(next) { view = next; closeDrawers(false); render() } }
  render()
})()
