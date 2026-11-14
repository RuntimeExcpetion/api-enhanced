;(function(root){
  'use strict'
  const labels = {
    id:'选择内容',ids:'选择内容',uid:'选择用户',userId:'选择用户',user_ids:'收件人',userTaskId:'选择任务',taskId:'选择任务',pid:'选择歌单',sid:'选择歌曲',songId:'选择歌曲',songid:'选择歌曲',mvid:'选择 MV',vid:'选择视频',rid:'选择播客',radioId:'选择播客',djRadioId:'选择播客',programId:'选择节目',tracks:'选择歌曲',commentId:'选择评论',parentCommentId:'回复评论',cid:'选择评论',resourceId:'选择内容',targetId:'目标内容',targetSongId:'下一首歌曲',formerSongId:'上一首歌曲',name:'名称',title:'标题',nickname:'昵称',description:'介绍',desc:'描述',signature:'个性签名',tags:'标签',tag:'标签',keywords:'搜索内容',keyword:'搜索内容',content:'写下内容',text:'文字内容',msg:'消息内容',reason:'原因',phone:'手机号码',email:'邮箱地址',password:'密码',md5_password:'加密密码',captcha:'短信验证码',oldcaptcha:'原手机验证码',countrycode:'国家或地区',ctcode:'国家或地区',birthday:'生日',gender:'性别',province:'所在地区',city:'城市',privacy:'谁可以看见',t:'操作',type:'内容类型',op:'操作',level:'音质',br:'音质',r:'清晰度',res:'清晰度',order:'排列方式',sort:'排序',sortType:'排序方式',orderNo:'顺序',year:'年份',month:'月份',date:'日期',startTime:'开始时间',endTime:'结束时间',time:'时间',startTimestamp:'开始时间',categoryId:'分类',category:'分类',cat:'分类',cateId:'分类',tagId:'标签',area:'地区',areaId:'地区',regionId:'地区',areaType:'地区类型',album:'专辑名',artist:'歌手名',song:'歌曲名',songName:'歌曲名',songFile:'选择音频',imgFile:'选择图片',filename:'文件名',like:'喜欢这首音乐',asc:'从旧到新',refresh:'重新获取',period:'时间范围',count:'数量',size:'数量',quantity:'数量',score:'评分',source:'来源',sources:'来源',mode:'模式',submode:'模式',answer:'你的答案',questionId:'选择题目',examType:'考试类型',bpm:'速度',duration:'时长（秒）',progress:'播放进度',playStatus:'播放状态',playMode:'播放模式',commandType:'播放操作',roomId:'一起听房间',inviterId:'邀请人',nicknames:'昵称列表',voiceListId:'声音合集',voiceFeeType:'声音类型',publishTime:'发布时间',autoPublish:'自动发布',autoPublishText:'动态内容',coverImgId:'封面',displayStatus:'展示状态',albumType:'专辑类型',link:'分享链接',uri:'链接',initial:'首字母',channelId:'频道',activityId:'活动',actid:'活动',dataType:'内容范围',dataGapDays:'时间跨度（天）',sourceType:'来源类型',targetType:'内容类型',targetResourceId:'目标内容',total:'包含总数',unblock:'匹配其他可用音源',importStarPlaylist:'导入喜欢的音乐',playlistName:'歌单名称',local:'本地内容',playlist:'选择歌单',scene:'使用场景',markId:'标记',cancel:'取消操作',sortIndex:'排序位置',type_ids:'内容分类',chartCode:'榜单',position:'位置',payment:'付费方式',auditStatus:'审核状态',sortBy:'排序方式',autoPublishTime:'自动发布时间'
  }
  const hidden = new Set(['limit','offset','before','cursor','page','pageNo','pageSize','pagesize','lasttime','lastId','idCursor','timestamp','token','checkToken','sca','sign','key','qrimg','platform','deviceId','deviceKey','currentKeyVersion','md5','fileSize','fileType','imgSize','imgX','imgY','clientSeq','version','evid','evId','threadId','sessionId','appInfo','rightsExtJson','rightsGainMethod','rightsGainDuration','extraRightsGainMethod','extraRightsGainDuration','nextRightsGainDuration','exposureTime','clickTime','installed','sourceid','sourceId','coverImgId','moduleId','parentCommentId'])
  const internal = /^\/(?:api$|decrypt|eapi\/decrypt|weblog|register\/(?:checktoken|xeapikey)|login\/qr\/|song\/url\/ncmget|listentogether\/(?:heatbeat|play\/command|sync\/list\/command))/
  const choices = {
    gender:[['0','保密'],['1','男'],['2','女']],privacy:[['0','公开'],['10','仅自己可见']],
    level:[['standard','标准'],['higher','较高'],['exhigh','极高'],['lossless','无损'],['hires','Hi-Res'],['jyeffect','高清环绕声'],['sky','沉浸环绕声'],['dolby','杜比全景声'],['jymaster','超清母带']],
    br:[['128000','标准'],['320000','极高'],['999000','最高可用']],r:[['240','流畅'],['480','标清'],['720','高清'],['1080','超清']],res:[['240','流畅'],['480','标清'],['720','高清'],['1080','超清']],
    op:[['add','添加'],['del','移除']],t:[['1','添加 / 收藏'],['0','删除 / 取消']],like:[['true','喜欢'],['false','取消喜欢']],asc:[['false','从新到旧'],['true','从旧到新']],order:[['hot','热门优先'],['time','最新优先']],countrycode:[['86','中国大陆 +86'],['852','中国香港 +852'],['853','中国澳门 +853'],['886','中国台湾 +886'],['1','美国 / 加拿大 +1'],['81','日本 +81'],['82','韩国 +82'],['44','英国 +44']],ctcode:[]
  }
  choices.ctcode=choices.countrycode
  const customTitles = {'/album/songsaleboard':'数字专辑榜','/yunbei/expense':'云贝支出','/yunbei/receipt':'云贝收入','/user/bindingcellphone':'绑定手机','/listentogether/accept':'接受一起听邀请','/register/anonimous':'游客体验'}
  function title(entry){return (customTitles[entry.route]||entry.title).replace(/^\d+\.\s*/, '').replace(/^获取/, '').replace(/接口/g,'').replace(/\(.*?\)|（.*?）/g,'').replace(/ - 新版| - 旧版| - v\d+/g,'').trim() || '音乐服务'}
  function entity(route,field){
    if(/commentId|cid|parentComment/.test(field))return 'comment'
    if(/user_ids|uid|userId|inviterId|reqUid/.test(field)||(/^\/user\//.test(route)&&field==='id')||route==='/follow')return 'user'
    if(/task|question|activity|actid/i.test(field))return 'task'
    if(/roomId/.test(field))return 'room'
    if(/category|cateId|cat$|tagId|areaId|regionId/i.test(field))return 'category'
    if(/tracks|songId|songid|targetSong|formerSong|sid/.test(field))return 'song'
    if(/pid|playlist/.test(field))return 'playlist'
    if(/mvid|vid/.test(field))return 'video'
    if(/rid|radioId|djRadioId|voiceListId/.test(field))return 'radio'
    if(/programId/.test(field))return 'program'
    if(!/^(id|ids|resourceId|targetId)$/.test(field))return null
    if(/^\/(playlist|toplist)/.test(route))return 'playlist'
    if(/^\/artist/.test(route))return 'artist'
    if(/^\/album/.test(route))return 'album'
    if(/^\/(mv|video|mlog)/.test(route))return 'video'
    if(/^\/(dj|voice|voicelist)/.test(route))return 'radio'
    if(/^\/user/.test(route))return 'user'
    return 'song'
  }
  function label(param){if(labels[param.name])return labels[param.name];const text=(param.description||'').replace(/ID|id|接口|参数/g,'').split(/[，,。:：]/)[0].trim();return text&&text.length<22&&/[\u4e00-\u9fa5]/.test(text)?text:'补充内容'}
  function spec(entry){
    const route=entry.requestRoute||entry.route
    const fields=entry.params.filter(p=>!hidden.has(p.name)).map(p=>({...p,label:label(p),entity:entity(route,p.name),multiple:/^(ids|tracks|user_ids|type_ids)$/.test(p.name),options:choices[p.name]}))
    for(const f of fields){
      if(f.name==='type'){
        if(route==='/playlist/create')f.options=[['NORMAL','音乐歌单'],['VIDEO','视频歌单'],['SHARED','共享歌单']]
        else if(route==='/user/record')f.options=[['1','最近一周'],['0','所有时间']]
        else if(route==='/artist/list')f.options=[['-1','全部'],['1','男歌手'],['2','女歌手'],['3','乐队组合']]
        else if(route==='/mv/all')f.options=['全部','官方版','原生','现场版','网易出品'].map(x=>[x,x])
        else if(route==='/comment')f.options=[['0','歌曲'],['1','MV'],['2','歌单'],['3','专辑'],['4','节目'],['5','视频'],['6','动态']]
      }
      if(f.name==='area')f.options=(route==='/artist/list'?[['-1','全部'],['7','华语'],['96','欧美'],['8','日本'],['16','韩国'],['0','其他']]:['全部','内地','港台','欧美','日本','韩国'].map(x=>[x,x]))
      if(f.name==='order'&&route==='/mv/all')f.options=['上升最快','最热','最新'].map(x=>[x,x])
      if(f.name==='t'&&route==='/comment')f.options=[['1','发表评论'],['2','回复评论'],['0','删除评论']]
    }
    return {title:title(entry),route,fields,internal:internal.test(route),unavailable:!entry.supported,write:entry.mutating||/(?:^|\/)(?:delete|del|update|create|subscribe|follow|like|send|publish|upload|gain|finish|submit|start|end|accept|command|sign|reward|share|buy|payment|activate|order|remove)(?:\/|$)/.test(route)}
  }
  function unwrap(result){const value=result?.body&&typeof result.body==='object'?result.body:result;if(value?.code&&![200,800,801,802,803].includes(value.code)){const error=new Error(value.message||value.msg||'暂时无法完成，请稍后重试。');error.code=value.code;throw error}return value||{}}
  function records(result,route=''){
    const r=unwrap(result), candidates=[]
    function visit(value,key='',depth=0){
      if(depth>4||!value||typeof value!=='object')return
      if(Array.isArray(value)){
        const list=value.filter(item=>item&&typeof item==='object')
        if(list.length)candidates.push({key,list,depth})
        return
      }
      for(const [name,item]of Object.entries(value))if(!/cookie|token|privilege|bitrate|level|fee|beReplied/i.test(name))visit(item,name,depth+1)
    }
    visit(r)
    const preferred=/comment/.test(route)?['comments','hotComments']:/msg/.test(route)?['msgs','messages','comments','notices']:['songs','tracks','hotSongs','dailySongs','playlist','playlists','albums','artists','djRadios','programs','mvs','videos','events','msgs','list','result','data']
    candidates.sort((a,b)=>{const i=preferred.indexOf(a.key),j=preferred.indexOf(b.key);return(i<0?50:i)-(j<0?50:j)||a.depth-b.depth})
    return candidates[0]?.list||[]
  }
  function kind(item,route=''){
    if(item.mainSong)return 'program'
    if(item.songFile||item.simpleSong||item.songId&&item.fileName)return 'cloud'
    if(item.commentId!=null)return 'comment'
    if(item.fromUser)return 'conversation'
    if(item.eventTime||item.json&&item.user)return 'event'
    if(item.ar||item.artists&&item.album||item.al||item.dt)return 'song'
    if(item.trackCount!=null||item.coverImgUrl&&item.creator)return 'playlist'
    if(item.artistName&&item.duration!=null||item.vid||item.coverUrl&&item.creator)return 'video'
    if(item.programCount!=null||item.radioId||/\/dj\//.test(route)&&item.dj)return 'radio'
    if(item.picUrl&&item.artist||/\/album/.test(route)&&item.name)return 'album'
    if(item.userId||item.nickname)return 'user'
    if(item.albumSize!=null||item.musicSize!=null||/artist/.test(route)&&item.name)return 'artist'
    if(/toplist|playlist/.test(route)&&item.id&&item.name)return 'playlist'
    if(/\/mv\//.test(route)&&item.id)return 'video'
    if(/artist/.test(route)&&item.id)return 'artist'
    if(/album/.test(route)&&item.id)return 'album'
    if(/dj|radio|voice/.test(route)&&item.id)return 'radio'
    if(item.taskId||item.userTaskId)return 'task'
    return 'info'
  }
  function display(item){return item.name||item.title||item.nickname||item.songName||item.fileName||item.description||item.desc||item.content||'音乐内容'}
  function picture(item){return item.picUrl||item.coverImgUrl||item.cover||item.coverUrl||item.avatarUrl||item.imgurl||item.album?.picUrl||item.al?.picUrl||item.user?.avatarUrl||item.fromUser?.avatarUrl||item.radio?.picUrl||''}
  function resourceValue(item,field){return item[field]??item.commentId??item.songId??item.userTaskId??item.taskId??item.roomId??item.userId??item.vid??item.id??item.radio?.id}
  function extractSongs(result){if(!result||typeof result!=='object')return[];const value=result.songs||result.result?.songs||result.data?.songs||result.data?.dailySongs||result.playlist?.tracks||(Array.isArray(result.result)?result.result.map(x=>x.song||x):[]);return Array.isArray(value)?value.filter(x=>x&&x.id!=null&&x.name&&(x.ar||x.artists||x.al||x.album)):[]}
  function redacted(value){return JSON.stringify(value,(key,item)=>/cookie|password|secret|token|authorization|^MUSIC_[UA]$/i.test(key)?'[已隐藏凭证]':item,2)}
  function payload(fields,extraText){let extra;try{extra=JSON.parse(extraText||'{}')}catch{throw new Error('额外参数必须是有效的 JSON 对象。')}if(!extra||typeof extra!=='object'||Array.isArray(extra))throw new Error('额外参数请填写 JSON 对象。');const params={...extra},files=[];for(const{name,value,file}of fields){if(file){if(file.size)files.push({name,file})}else if(value!=='')params[name]=value}return{params,files}}
  function recentSongs(result,normalizeSong){
    const list=result?.data?.list||result?.list||[]
    if(!Array.isArray(list))return[]
    const unique=new Map()
    for(const record of list){
      if(!record||typeof record!=='object')continue
      const raw=record.data?.song||record.data||record.song||record.resource
      if(!raw||typeof raw!=='object')continue
      const id=raw.id??record.resourceId,name=raw.name||record.resourceName
      if(id==null||!String(id)||!name)continue
      let playedAt=Number(record.playTime??record.playedAt??record.time??0)
      if(!Number.isFinite(playedAt))playedAt=Date.parse(record.playTime||record.playedAt||'')||0
      if(playedAt>0&&playedAt<100000000000)playedAt*=1000
      if(playedAt<0||playedAt>8640000000000000)playedAt=0
      const song={...normalizeSong({...raw,id,name}),playedAt}
      const previous=unique.get(song.id)
      if(!previous||song.playedAt>previous.playedAt)unique.set(song.id,song)
    }
    return [...unique.values()].sort((a,b)=>b.playedAt-a.playedAt)
  }
  function recentSummary(result,songs){
    const list=result?.data?.list||result?.list||[],returned=Array.isArray(list)?list.length:0
    const count=result?.data?.total??result?.total,total=Number.isInteger(Number(count))&&count!==null&&count!==undefined&&Number(count)>=0?Number(count):null
    return {returned,displayed:songs.length,total}
  }
  function recentTime(time,timeZone){
    if(!Number.isFinite(time)||time<=0)return '未提供播放时间'
    return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',...(timeZone?{timeZone}:{})}).format(new Date(time))
  }
  const exported={recentSongs,recentSummary,recentTime,labels,hidden,spec,unwrap,records,kind,display,picture,resourceValue,extractSongs,redacted,payload}
  if(typeof module!=='undefined'&&module.exports)module.exports=exported;else root.SonoraVisual=exported
})(typeof window!=='undefined'?window:globalThis)
