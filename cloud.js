const CLOUD_TOKEN_KEY = 'mojingNovelStudio.cloudToken';
let cloudSaveTimer = null;
let cloudStatus = { databaseReady:false, aiConfigured:false, tokenRequired:false };

function getCloudToken(){ return localStorage.getItem(CLOUD_TOKEN_KEY) || ''; }
function setCloudToken(v){ if(v) localStorage.setItem(CLOUD_TOKEN_KEY,v); else localStorage.removeItem(CLOUD_TOKEN_KEY); }
function cloudHeaders(){ const h = {'Content-Type':'application/json'}; const t=getCloudToken(); if(t) h['X-Mojing-Token']=t; return h; }

async function refreshCloudStatus(){
  try{
    const r=await fetch('/api/config',{cache:'no-store'}); cloudStatus=await r.json();
  }catch{ cloudStatus={databaseReady:false,aiConfigured:false,tokenRequired:true}; }
  enhanceSettings();
}

async function cloudUpload(showToast=true){
  if(!cloudStatus.databaseReady){ if(showToast) toast('云数据库尚未连接'); return false; }
  if(cloudStatus.tokenRequired && !getCloudToken()){ if(showToast) toast('请先在设置中填写云端同步密码'); return false; }
  try{
    const r=await fetch('/api/state',{method:'PUT',headers:cloudHeaders(),body:JSON.stringify({state})});
    const d=await r.json();
    if(!r.ok) throw new Error(d.message||'云端保存失败');
    if(showToast) toast('已同步到云端');
    const s=document.querySelector('#saveState'); if(s) s.textContent='已同步';
    return true;
  }catch(e){ if(showToast) toast(e.message); return false; }
}

async function cloudDownload(){
  if(!cloudStatus.databaseReady){ toast('云数据库尚未连接'); return; }
  if(cloudStatus.tokenRequired && !getCloudToken()){ toast('请先填写同步密码'); return; }
  try{
    const r=await fetch('/api/state',{headers:cloudHeaders(),cache:'no-store'}); const d=await r.json();
    if(!r.ok) throw new Error(d.message||'读取失败');
    if(!d.state){ toast('云端暂无项目数据'); return; }
    if(!confirm('从云端加载会覆盖此浏览器当前数据，是否继续？')) return;
    state=d.state; persist(); renderAll(); toast('已从云端恢复');
  }catch(e){ toast(e.message); }
}

const localPersist = persist;
persist = function(){
  localPersist();
  clearTimeout(cloudSaveTimer);
  if(cloudStatus.databaseReady && (!cloudStatus.tokenRequired || getCloudToken())) {
    cloudSaveTimer=setTimeout(()=>cloudUpload(false),900);
  }
};

const baseRenderSettings = renderSettings;
renderSettings = function(){ baseRenderSettings(); enhanceSettings(); };

function enhanceSettings(){
  const host=document.querySelector('#settingsContent'); if(!host) return;
  let box=document.querySelector('#cloudSettingsBox');
  if(!box){
    box=document.createElement('div'); box.id='cloudSettingsBox'; box.className='form-card'; box.style.marginTop='12px'; host.appendChild(box);
  }
  const dbText=cloudStatus.databaseReady?'已连接':'未连接';
  const aiText=cloudStatus.aiConfigured?'已配置':'未配置';
  box.innerHTML=`<h3>云端同步 · v0.2</h3>
    <p class="muted">数据库：${dbText} · AI：${aiText}</p>
    <label>同步密码<input id="cloudTokenInput" type="password" placeholder="输入墨境同步密码" value="${getCloudToken()}"></label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="ghost" id="saveCloudTokenBtn">保存密码</button>
      <button class="ghost" id="cloudUploadBtn">立即上传</button>
      <button class="ghost" id="cloudDownloadBtn">从云端加载</button>
    </div>`;
  document.querySelector('#saveCloudTokenBtn').onclick=()=>{ setCloudToken(document.querySelector('#cloudTokenInput').value.trim()); toast('同步密码已保存在此浏览器'); };
  document.querySelector('#cloudUploadBtn').onclick=()=>cloudUpload(true);
  document.querySelector('#cloudDownloadBtn').onclick=cloudDownload;
}

const originalSendAI = sendAI;
sendAI = async function(custom){
  if(cloudStatus.tokenRequired && !getCloudToken()) { toast('请先在设置中填写云端同步密码'); setView('settings'); return; }
  const prompt=(custom||document.querySelector('#aiPrompt').value).trim(); if(!prompt)return;
  const p=project(),c=chapter(); appendMsg('user',prompt); document.querySelector('#aiPrompt').value=''; appendMsg('assistant','正在请求云端 AI…');
  const messages=[{role:'system',content:`你是“墨境”小说创作引擎。必须服从项目设定，保持人物、伏笔与时间线一致。\n项目：${p.title}\n题材：${p.genre}\n世界观：${JSON.stringify(p.world)}\n人物：${JSON.stringify(p.characters)}\n总纲：${p.outline}\n小说记忆：${JSON.stringify(p.memory)}\n伏笔：${JSON.stringify(p.foreshadow)}\n当前章节：第${c.number}章 ${c.title}\n本章概要：${c.summary}\n当前正文：${c.content}`},{role:'user',content:prompt}];
  try{
    const r=await fetch('/api/ai',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({messages,temperature:.8})}); const data=await r.json();
    replaceLastAssistant(data.ok?data.text:(data.message||'AI 尚未配置。'));
  }catch(e){ replaceLastAssistant('AI 服务暂不可用：'+e.message); }
};

document.querySelector('#sendAiBtn').onclick=()=>sendAI();
document.querySelector('#generateBtn').onclick=()=>sendAI('继续写当前章节的下一段。保持既定视角、人物动机和悬念节奏，不要总结，不要提前揭示最终答案。');
document.querySelectorAll('[data-ai-action]').forEach(b=>b.onclick=()=>sendAI(b.dataset.aiAction));

refreshCloudStatus();
