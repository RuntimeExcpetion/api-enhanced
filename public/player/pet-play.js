;(function(root){
  'use strict'
  const plans={
    swing:[{target:'.swing-pendulum',duration:4800,easing:'ease-in-out',frames:[{transform:'rotate(-12deg)'},{transform:'rotate(12deg)',offset:.5},{transform:'rotate(-12deg)'}]}],
    slide:[{target:'.slide-rider',duration:8200,frames:[
      {left:'61%',top:'10%',opacity:0,offset:0},{left:'61%',top:'10%',opacity:1,offset:.1},
      {left:'61%',top:'10%',opacity:1,offset:.25},{left:'45%',top:'29%',opacity:1,offset:.4,easing:'ease-in'},
      {left:'25%',top:'52%',opacity:1,offset:.56,easing:'ease-out'},{left:'3%',top:'65%',opacity:1,offset:.7},
      {left:'3%',top:'65%',opacity:1,offset:.84},{left:'3%',top:'65%',opacity:0,offset:.9},
      {left:'61%',top:'10%',opacity:0,offset:.91},{left:'61%',top:'10%',opacity:0,offset:1},
    ]}],
    dance:[{target:'.dance-rider',duration:3800,easing:'ease-in-out',frames:[
      {transform:'translateY(0) rotate(-6deg)'},{transform:'translateY(-7px) rotate(1deg)',offset:.2},
      {transform:'translateY(0) rotate(6deg)',offset:.4},{transform:'translateY(-7px) rotate(-1deg)',offset:.6},
      {transform:'translateY(0) rotate(-6deg)',offset:.8},{transform:'translateY(0) rotate(-6deg)'},
    ]}],
    basketball:[
      {target:'.basket-rider',duration:7200,easing:'ease-in-out',frames:[{transform:'translateY(0)'},{transform:'translateY(3px)',offset:.32},{transform:'translateY(-8px)',offset:.44},{transform:'translateY(0)',offset:.65},{transform:'translateY(0)'}]},
      {target:'.play-ball',duration:7200,frames:[
        {left:'21%',top:'49%',opacity:1,offset:0,easing:'ease-in'},{left:'21%',top:'74%',opacity:1,offset:.08,easing:'ease-out'},
        {left:'21%',top:'49%',opacity:1,offset:.16,easing:'ease-in'},{left:'21%',top:'74%',opacity:1,offset:.24,easing:'ease-out'},
        {left:'26%',top:'45%',opacity:1,offset:.34},{left:'29%',top:'34%',opacity:1,offset:.4,easing:'ease-out'},
        {left:'54%',top:'0%',opacity:1,offset:.55,easing:'ease-in'},{left:'77%',top:'18%',opacity:1,offset:.68},
        {left:'77%',top:'38%',opacity:1,offset:.76},{left:'77%',top:'64%',opacity:0,offset:.84},
        {left:'21%',top:'49%',opacity:0,offset:.85},{left:'21%',top:'49%',opacity:1,offset:1},
      ]},
    ],
  }
  function create(scene){
    let animations=[], speed=.75
    function destroy(){animations.forEach(animation=>animation.cancel());animations=[]}
    function start(activity){
      destroy();scene.dataset.activity=activity
      for(const plan of plans[activity]||[]){
        const target=scene.querySelector(plan.target)
        if(!target)continue
        if(typeof target.animate==='function'){const animation=target.animate(plan.frames,{duration:plan.duration,iterations:Infinity,easing:plan.easing||'linear',fill:'both'});animation.playbackRate=speed;animations.push(animation)}
      }
    }
    function moving(value){animations.forEach(animation=>value?animation.play():animation.pause());scene.dataset.moving=String(value)}
    function step(milliseconds=500){animations.forEach(animation=>{animation.pause();animation.currentTime=(Number(animation.currentTime)||0)+milliseconds})}
    function rate(value){speed=Math.max(.5,Math.min(1.5,Number(value)||.75));animations.forEach(animation=>{animation.playbackRate=speed})}
    return{start,moving,step,destroy,rate}
  }
  const exported={plans,create}
  if(typeof module!=='undefined'&&module.exports)module.exports=exported;else root.SonoraPetPlay=exported
})(typeof window!=='undefined'?window:globalThis)
