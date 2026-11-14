;(function (root) {
  'use strict'
  const sheets = {
    daily: { src: '/player/assets/blue-maid-sprites.png?v=life2', columns: 3, rows: 3 },
    more: { src: '/player/assets/blue-maid-more.png', columns: 4, rows: 3 },
    sleep: { src: '/player/assets/blue-maid-sleep.png', columns: 3, rows: 3 },
  }
  const poses = {}
  function register(sheet, names) { names.forEach((name, index) => { poses[name] = { ...sheets[sheet], column: index % sheets[sheet].columns, row: Math.floor(index / sheets[sheet].columns) } }) }
  register('daily', ['idle','blink','look-left','look-right','stretch','sleep','wave','left','right'])
  register('more', ['bow','twirl','heart','clap','run-left','run-right','crouch','sit','listen','read','shy','surprised'])
  register('sleep', ['yawn','rub-eyes','drowse','curl-sleep','wake','wake-stretch','wait','hum','think'])
  const step = (pose, duration) => ({ pose, duration })
  function action(pose, label, text, frames) { return { pose, label, text, frames, duration: frames.reduce((sum, frame) => sum + frame.duration, 0) } }
  const actions = [
    action('blink','眨眨眼','眨眨眼，看看你。',[step('blink',260)]),
    action('look-left','向左张望','左边会有什么呢？',[step('look-left',1600)]),
    action('look-right','向右张望','右边的风景也不错。',[step('look-right',1600)]),
    action('stretch','伸懒腰','伸个大大的懒腰！',[step('stretch',2200)]),
    action('wave','挥手','嗨，我一直都在。',[step('wave',1800)]),
    action('sleep','闭眼休息','闭眼听听周围的声音。',[step('blink',400),step('sleep',2600)]),
    action('bow','鞠个躬','今天也请多多关照。',[step('idle',350),step('bow',1600),step('idle',350)]),
    action('twirl','转个圈','裙摆转起来啦！',[step('look-left',400),step('twirl',1000),step('look-right',400),step('wave',600)]),
    action('heart','给你比心','送你一颗小小的心 ♡',[step('heart',2200)]),
    action('clap','鼓鼓掌','做得好，为你鼓掌！',[step('clap',350),step('wave',250),step('clap',350),step('wave',250),step('clap',500)]),
    action('run-left','小跑一下','哒哒哒，锻炼一下。',Array.from({length:8},(_,i)=>step(i%2?'run-right':'run-left',240))),
    action('run-right','来回踏步','一步两步，跟上我。',Array.from({length:8},(_,i)=>step(i%2?'run-left':'run-right',260))),
    action('crouch','蹲下看看','这里是不是藏着小秘密？',[step('crouch',2600),step('idle',400)]),
    action('sit','坐坐休息','坐一会儿，慢慢来。',[step('crouch',600),step('sit',3400),step('idle',500)]),
    action('listen','侧耳倾听','我在认真听你说哦。',[step('listen',2600)]),
    action('read','翻翻小书','今天也要读一点点。',[step('read',3500),step('think',1000)]),
    action('shy','害羞一下','被你看见啦，有一点害羞。',[step('shy',2400)]),
    action('surprised','吓一小跳','咦，发生什么了？',[step('surprised',600),step('think',1000)]),
    action('yawn','打个哈欠','哈啊……有一点点困。',[step('yawn',1800)]),
    action('rub-eyes','揉揉眼睛','揉揉眼睛，再陪你一会儿。',[step('rub-eyes',1000),step('blink',250),step('rub-eyes',1000)]),
    action('drowse','点头打盹','嗯……我没有睡着哦。',[step('drowse',1000),step('idle',350),step('drowse',1400)]),
    action('curl-sleep','蜷坐小睡','借这里睡一小会儿。',[step('yawn',1200),step('curl-sleep',5200),step('wake',800)]),
    action('wake','醒醒神','醒啦！你回来啦。',[step('wake',800),step('wake-stretch',1600),step('wave',800)]),
    action('wake-stretch','起床伸展','补充一点精神！',[step('wake-stretch',2200)]),
    action('wait','耐心等待','不着急，我等你。',[step('wait',2400)]),
    action('hum','轻轻哼歌','啦啦啦，心情变好了。',[step('hum',2800)]),
    action('think','歪头思考','让我想一想……',[step('think',2600)]),
    action('nap','犯困到醒来','困意来啦，轻轻拍我就会醒。',[step('yawn',1600),step('rub-eyes',1400),step('drowse',1600),step('curl-sleep',5600),step('wake',800),step('wake-stretch',1600),step('wave',800)]),
  ]
  function createActionPicker(random = Math.random) {
    let bag = [], last = null
    return { next() {
      if (!bag.length) {
        bag = [...actions]
        for (let i=bag.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]] }
        if (bag.length>1&&bag[bag.length-1].pose===last) [bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]]
      }
      const selected=bag.pop();last=selected.pose;return selected
    } }
  }
  const activities = [
    { id:'swing', label:'荡秋千', text:'抓紧绳子，轻轻荡起来！', column:0, frames:[0,1,2,1], delay:650 },
    { id:'slide', label:'滑滑梯', text:'准备——出发！咻！', column:1, frames:[0,0,1,2,2], delay:650 },
    { id:'dance', label:'跳跳舞', text:'左一步，转个圈，再右一步。', column:2, frames:[0,1,2,1], delay:400 },
    { id:'basketball', label:'打篮球', text:'运球，瞄准，投篮！', column:3, frames:[0,0,1,2,2], delay:550 },
  ]
  const exported={sheets,poses,actions,activities,createActionPicker}
  if(typeof module!=='undefined'&&module.exports)module.exports=exported;else root.SonoraPetActions=exported
})(typeof window!=='undefined'?window:globalThis)
