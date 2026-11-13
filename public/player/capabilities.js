;(function(root){
  'use strict'
  const V = typeof module !== 'undefined' && module.exports ? require('./visual-core') : root.SonoraVisual
  function mount({ api, toast, onOpen, onSongs, onPlaySongs, onDownload, onAccountChange, getProfile, openAccount, getCurrent, pauseAudio }) {
    const $=id=>document.getElementById(id)
    let catalog, currentSection='home', currentRoute='', context={}, run=0, currentList=[], currentListKind='', lastCollection=null, offset=0, modalJob=null, pickJob=null, activeMedia, recentSongs=[], resumeRecent=false
    const likes=new Set()
    const sections=[['home','音乐广场','✳'],['recent','最近播放','◷'],['playlists','我的歌单','▤'],['cloud','我的云盘','☁'],['artists','歌手与专辑','♬'],['videos','视频与 MV','▷'],['radio','播客电台','◉'],['comments','音乐评论','☷'],['messages','消息与关注','✉'],['profile','我的账号','◌'],['services','更多音乐服务','✦']]
    const shortcuts=[['排行榜','听见此刻最热门的声音','/toplist'],['热门歌单','从一个主题，发现一段旋律','/top/playlist'],['新歌速递','让新鲜的好声音先到耳边','/personalized/newsong'],['推荐新碟','听一张完整的专辑','/album/newest'],['热门歌手','寻找你喜欢的声音','/top/artists'],['最新 MV','让音乐有画面','/mv/first'],['推荐播客','听见有趣的另一种生活','/dj/recommend'],['每日推荐','为你的口味而来','/recommend/songs']]
    function el(tag,text,className){const x=document.createElement(tag);if(text!=null)x.textContent=text;if(className)x.className=className;return x}
    function button(text,fn,cls='outline-button'){const x=el('button',text,cls);x.type='button';x.onclick=fn;return x}
    function image(item,className='resource-art'){const box=el('div',null,className),url=PlayerCore.safeImage(V.picture(item));if(url){const img=el('img');img.src=url;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>{img.remove();box.textContent='♫'};box.append(img)}else box.textContent='♫';return box}
    function status(text){$('visual-status').textContent=text||''}
    function requireLogin(){if(getProfile())return true;toast('先登录网易云，就可以使用你的个人音乐空间。');openAccount();return false}
    async function request(route,params={},files={}){
      if(!Object.keys(files).length)return V.unwrap(await api(route,params,{method:'POST',private:true}))
      const body=new FormData();for(const[key,value]of Object.entries(params))body.append(key,typeof value==='object'?JSON.stringify(value):value)
      for(const[key,value]of Object.entries(files))if(value)body.append(key,value)
      const url=new URL(route,location.origin);url.searchParams.set('timestamp',Date.now())
      const response=await fetch(url,{method:'POST',credentials:'same-origin',body,cache:'no-store'})
      if(response.status===401&&response.headers.get('WWW-Authenticate')?.includes('NeteaseCloudMusicApiEnhanced')){location.replace('/auth');throw new Error('请重新通过网站入口验证。')}
      let result;try{result=await response.json()}catch{throw new Error('暂时没有收到有效结果，请稍后重试。')}
      if(!response.ok)throw new Error(result.message||result.msg||'操作暂时未完成，请稍后重试。')
      return V.unwrap(result)
    }
    async function ensureCatalog(){if(catalog)return catalog;const response=await fetch('/player/catalog.json',{credentials:'same-origin'});if(response.status===401){location.replace('/auth');throw new Error('登录已失效，请重新验证。')}if(!response.ok)throw new Error('暂时无法载入音乐服务。');catalog=await response.json();return catalog}
    function header(title,subtitle,actions=[]){$('visual-title').textContent=title;$('visual-subtitle').textContent=subtitle||'';$('visual-toolbar').replaceChildren(...actions)}
    function clear(){++run;offset=0;currentRoute='';currentList=[];$('visual-results').replaceChildren();$('visual-more').hidden=true;status('')}
    function showSection(){onOpen();document.querySelectorAll('[data-music-section]').forEach(b=>b.classList.toggle('active',b.dataset.musicSection===currentSection));$('my-playlists').classList.toggle('active',currentSection==='playlists');$('recent-open').classList.toggle('active',currentSection==='recent');$('capability-open').classList.toggle('active',!['playlists','recent'].includes(currentSection))}
    async function openSection(section='home'){
      if(section!=='recent')resumeRecent=false
      currentSection=section;showSection();clear()
      try{
        if(section==='recent'){await recentPage();return}
        if(section==='home'){header('音乐广场','想听的、想看的，从这里开始。');const grid=el('div',null,'music-hub-grid');for(const[title,desc,route]of shortcuts){const card=button('',()=>browse(route,{},title),'music-hub-card');card.append(el('span',route.includes('mv')?'▷':route.includes('dj')?'◉':'♫','hub-glyph'),el('strong',title),el('small',desc));grid.append(card)}$('visual-results').append(grid);return}
        if(section==='playlists'){header('我的歌单','创建、整理和收藏，把好声音留在一起。',[button('＋ 新建歌单',()=>createPlaylist()),button('调整歌单顺序',()=>reorderPlaylists())]);if(!requireLogin())return;await browse('/user/playlist',{uid:getProfile().userId},'我的歌单',true);return}
        if(section==='cloud'){header('我的云盘','上传音乐、播放与整理你的私人音乐库。',[button('＋ 上传音乐',()=>uploadCloud(),'primary-button')]);if(!requireLogin())return;await browse('/user/cloud',{},'我的云盘',true);return}
        if(section==='artists'){header('歌手与专辑','跟随声音，发现音乐人的世界。',[button('收藏的歌手',()=>browse('/artist/sublist',{},'收藏的歌手')),button('收藏的专辑',()=>browse('/album/sublist',{},'收藏的专辑'))]);await browse('/top/artists',{},'热门歌手',true);return}
        if(section==='videos'){header('视频与 MV','看见音乐的另一面。',[button('最新 MV',()=>browse('/mv/first',{},'最新 MV')),button('收藏的视频',()=>browse('/video/sublist',{},'收藏的视频'))]);await browse('/mv/all',{area:'全部',type:'全部',order:'最热'},'热门 MV',true);return}
        if(section==='radio'){header('播客电台','故事、访谈、音乐，总有一个频道陪伴你。',[button('热门电台',()=>browse('/dj/hot',{},'热门电台')),button('订阅的电台',()=>browse('/dj/sublist',{},'订阅的电台'))]);await browse('/dj/recommend',{},'推荐播客',true);return}
        if(section==='comments'){header('音乐评论','选一首歌，和同频的人聊聊。');await showComments(getCurrent());return}
        if(section==='messages'){header('消息与关注','朋友的消息与音乐动态。',[button('收到的评论',()=>browse('/msg/comments',{uid:getProfile()?.userId},'收到的评论')),button('通知',()=>browse('/msg/notices',{},'通知')),button('我的关注',()=>browse('/user/follows',{uid:getProfile()?.userId},'我的关注')),button('写私信',()=>newMessage())]);if(!requireLogin())return;await browse('/msg/private',{},'我的消息',true);return}
        if(section==='profile'){header('我的账号','你的音乐身份，也属于你的生活。',[button('编辑资料',()=>editProfile()),button('登录与安全',()=>showServices('账号与资料')),button('听歌记录',()=>browse('/user/record',{uid:getProfile()?.userId,type:1},'最近一周听歌记录'))]);if(!requireLogin())return;await profilePage();return}
        await showServices()
      }catch(error){status(error.message);toast(error.message)}
    }
    const sectionNav=$('visual-navigation');sections.forEach(([id,title,icon])=>{const b=button('',()=>openSection(id),'music-section-tab');b.dataset.musicSection=id;b.append(el('span',icon),el('span',title));sectionNav.append(b)})
    async function recentPage(){
      recentSongs=[];currentList=[];currentListKind='/record/recent/song'
      const playAll=button('播放全部',()=>{if(recentSongs.length)onPlaySongs(recentSongs,0)},'primary-button')
      const refresh=button('刷新记录',()=>openSection('recent'))
      playAll.disabled=true
      header('网易云最近播放','来自当前网易云账号 · 显示最近 100 首歌曲',[playAll,refresh])
      const container=$('visual-results');container.replaceChildren();$('visual-more').hidden=true
      const profile=getProfile()
      if(!profile){resumeRecent=true;status('登录网易云账号后，查看你的最近播放记录。');container.append(button('登录网易云',()=>openAccount(),'primary-button'));openAccount();return}
      const accountId=String(profile.userId),generation=++run
      status('正在读取网易云最近播放…');refresh.disabled=true
      try{
        const result=await request('/record/recent/song',{limit:100})
        if(generation!==run||currentSection!=='recent'||String(getProfile()?.userId)!==accountId)return
        recentSongs=V.recentSongs(result,PlayerCore.normalizeSong);currentList=recentSongs
        if(!recentSongs.length){container.append(el('div','网易云暂时没有返回最近播放记录。听过一些歌曲后，可以点击刷新。','visual-empty'));status('');return}
        const list=el('div',null,'recent-song-list'),heading=el('div',null,'recent-song-heading')
        for(const text of ['#','歌曲 / 歌手','专辑','播放时间','时长','操作'])heading.append(el('span',text))
        list.append(heading)
        recentSongs.forEach((song,index)=>{
          const row=el('article',null,'recent-song-row'),main=button('',()=>onPlaySongs(recentSongs,index),'recent-song-main'),copy=el('div',null,'recent-song-copy')
          main.setAttribute('aria-label',`再次播放 ${song.title}，${song.artist}`)
          const time=V.recentTime(song.playedAt)
          copy.append(el('strong',song.title),el('small',song.artist),el('small',time,'recent-mobile-time'))
          main.append(image({picUrl:song.cover},'recent-song-art'),copy)
          const actions=el('div',null,'resource-actions recent-song-actions')
          const download=button('↓',()=>onDownload(song),'icon-button');download.setAttribute('aria-label',`下载 ${song.title}`);download.title='下载歌曲'
          const more=button('···',()=>showSong(song),'icon-button');more.setAttribute('aria-label',`更多操作：${song.title}`);more.title='加入歌单、评论等'
          actions.append(download,more)
          const album=el('span',song.album,'recent-song-album'),date=el('time',time,'recent-song-time')
          if(song.playedAt>0)date.setAttribute('datetime',new Date(song.playedAt).toISOString())
          row.append(el('span',String(index+1).padStart(2,'0'),'recent-song-index'),main,album,date,el('span',PlayerCore.formatTime(song.duration),'recent-song-duration'),actions);list.append(row)
        })
        container.append(list);playAll.disabled=false
        status(`已读取 ${recentSongs.length} 首最近听过的歌曲，点击歌曲即可再次播放。`)
      }catch(error){
        if(generation!==run||currentSection!=='recent')return
        if(error.code===301||error.code===401){resumeRecent=true;status('网易云登录已失效，请重新登录后刷新。');container.append(button('重新登录网易云',()=>openAccount(),'primary-button'))}
        else{status(error.message||'最近播放暂时读取失败，请稍后刷新。');container.append(button('重新读取',()=>openSection('recent')))}
      }finally{if(generation===run)refresh.disabled=false}
    }
    function accountChanged(){
      if(currentSection!=='recent')return
      ++run;recentSongs=[];currentList=[];$('visual-results').replaceChildren()
      if(!$('capability-center').hidden){
        if(getProfile())openSection('recent')
        else{header('网易云最近播放','登录后查看你的网易云听歌记录。');status('请先登录网易云账号。');$('visual-results').append(button('登录网易云',()=>{resumeRecent=true;openAccount()},'primary-button'))}
      }
    }
    async function browse(route,params={},title='发现音乐',keepHeader=false,append=false){
      const generation=++run;currentRoute=route;context.request={route,params,title,keepHeader};if(!append){offset=0;currentList=[];if(!keepHeader)header(title,'挑选喜欢的内容，直接打开、播放或收藏。');$('visual-results').replaceChildren()}
      status('正在整理好声音…');$('visual-more').disabled=true
      try{
        const result=await request(route,{limit:30,offset,...params});if(generation!==run)return
        const list=V.records(result,route)
        currentList=append?[...currentList,...list]:list
        currentListKind=route
        if(!append)$('visual-results').replaceChildren()
        if(list.length)renderItems(list,route,$('visual-results'))
        else renderInformation(result,$('visual-results'))
        const more=result.more??result.hasMore??result.data?.more??result.data?.hasMore
        $('visual-more').hidden=more===false||list.length<30||!list.length;status(list.length?`已找到 ${currentList.length} 项内容`:'')
        if(route==='/user/cloud'&&result.size!=null)status(`云盘共 ${result.count??currentList.length} 首音乐`)
        if(route==='/user/playlist')lastCollection=currentList
      }catch(error){if(generation===run){status(error.message);if(error.code===301)openAccount()}}finally{if(generation===run)$('visual-more').disabled=false}
    }
    $('visual-more').onclick=()=>{const r=context.request;if(r){offset+=Number(r.params.limit)||30;browse(r.route,r.params,r.title,r.keepHeader,true)}}
    function rawSong(item){if(item.mainSong)return item.mainSong;if(item.song)return item.song;if(item.simpleSong)return item.simpleSong;return item.ar||item.al?item:{id:item.songId||item.id,name:item.songName||item.name||item.title||item.fileName,ar:[{name:item.artist||'未知歌手'}],al:{name:typeof item.album==='string'?item.album:item.album?.name||'本地云盘'},dt:item.duration||0}}
    function renderItems(list,route,target){
      let grid=target.querySelector(':scope > .resource-grid');if(!grid){grid=el('div',null,'resource-grid');target.append(grid)}
      for(const entry of list){const item=entry.song||entry,kind=V.kind(item,route)
        if(kind==='comment'){renderComment(item,target);continue}
        if(kind==='conversation'){renderConversation(item,target);continue}
        if(kind==='event'){renderEvent(item,target);continue}
        const card=el('article',null,'resource-card '+kind),cover=image(item),copy=el('div',null,'resource-copy'),actions=el('div',null,'resource-actions')
        const title=V.display(item);copy.append(el('h3',title));const subtitle=kind==='song'?rawSong(item).ar?.map(x=>x.name).join(' / '):item.artist?.name||item.creator?.nickname||item.dj?.nickname||item.nickname||item.description||item.desc||''
        if(subtitle)copy.append(el('p',String(subtitle).slice(0,120)))
        const count=item.trackCount??item.programCount??item.musicSize??item.albumSize
        if(count!=null)copy.append(el('small',`${count} ${kind==='playlist'?'首歌曲':kind==='radio'?'个节目':'项作品'}`))
        if(kind==='song'||kind==='program'||kind==='cloud'){
          const song=rawSong(item);actions.append(button('播放',()=>onPlaySongs([song],0),'primary-button'),button('更多',()=>showSong(PlayerCore.normalizeSong(song))))
          if(kind==='cloud')actions.append(button('移出云盘',()=>removeCloud(item),'quiet-danger'))
        }else if(['playlist','artist','album','radio','user','video'].includes(kind)){actions.append(button(kind==='video'?'播放视频':'打开',()=>openEntity(kind,item),'primary-button'))}
        else if(kind==='task'){actions.append(button('查看任务',()=>openTask(item)))}
        else if(item.id&&/category|catelist/.test(route)){actions.append(button('浏览',()=>browse('/dj/recommend/type',{type:item.id},item.name)))}
        cover.onclick=()=>{if(kind==='song'||kind==='cloud'||kind==='program')onPlaySongs([rawSong(item)],0);else if(['playlist','artist','album','radio','user','video'].includes(kind))openEntity(kind,item)}
        if(cover.onclick){cover.tabIndex=0;cover.setAttribute('role','button');cover.setAttribute('aria-label',`打开 ${title}`);cover.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();cover.click()}}}
        card.append(cover,copy,actions);grid.append(card)
      }
    }
    function renderInformation(value,target,depth=0){
      if(depth>3||!value)return
      const metrics={nickname:'昵称',signature:'个性签名',level:'等级',listenSongs:'听歌数量',allListenSongs:'听歌数量',followeds:'粉丝',follows:'关注',playlistCount:'歌单',songCount:'歌曲',yunbei:'云贝',point:'积分',balance:'余额',growthValue:'成长值',expireTime:'有效期',vipType:'会员类型',description:'介绍',desc:'介绍',name:'名称',title:'标题',msg:'提示',message:'提示',status:'状态',success:'已完成',spaceSize:'总空间',size:'已用空间',count:'数量',content:'内容',text:'内容'}
      const panel=el('div',null,'information-cards');let count=0
      for(const[key,item]of Object.entries(value)){
        if(/cookie|token|password|secret|^id$|Id$|^code$|privilege|account/i.test(key))continue
        if(typeof item==='object'&&item&&!Array.isArray(item)){renderInformation(item,target,depth+1);continue}
        if(metrics[key]&&item!=null&&typeof item!=='object'){
          const card=el('div',null,'information-card');card.append(el('small',metrics[key]),el('strong',typeof item==='boolean'?item?'是':'否':String(item)));panel.append(card);count++
        }
      }
      if(count)target.append(panel)
      if(!target.children.length)target.append(el('div','这里暂时没有内容，稍后再来看看。','visual-empty'))
    }
    async function openEntity(kind,item){
      clear();context[kind]=item
      if(kind==='playlist')return playlistPage(item)
      if(kind==='artist'){
        header(item.name,'歌手的热门作品与音乐世界。',[button('收藏歌手',()=>changeSubscription('/artist/sub',item.id,true)),button('取消收藏',()=>changeSubscription('/artist/sub',item.id,false)),button('全部歌曲',()=>browse('/artist/songs',{id:item.id},`${item.name} · 全部歌曲`)),button('专辑',()=>browse('/artist/album',{id:item.id},`${item.name} · 专辑`)),button('MV',()=>browse('/artist/mv',{id:item.id},`${item.name} · MV`))]);return browse('/artist/top/song',{id:item.id},item.name,true)
      }
      if(kind==='album'){
        header(item.name,item.artist?.name||'专辑',[button('播放专辑',()=>playCurrentCollection()),button('收藏专辑',()=>changeSubscription('/album/sub',item.id,true)),button('专辑评论',()=>commentPage({id:item.id,name:item.name},3))]);return browse('/album',{id:item.id},item.name,true)
      }
      if(kind==='radio'){
        header(item.name,item.desc||'播客电台',[button('订阅电台',()=>changeSubscription('/dj/sub',item.id,true)),button('取消订阅',()=>changeSubscription('/dj/sub',item.id,false))]);return browse('/dj/program',{rid:item.id},item.name,true)
      }
      if(kind==='video')return playVideo(item)
      if(kind==='user'){
        header(item.nickname||item.name,'音乐，让我们相遇。',[button('关注',()=>changeSubscription('/follow',item.userId||item.id,true)),button('写私信',()=>newMessage(item)),button('查看歌单',()=>browse('/user/playlist',{uid:item.userId||item.id},`${item.nickname}的歌单`))]);return browse('/user/detail',{uid:item.userId||item.id},'用户资料',true)
      }
    }
    function playCurrentCollection(){const songs=currentList.filter(x=>['song','cloud','program'].includes(V.kind(x,currentListKind))).map(rawSong);if(!songs.length){toast('这里还没有可播放的歌曲。');return}onPlaySongs(songs,0)}
    async function playlistPage(item){
      const mine=String(item.creator?.userId||item.userId)===String(getProfile()?.userId),actions=[button('播放全部',()=>playCurrentCollection(),'primary-button'),button('收藏歌单',()=>changeSubscription('/playlist/subscribe',item.id,true)),button('查看评论',()=>commentPage(item,2))]
      if(mine)actions.push(button('编辑歌单',()=>editPlaylist(item)),button('调整歌曲顺序',()=>reorderTracks(item)),button('更换封面',()=>uploadImage('/playlist/cover/update',{id:item.id},()=>playlistPage(item))),button('删除歌单',()=>deletePlaylist(item),'quiet-danger'))
      header(item.name,item.description||`${item.trackCount??''} 首属于你的好声音`,actions)
      context.playlist=item;await browse('/playlist/track/all',{id:item.id,limit:100},item.name,true)
      $('visual-more').hidden=currentList.length<100||currentList.length>=item.trackCount
      context.request={route:'/playlist/track/all',params:{id:item.id,limit:100},title:item.name,keepHeader:true}
    }
    async function changeSubscription(route,id,active){if(!requireLogin())return;try{await request(route,{id,rid:id,t:active?1:0});toast(active?'已收藏，可以在你的收藏中找到。':'已取消收藏。')}catch(error){toast(error.message)}}
    function field(label,options={}){return{label,name:label,...options}}
    function dialog(title,description,fields,action,label='保存',danger=false){
      $('visual-dialog-title').textContent=title;$('visual-dialog-description').textContent=description||'';$('visual-dialog-status').textContent='';$('visual-dialog-submit').textContent=label;$('visual-dialog-submit').classList.toggle('danger-button',danger)
      const container=$('visual-dialog-fields');container.replaceChildren();const inputs=[]
      for(const definition of fields){
        const wrapper=el('label',null,'visual-field'),caption=el('span',definition.label);wrapper.append(caption);let input
        if(definition.custom){input=definition.custom(wrapper)}
        else if(definition.entity){input=el('input');input.type='hidden';input.value=definition.value||'';const b=button(definition.display||`选择${definition.label.replace(/^选择/,'')}`,()=>pick(definition.entity,{multiple:definition.multiple,field:definition.name},items=>{input.value=items.map(x=>V.resourceValue(x,definition.name)).join(',');b.textContent=items.map(V.display).join('、')}),'resource-picker-button');wrapper.append(b)}
        else if(definition.options){input=el('select');for(const[value,text]of definition.options){const o=el('option',text);o.value=value;input.append(o)}input.value=definition.value??definition.options[0]?.[0]??'';wrapper.append(input)}
        else{input=el(definition.multiline?'textarea':'input');if(!definition.multiline)input.type=definition.type||'text';input.value=definition.value??'';input.placeholder=definition.placeholder||'';if(definition.type==='file'){input.value='';input.accept=definition.accept||'';input.multiple=Boolean(definition.multiple)}if(definition.multiline)input.rows=4;input.autocomplete='off';wrapper.append(input)}
        input.name=definition.name;input.required=Boolean(definition.required)&&input.type!=='hidden';inputs.push({definition,input});container.append(wrapper)
      }
      modalJob=async()=>{const values={},files={};for(const{definition,input}of inputs){if(definition.required&&!input.value)throw new Error(`请先${definition.entity?'选择':'填写'}${definition.label}`);if(input.type==='file'){if(input.files.length)files[definition.name]=definition.multiple?[...input.files]:input.files[0]}else if(input.value!==''||!definition.omitEmpty)values[definition.name]=input.type==='date'&&input.value?new Date(input.value+'T00:00:00').getTime():input.value}return action(values,files)}
      if(!$('visual-dialog').open)$('visual-dialog').showModal()
    }
    $('visual-dialog-close').onclick=()=>$('visual-dialog').close()
    $('visual-dialog-form').onsubmit=async event=>{event.preventDefault();if(!modalJob)return;$('visual-dialog-submit').disabled=true;$('visual-dialog-status').textContent='正在完成你的操作…';try{const completed=await modalJob();if(completed===false){$('visual-dialog-status').textContent='已取消。';return}$('visual-dialog').close();toast('已完成。')}catch(error){$('visual-dialog-status').textContent=error.message||'暂时无法完成，请稍后重试。'}finally{$('visual-dialog-submit').disabled=false}}
    async function createPlaylist(){if(!requireLogin())return;dialog('新建歌单','给这段音乐旅程取个名字。',[field('歌单名称',{name:'name',required:true,placeholder:'例如：夜里的一点微光'}),field('谁可以看见',{name:'privacy',options:[['0','公开歌单'],['10','仅自己可见']]})],async values=>{const result=await request('/playlist/create',values);await openSection('playlists');if(result.playlist)toast(`已创建「${result.playlist.name}」`)},'创建歌单')}
    async function editPlaylist(item){dialog('编辑歌单','修改名称、介绍和标签。',[field('名称',{name:'name',value:item.name,required:true}),field('介绍',{name:'desc',value:item.description||'',multiline:true}),field('标签',{name:'tags',value:(item.tags||[]).join('，'),placeholder:'用逗号分隔，例如：夜晚、轻音乐'})],async values=>{values.tags=(values.tags||'').split(/[,，、;]/).map(x=>x.trim()).filter(Boolean).join(';');await request('/playlist/update',{id:item.id,...values});item.name=values.name;item.description=values.desc;item.tags=values.tags.split(';');await playlistPage(item)},'保存歌单')}
    async function deletePlaylist(item){if(!window.confirm(`删除歌单「${item.name}」？这会从你的账号中移除此歌单。`))return;try{await request('/playlist/delete',{id:item.id});await openSection('playlists');toast('歌单已删除。')}catch(error){toast(error.message)}}
    async function addSongToPlaylist(song){if(!requireLogin())return;const result=await request('/user/playlist',{uid:getProfile().userId,limit:100});const own=(result.playlist||[]).filter(x=>String(x.creator?.userId)===String(getProfile().userId));if(!own.length){toast('先创建一个自己的歌单吧。');return createPlaylist()}
      dialog('加入歌单',`将「${song.title||song.name}」加入你选择的歌单。`,[field('目标歌单',{name:'pid',options:own.map(x=>[String(x.id),x.name])})],async values=>{await request('/playlist/tracks',{pid:values.pid,tracks:String(song.id),op:'add'})},'加入歌单')
    }
    async function showSong(song){
      context.song=song
      $('song-actions-title').textContent=song.title||song.name;$('song-actions-artist').textContent=song.artist||song.ar?.map(x=>x.name).join(' / ')||''
      const actions=$('song-action-buttons');actions.replaceChildren(button('播放这首',()=>{$('song-actions-dialog').close();onPlaySongs([song],0)},'primary-button'),button('下载歌曲',()=>{$('song-actions-dialog').close();onDownload(song)}),button('加入歌单',async()=>{$('song-actions-dialog').close();try{await addSongToPlaylist(song)}catch(e){toast(e.message)}}),button('喜欢 / 取消喜欢',async()=>{try{await toggleLike(song);toast(likes.has(String(song.id))?'已加入喜欢的音乐。':'已取消喜欢。')}catch(e){toast(e.message)}}),button('看评论 / 写评论',()=>{$('song-actions-dialog').close();showSection();commentPage({id:song.id,name:song.title||song.name},0)}),button('查看歌手与专辑',async()=>{
        $('song-actions-dialog').close();showSection();clear();header('歌手与专辑','继续探索这首歌背后的音乐人。');try{const result=await request('/song/detail',{ids:song.id});const detail=result.songs?.[0];const list=[];if(detail?.al)list.push({...detail.al,artist:detail.ar?.[0]});list.push(...(detail?.ar||[]).map(x=>({...x,musicSize:x.musicSize??0})));renderItems(list,'/artist',$('visual-results'))}catch(e){status(e.message)}
      }))
      if(currentListKind==='/playlist/track/all'&&currentList.some(x=>String(x.id)===String(song.id))&&context.playlist&&String(context.playlist.creator?.userId)===String(getProfile()?.userId))actions.append(button('从当前歌单移除',async()=>{if(!window.confirm(`从「${context.playlist.name}」移除「${song.title}」？`))return;try{await request('/playlist/tracks',{pid:context.playlist.id,tracks:String(song.id),op:'del'});$('song-actions-dialog').close();await playlistPage(context.playlist)}catch(e){toast(e.message)}},'quiet-danger'))
      if(song.demo||song.local)actions.replaceChildren(button('播放音频',()=>{$('song-actions-dialog').close();onPlaySongs([song],0)},'primary-button'),button('保存音频',()=>{$('song-actions-dialog').close();onDownload(song)}))
      if(!$('song-actions-dialog').open)$('song-actions-dialog').showModal()
    }
    $('song-actions-close').onclick=()=>$('song-actions-dialog').close()
    async function refreshLikes(){likes.clear();if(getProfile()){try{const result=await request('/likelist',{uid:getProfile().userId});(result.ids||[]).forEach(id=>likes.add(String(id)))}catch{ /* Account may have expired. */ }}document.dispatchEvent(new CustomEvent('sonora:likes',{detail:[...likes]}))}
    async function toggleLike(song){if(!requireLogin())return false;await refreshLikes();const liked=!likes.has(String(song.id));await request('/like',{id:song.id,like:liked});if(liked)likes.add(String(song.id));else likes.delete(String(song.id));document.dispatchEvent(new CustomEvent('sonora:likes',{detail:[...likes]}));return liked}
    async function openLiked(){if(!requireLogin())return;showSection();const result=await request('/user/playlist',{uid:getProfile().userId,limit:100});const list=(result.playlist||[]).find(x=>x.specialType===5);if(list)return playlistPage(list);toast('暂时没有找到喜欢的音乐歌单。')}
    async function reorder(title,items,onSave){
      const ordered=[...items];dialog(title,'通过上下箭头调整，保存后同步到账号。',[field('排列顺序',{name:'order',custom:wrapper=>{const hidden=el('input');hidden.type='hidden';wrapper.append(hidden);const list=el('div',null,'reorder-list');wrapper.append(list)
        function draw(){list.replaceChildren();ordered.forEach((item,index)=>{const row=el('div',null,'reorder-row');row.append(el('span',V.display(item)),button('↑',()=>{if(index){[ordered[index-1],ordered[index]]=[ordered[index],ordered[index-1]];draw()}},'icon-button'),button('↓',()=>{if(index<ordered.length-1){[ordered[index+1],ordered[index]]=[ordered[index],ordered[index+1]];draw()}},'icon-button'));list.append(row)})}draw();return hidden}})],async()=>onSave(ordered),'保存顺序')
    }
    async function reorderPlaylists(){if(!requireLogin())return;try{const result=await request('/user/playlist',{uid:getProfile().userId,limit:100});await reorder('调整歌单顺序',result.playlist||[],async ordered=>{await request('/playlist/order/update',{ids:JSON.stringify(ordered.map(x=>x.id))});await openSection('playlists')})}catch(e){toast(e.message)}}
    async function reorderTracks(item){try{const result=await request('/playlist/track/all',{id:item.id,limit:1000});await reorder('调整歌曲顺序',result.songs||[],async ordered=>{await request('/song/order/update',{pid:item.id,ids:JSON.stringify(ordered.map(x=>x.id))});await playlistPage(item)})}catch(e){toast(e.message)}}
    async function uploadCloud(){if(!requireLogin())return;dialog('上传音乐到云盘','选择你想保存的音乐文件。',[field('音乐文件',{name:'songFile',type:'file',accept:'audio/*,.flac,.mp3,.wav,.m4a',multiple:true,required:true})],async(_,files)=>{const selected=files.songFile||[];if(!selected.length)throw new Error('请先选择音乐文件。');for(let i=0;i<selected.length;i++){$('visual-dialog-status').textContent=`正在上传 ${i+1}/${selected.length}：${selected[i].name}`;await request('/cloud',{}, {songFile:selected[i]})}await openSection('cloud')},'上传所选文件')}
    async function removeCloud(item){if(!window.confirm(`将「${V.display(item)}」从云盘中移除？`))return;try{await request('/user/cloud/del',{id:item.songId||item.id});await openSection('cloud')}catch(e){toast(e.message)}}
    function uploadImage(route,params,done){dialog('更换图片','选择图片，保存后更新到你的账号。',[field('选择图片',{name:'imgFile',type:'file',accept:'image/*',required:true})],async(_,files)=>{if(!files.imgFile)throw new Error('请选择一张图片。');await request(route,{...params,imgSize:300,imgX:0,imgY:0},files);await done?.()},'上传并保存')}
    async function commentPage(resource,type=0){
      context.commentResource={resource,type};header(`「${resource.name||resource.title}」的评论`,'有些心情，只有同一首歌能懂。',[button('写评论',()=>writeComment(resource,type)),button('换一首歌曲',()=>pick('song',{},items=>commentPage(items[0],0)))]);const routes=['/comment/music','/comment/mv','/comment/playlist','/comment/album','/comment/dj','/comment/video','/comment/event'];await browse(routes[type]||routes[0],{id:resource.id},'音乐评论',true)
    }
    async function showComments(song){if(song.demo||song.local){$('visual-results').append(button('选择一首在线歌曲',()=>pick('song',{},items=>commentPage(items[0],0)),'primary-button'));status('本地音频没有网易云评论区，选择一首在线歌曲开始。');return}return commentPage({id:song.id,name:song.title||song.name},0)}
    function writeComment(resource,type,reply){if(!requireLogin())return;dialog(reply?'回复评论':'写评论',reply?`回复 ${reply.user?.nickname||'这位听友'}：${reply.content}`:`关于「${resource.name||resource.title}」，你有什么想说的？`,[field('你的文字',{name:'content',multiline:true,required:true,placeholder:'留下一点此刻的心情…'})],async values=>{await request('/comment',{id:resource.id,type,t:reply?2:1,commentId:reply?.commentId,...values});await commentPage(resource,type)},reply?'发送回复':'发表评论')}
    function renderComment(item,target){const article=el('article',null,'social-card'),avatar=image(item.user||{},'social-avatar'),body=el('div',null,'social-body'),actions=el('div',null,'resource-actions');body.append(el('strong',item.user?.nickname||'一位听友'),el('p',item.content||''));if(item.time)body.append(el('small',new Date(item.time).toLocaleString('zh-CN')))
      const resource=context.commentResource?.resource||context.song,type=context.commentResource?.type||0
      if(resource)actions.append(button(`${item.liked?'已赞':'赞'} ${item.likedCount||0}`,async()=>{if(!requireLogin())return;try{await request('/comment/like',{id:resource.id,type,cid:item.commentId,t:item.liked?0:1});item.liked=!item.liked;item.likedCount=Math.max(0,(item.likedCount||0)+(item.liked?1:-1));await commentPage(resource,type)}catch(e){toast(e.message)}}),button('回复',()=>writeComment(resource,type,item)))
      if(resource&&String(item.user?.userId)===String(getProfile()?.userId))actions.append(button('删除',async()=>{if(!window.confirm('删除这条评论？'))return;try{await request('/comment',{id:resource.id,type,t:0,commentId:item.commentId});await commentPage(resource,type)}catch(e){toast(e.message)}},'quiet-danger'))
      body.append(actions);article.append(avatar,body);target.append(article)
    }
    async function playVideo(item){try{const isVideo=Boolean(item.vid),result=await request(isVideo?'/video/url':'/mv/url',{id:item.vid||item.id,res:1080,r:1080});const url=PlayerCore.safeImage(isVideo?result.urls?.[0]?.url:result.data?.url);if(!url)throw new Error('这段视频暂时无法播放。');$('visual-media-title').textContent=item.name||item.title||'音乐视频';const video=$('visual-media');video.src=url;video.poster=PlayerCore.safeImage(V.picture(item));video.onplay=pauseAudio;activeMedia=video;if(!$('visual-media-dialog').open)$('visual-media-dialog').showModal();await video.play()}catch(e){toast(e.message)}}
    $('visual-media-close').onclick=()=>$('visual-media-dialog').close();$('visual-media-dialog').addEventListener('close',()=>{if(activeMedia){activeMedia.pause();activeMedia.removeAttribute('src');activeMedia.load();activeMedia=null}})
    async function profilePage(){const result=await request('/user/account');const profile=result.profile||getProfile();if(!profile)return;context.user=profile;const card=el('div',null,'profile-hero');card.append(image(profile,'profile-photo'),el('div',profile.nickname,'profile-name'),el('p',profile.signature||'留一点空间，给喜欢的音乐。'));card.append(button('更换头像',()=>uploadImage('/avatar/upload',{},profilePage)));$('visual-results').append(card);renderInformation(profile,$('visual-results'))}
    function editProfile(){if(!requireLogin())return;const p=getProfile();dialog('编辑个人资料','让音乐空间更像你。',[field('昵称',{name:'nickname',value:p.nickname,required:true}),field('个性签名',{name:'signature',value:p.signature||'',multiline:true}),field('性别',{name:'gender',value:String(p.gender||0),options:V.spec({route:'/user/update',params:[{name:'gender'}],supported:true}).fields[0].options}),field('生日',{name:'birthday',type:'date',value:p.birthday>0?new Date(p.birthday).toISOString().slice(0,10):''})],async values=>{if(values.birthday==='')delete values.birthday;await request('/user/update',{province:p.province,city:p.city,birthday:p.birthday,...values});await onAccountChange();await openSection('profile')},'保存资料')}
    function messageObject(item){try{return typeof item.msg==='string'?JSON.parse(item.msg):item.msg||{}}catch{return{msg:item.msg}}}
    function renderConversation(item,target){const other=item.fromUser?.userId===getProfile()?.userId?item.toUser:item.fromUser,body=messageObject(item),card=button('',()=>conversation(other),'conversation-card');card.append(image(other||{},'social-avatar'));const text=el('span',null,'conversation-copy');text.append(el('strong',other?.nickname||'音乐好友'),el('small',body.msg||body.title||'分享了一段音乐'));card.append(text);if(item.time)card.append(el('time',new Date(item.time).toLocaleDateString('zh-CN')));target.append(card)}
    async function conversation(user){if(!user)return;header(`和 ${user.nickname} 的消息`,'分享音乐，也分享生活。',[button('写消息',()=>newMessage(user))]);const result=await request('/msg/private/history',{uid:user.userId,limit:30});$('visual-results').replaceChildren();const list=el('div',null,'message-thread');for(const item of [...(result.msgs||[])].reverse()){const msg=messageObject(item),row=el('article',null,'message-bubble'+(item.fromUser?.userId===getProfile()?.userId?' mine':''));row.append(el('small',item.fromUser?.nickname||''),el('p',msg.msg||msg.title||'分享了一段音乐'));if(msg.song)row.append(button('播放分享的歌曲',()=>onPlaySongs([msg.song],0)));list.append(row)}$('visual-results').append(list)}
    function newMessage(user){if(!requireLogin())return;if(!user)return pick('user',{},items=>newMessage(items[0]));dialog(`给 ${user.nickname||user.name} 写消息`,'把你的想法，送给这位音乐好友。',[field('消息内容',{name:'msg',multiline:true,required:true})],async values=>{await request('/send/text',{user_ids:String(user.userId||user.id),...values});await conversation(user)},'发送消息')}
    function renderEvent(item,target){let data={};try{data=JSON.parse(item.json||'{}')}catch{ /* Plain content is still shown. */ }const card=el('article',null,'social-card'),body=el('div',null,'social-body');body.append(el('strong',item.user?.nickname||'音乐好友'),el('p',data.msg||data.text||''));if(data.song)body.append(button('播放分享的歌曲',()=>onPlaySongs([data.song],0)));if(item.user)body.append(button('查看主页',()=>openEntity('user',item.user)));card.append(image(item.user||{},'social-avatar'),body);target.append(card)}
    function openTask(item){context.task=item;showServices(/yunbei/i.test(currentRoute)?'云贝':'会员')}
    async function pick(kind,options,done){
      const cfg={multiple:false,field:'id',...options};let selected=[];pickJob={kind,cfg,done};$('resource-picker-title').textContent=`选择${{song:'歌曲',playlist:'歌单',artist:'歌手',album:'专辑',user:'用户',video:'视频',radio:'播客',comment:'评论',task:'任务',category:'分类',room:'房间'}[kind]||'内容'}`;$('resource-picker-search').value='';$('resource-picker-results').replaceChildren();$('resource-picker-status').textContent='';$('resource-picker-done').hidden=!cfg.multiple
      async function list(query=''){
        $('resource-picker-status').textContent='正在查找…'
        try{let values=[]
          if(kind==='playlist'&&!query&&getProfile())values=(await request('/user/playlist',{uid:getProfile().userId,limit:100})).playlist||[]
          else if(kind==='comment'){const s=context.commentResource?.resource||getCurrent();values=(await request('/comment/music',{id:s.id,limit:30})).comments||[]}
          else if(kind==='category')values=(await request('/dj/catelist')).categories||[]
          else if(kind==='task')values=V.records(await request('/vip/tasks'),'/vip/tasks')
          else if(kind==='room'){const r=await request('/listentogether/status');const data=r.data?.roomInfo||r.data||r;values=data.roomId?[{...data,name:'当前一起听房间'}]:[]}
          else{const types={song:1,playlist:1000,artist:100,album:10,user:1002,video:1004,radio:1009};const result=await request('/cloudsearch',{keywords:query||({song:'轻音乐',artist:'华语',album:'新专辑',radio:'音乐',video:'音乐',user:'音乐'}[kind]||'音乐'),type:types[kind]||1,limit:20});values=V.records(result,'/search')}
          const container=$('resource-picker-results');container.replaceChildren()
          for(const item of values){const b=button('',()=>{if(cfg.multiple){const index=selected.findIndex(x=>String(V.resourceValue(x,cfg.field))===String(V.resourceValue(item,cfg.field)));if(index<0)selected.push(item);else selected.splice(index,1);b.classList.toggle('selected',index<0);$('resource-picker-status').textContent=`已选择 ${selected.length} 项`}else{$('resource-picker').close();done([item])}},'resource-choice');b.append(image(item,'resource-choice-art'),el('span',kind==='comment'?`${item.user?.nickname||'听友'}：${item.content}`:V.display(item)));container.append(b)}
          $('resource-picker-status').textContent=values.length?`选择你想使用的内容${cfg.multiple?'，可多选':''}`:'暂时没有找到匹配内容。'
        }catch(e){$('resource-picker-status').textContent=e.message}
      }
      pickJob.search=list;$('resource-picker-done').onclick=()=>{if(!selected.length)return;$('resource-picker').close();done(selected)}
      if(!$('resource-picker').open)$('resource-picker').showModal();await list()
    }
    $('resource-picker-close').onclick=()=>$('resource-picker').close();$('resource-picker-form').onsubmit=e=>{e.preventDefault();pickJob?.search($('resource-picker-search').value.trim())}
    async function showServices(filter=''){
      currentSection='services';showSection();header('更多音乐服务','选择你想做的事，内容会以卡片、列表与操作窗口呈现。');await ensureCatalog();$('visual-results').replaceChildren()
      const controls=el('div',null,'service-filters'),search=el('input'),select=el('select');search.type='search';search.placeholder='搜索功能，例如：歌单、会员、动态、听歌记录';search.setAttribute('aria-label','搜索音乐服务');select.append(el('option','全部分类'));select.firstChild.value='';for(const category of [...new Set(catalog.endpoints.map(x=>x.category))]){const option=el('option',category);option.value=category;select.append(option)}if(filter)search.value=filter
      controls.append(search,select);const grid=el('div',null,'music-service-grid');$('visual-results').append(controls,grid)
      function render(){grid.replaceChildren();const seen=new Set();for(const entry of catalog.endpoints){const spec=V.spec(entry);if(spec.internal||entry.requestRoute||seen.has(spec.route))continue;seen.add(spec.route);if(select.value&&entry.category!==select.value)continue;if(search.value&&!`${spec.title} ${entry.category}`.includes(search.value.trim()))continue;const tile=button('',()=>openFeature(entry),'music-service-card');tile.disabled=spec.unavailable;tile.append(el('span',entry.category,'service-category'),el('strong',spec.title),el('small',spec.unavailable?'服务已下架':spec.write?'点击进行管理':'点击浏览内容'));grid.append(tile)}if(!grid.children.length)grid.append(el('p','换一个关键词试试。','visual-empty'))}
      search.oninput=select.onchange=render;render()
    }
    async function openFeature(entry){
      const spec=V.spec(entry);if(spec.unavailable)return
      if(/^\/login(?:\/cellphone|\/qr|\/status)?$/.test(spec.route)){openAccount();return}
      if(spec.route==='/record/recent/song')return openSection('recent')
      if(spec.route==='/likelist')return openLiked()
      if(spec.route.startsWith('/song/download')){onDownload(getCurrent());return}
      if(['/song/url','/song/url/v1','/song/url/v1/302','/lyric','/lyric/new'].includes(spec.route)){document.dispatchEvent(new Event('sonora:show-stage'));return}
      if(spec.route==='/playlist/order/update')return reorderPlaylists()
      if(spec.route==='/song/order/update'&&context.playlist)return reorderTracks(context.playlist)
      if(spec.route==='/comment')return showComments(getCurrent())
      if(spec.route==='/playlist/create')return createPlaylist()
      if(spec.route==='/cloud')return uploadCloud()
      if(spec.route==='/user/update')return editProfile()
      if(spec.route==='/msg/private')return openSection('messages')
      if(spec.route==='/user/playlist')return openSection('playlists')
      if(spec.route==='/user/cloud')return openSection('cloud')
      const fields=spec.fields.map(f=>{let value='',display=''
        if(f.entity){const existing=context[f.entity]||(f.entity==='song'?getCurrent():f.entity==='user'?getProfile():null);if(existing&&!existing.demo&&!existing.local){value=V.resourceValue(existing,f.name);display=V.display(existing)}}
        return field(f.label,{name:f.name,omitEmpty:true,entity:f.entity,multiple:f.multiple,value,display,required:Boolean(f.required),options:f.options,type:f.file?'file':/password|secret/i.test(f.name)?'password':/birthday|startTime|endTime|date/.test(f.name)?'date':'text',accept:f.file?/img/.test(f.name)?'image/*':'audio/*':'',multiline:/content|msg|desc|signature|text/.test(f.name)})})
      if(!fields.length&&!spec.write){header(spec.title,'');return browse(spec.route,{},spec.title,true)}
      dialog(spec.title,spec.write?'选择要管理的内容并保存。':'选择想查看的内容。',fields,async(values,files)=>{
        if((spec.route.includes('/order/update'))&&values.ids)values.ids=JSON.stringify(values.ids.split(','))
        if(spec.write&&/delete|\/del$|remove|rebind|register\/cellphone/.test(spec.route)&&!window.confirm(`确认${spec.title}？请核对已选择的内容。`))return false
        const result=await request(spec.route,values,files);clear();header(spec.title,'');const items=V.records(result,spec.route);currentList=items;currentListKind=spec.route;if(items.length)renderItems(items,spec.route,$('visual-results'));else renderInformation(result,$('visual-results'));status(spec.write?'操作已完成。':'');if(/^\/(login|logout|user\/update)/.test(spec.route))await onAccountChange()
      },spec.write?/删除|移除/.test(spec.title)?'确认移除':'确认保存':'查看内容',/删除|移除/.test(spec.title))
    }
    $('visual-search-form').onsubmit=async event=>{event.preventDefault();const keywords=$('visual-search').value.trim();if(!keywords)return;const types={song:1,playlist:1000,artist:100,album:10,user:1002,video:1004,radio:1009};const type=$('visual-search-kind').value;header(`搜索「${keywords}」`,'点击卡片直接打开或播放。');await browse('/cloudsearch',{keywords,type:types[type]||1},'搜索结果',true)}
    $('recent-open').onclick=()=>openSection('recent')
    $('capability-open').onclick=()=>openSection('home')
    return {accountChanged,afterLogin:()=>{const section=resumeRecent?'recent':'playlists';resumeRecent=false;return openSection(section)},open:()=>openSection('home'),openSection,showSong,openEntity,openLiked,toggleLike,refreshLikes,request,likes}
  }
  const exported={mount,...V}
  if(typeof module!=='undefined'&&module.exports)module.exports=exported;else root.SonoraCapabilities=exported
})(typeof window!=='undefined'?window:globalThis)
