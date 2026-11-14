const { test } = require('node:test')
const assert = require('node:assert/strict')
const { chroma } = require('../public/player/stage')
const { clampPosition, createNoteFollower } = require('../public/player/pet')

function tone(hz, sampleRate = 44100) {
  const bins = new Uint8Array(4096)
  bins[Math.round((hz * 8192) / sampleRate)] = 255
  return chroma(bins, sampleRate, 8192)
}

test('the pet lands on sustained C then E, ignoring transient note changes', () => {
  const follower = createNoteFollower()
  const c = tone(261.63),
    e = tone(329.63),
    d = tone(293.66)
  assert.equal(follower.update(c, true, 0), null)
  assert.equal(follower.update(c, true, 120), 0)
  assert.equal(follower.update(d, true, 150), 0)
  assert.equal(follower.update(c, true, 180), 0)
  assert.equal(follower.update(e, true, 200), 0)
  assert.equal(follower.update(e, true, 320), 4)
})

test('quiet passages and pause stop note following, and reset starts a new song cleanly', () => {
  const follower = createNoteFollower()
  follower.update(tone(329.63), true, 0)
  assert.equal(follower.update(tone(329.63), true, 120), 4)
  const quiet = { index: 0, strength: 0 }
  assert.equal(follower.update(quiet, true, 150), 4)
  assert.equal(follower.update(quiet, true, 520), null)
  follower.update(tone(261.63), true, 600)
  assert.equal(follower.update(tone(261.63), true, 720), 0)
  assert.equal(follower.update(tone(261.63), false, 740), null)
  assert.equal(follower.update(tone(329.63), true, 800), null)
  follower.reset()
  assert.equal(follower.update(tone(329.63), true, 1000), null)
  assert.equal(follower.update(tone(329.63), true, 1120), 4)
})

test('drag positions stay in the viewport and above the player across desktop and phone sizes', () => {
  for (const [width, height, footer] of [
    [1440, 1050, 953],
    [390, 844, 712],
    [320, 740, 608],
  ]) {
    const size = { width: 100, height: 160 },
      viewport = { width, height }
    assert.deepEqual(
      clampPosition({ x: -900, y: -100 }, size, viewport, footer),
      { x: 8, y: 8 },
    )
    const edge = clampPosition(
      { x: width * 2, y: height * 2 },
      size,
      viewport,
      footer,
    )
    assert.equal(edge.x + size.width, width - 8)
    assert.equal(edge.y + size.height, footer - 8)
  }
})

test('idle behavior samples the full action repertoire without music', () => {
  const { createIdleDirector } = require('../public/player/pet')
  const A = require('../public/player/pet-actions')
  const director = createIdleDirector({ now: 0, random: () => 0 })
  assert.deepEqual(director.poll({ now: 0 }), {})
  const observed = []
  let now = 1800
  for (let i = 0; i < A.actions.length; i++) {
    const result = director.poll({ now, playing: false })
    assert.ok(result.action)
    observed.push(result.action.pose)
    now += result.action.duration + 5000
  }
  assert.equal(new Set(observed).size, A.actions.length)
  const speech = createIdleDirector({ now: 0, random: () => 0 })
  assert.ok(speech.poll({ now: 5200, playing: false }).speech)
  assert.ok(speech.poll({ now: 16200, playing: false }).speech)
})
test('hidden, quiet and busy companions defer activity without accumulating a burst on return', () => {
  const { createIdleDirector } = require('../public/player/pet')
  for (const state of [{ visible: false }, { quiet: true }, { busy: true }]) {
    const director = createIdleDirector({ now: 0, random: () => 0 })
    assert.deepEqual(director.poll({ now: 60000, ...state }), {})
    assert.deepEqual(director.poll({ now: 60001 }), {})
    assert.ok(director.poll({ now: 68000 }).speech)
  }
  const director = createIdleDirector({ now: 0, random: () => 0 })
  assert.equal(director.poll({ now: 6000, playing: true }).action, undefined)
  assert.ok(director.poll({ now: 30000, playing: true }).speech)
  const reduced = createIdleDirector({ now: 0, random: () => 0 })
  assert.equal(reduced.poll({ now: 6000, reduced: true }).action, undefined)
})

test('expanded motion frames resolve to valid atlas cells and durations, including a full nap and wake sequence', () => {
  const A = require('../public/player/pet-actions')
  assert.equal(Object.keys(A.poses).length, 30)
  assert.equal(A.actions.length, 28)
  for (const action of A.actions) {
    assert.equal(
      action.duration,
      action.frames.reduce((sum, frame) => sum + frame.duration, 0),
    )
    for (const frame of action.frames) {
      const pose = A.poses[frame.pose]
      assert.ok(pose)
      assert.ok(frame.duration > 0)
      assert.ok(
        pose.column >= 0 &&
          pose.column < pose.columns &&
          pose.row >= 0 &&
          pose.row < pose.rows,
      )
    }
  }
  assert.deepEqual(
    A.actions
      .find((action) => action.pose === 'nap')
      .frames.map((frame) => frame.pose),
    [
      'yawn',
      'rub-eyes',
      'drowse',
      'curl-sleep',
      'wake',
      'wake-stretch',
      'wave',
    ],
  )
  assert.deepEqual(
    A.activities.map((activity) => activity.id),
    ['swing', 'slide', 'dance', 'basketball'],
  )
  for (const activity of A.activities)
    assert.ok(activity.frames.every((frame) => frame >= 0 && frame <= 2))
})
test('random action bags avoid repeats until exhausted and do not repeat at a bag boundary', () => {
  const A = require('../public/player/pet-actions'),
    picker = A.createActionPicker(() => 0.5),
    all = []
  for (let i = 0; i < A.actions.length * 3; i++) all.push(picker.next().pose)
  for (let i = 1; i < all.length; i++) assert.notEqual(all[i], all[i - 1])
  for (let i = 0; i < 3; i++)
    assert.equal(
      new Set(all.slice(i * A.actions.length, (i + 1) * A.actions.length)).size,
      A.actions.length,
    )
})
