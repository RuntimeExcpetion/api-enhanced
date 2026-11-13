;(function(root){
  'use strict'
  function abortError(){const error=new Error('已取消下载。');error.name='AbortError';return error}
  async function downloadChunks(initial,fetchChunk,{signal,onProgress=()=>{},refresh=async()=>{throw new Error('音源已过期，请重新开始下载。')}}={}){
    const size=Number(initial.size);if(!Number.isSafeInteger(size)||size<=0)throw new Error('音源没有提供文件大小，请使用音源直连。')
    if(size>2*1024*1024*1024)throw new Error('文件超过浏览器下载容量，请使用音源直连。')
    const chunkSize=Math.min(1024*1024,Math.max(1,Number(initial.chunkSize)||1024*1024)),total=Math.ceil(size/chunkSize),parts=new Array(total)
    let metadata=initial,next=0,completed=0,refreshing
    async function renew(){if(!refreshing)refreshing=Promise.resolve(refresh()).then(fresh=>{if(fresh.size!==size||(initial.md5&&fresh.md5&&initial.md5!==fresh.md5))throw new Error('音源已发生变化，请重新开始下载。');metadata=fresh}).finally(()=>{refreshing=null});return refreshing}
    async function worker(){while(next<total){if(signal?.aborted)throw abortError();const index=next++,start=index*chunkSize,end=Math.min(size-1,start+chunkSize-1);let lastError
      for(let attempt=0;attempt<3;attempt++){
        if(signal?.aborted)throw abortError()
        try{
          const response=await fetchChunk(metadata,start,end,signal)
          if(response.status===410){await renew();throw new Error('音源信息已刷新，正在重试。')}
          if(response.status!==206){let message='这段音频没有完整返回，请重试或使用音源直连。';try{const data=await response.json();message=data.message||message}catch{};const error=new Error(message);error.status=response.status;throw error}
          const bytes=await response.arrayBuffer();if(bytes.byteLength!==end-start+1)throw new Error('音频分段传输中断，正在重新获取。')
          if(signal?.aborted)throw abortError()
          parts[index]=bytes;completed+=bytes.byteLength;onProgress(completed,size);lastError=null;break
        }catch(error){if(signal?.aborted)throw abortError();if(error.authSite||[400,401,403,416].includes(error.status))throw error;lastError=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,200*(attempt+1)))}
      }
      if(lastError)throw lastError
    }}
    await Promise.all(Array.from({length:Math.min(3,total)},worker));if(signal?.aborted)throw abortError()
    return new Blob(parts,{type:metadata.contentType||'application/octet-stream'})
  }
  const exported={downloadChunks};if(typeof module!=='undefined'&&module.exports)module.exports=exported;else root.SonoraDownloadEngine=exported
})(typeof window!=='undefined'?window:globalThis)
