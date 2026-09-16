const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const STORAGE_KEY = 'mojingNovelStudio.v01';

const sampleChapter = `方远舟把录音机带回了五金店。\n\n后屋的小桌上，五台录音机排成一排。他用一条转接线把录音机连到笔记本电脑上，把磁带内容转录成数字文件，然后在音频编辑软件里打开。\n\n波形图很直观——每一秒的声音都被转化成一条上下波动的线。正常的说话声音波形是连续的，有起伏但不断裂。\n\n而方远舟看到的波形图上，每一盘录音都有至少一处断裂。\n\n断裂的特征完全一致：波形在某个点突然截断，然后从另一个点重新开始。两个点之间没有任何过渡，只有一段很短的静音——大约零点三秒。\n\n这不是磁带自然断裂，是人工剪辑。\n\n有人剪辑过这些录音。\n\n方远舟把五份证词放到桌上，一份一份对照。\n\n第一份说当天有五个人。\n第二份说四个。\n第三份坚持只有三个人。\n\n他停住了。\n\n门外传来一声极轻的金属碰撞。\n\n像是谁刚刚碰到了门把手。`;

const seed = {
  activeProjectId:'p1', activeChapterId:'c6', activeView:'editor', writingMode:'逐章串行',
  projects:[
    {id:'p1',title:'权谋天下',genre:'穿越言情 / 权谋',status:'进行中',targetWords:150000,
      premise:'现代女性沈清舟穿越成前朝公主，与腹黑权臣陆景行在朝堂权斗中相爱相杀。',
      world:{type:'架空历史',era:'虚构朝代：大晟',rules:'皇权衰弱、门阀割据、边军坐大。史官制度严格，诏令必须留档。',theme:'权力、身份与选择'},
      outline:'第一幕：沈清舟醒于废宫，发现原主留下的死亡线索。\n第二幕：她与陆景行被迫结盟，以假婚约进入权力中心。\n第三幕：太子与皇帝围绕储位爆发正面对抗。\n终局：两人必须在爱情、皇权与真相之间做选择。',
      characters:[
        {name:'沈清舟',role:'女主',traits:'冷静、敏锐、现代法律思维',goal:'活下去并查清原主死亡真相'},
        {name:'陆景行',role:'男主',traits:'外冷内热、铁腕、克制',goal:'重建秩序，同时保护不能公开的秘密'},
        {name:'太子',role:'反派',traits:'多疑、野心勃勃',goal:'提前夺取皇位'},
        {name:'皇帝',role:'关键角色',traits:'病弱、猜忌、控制欲强',goal:'延缓权力交接'}
      ],
      memory:[
        {type:'事件',text:'录音带存在人工剪辑痕迹。'},
        {type:'未揭示信息',text:'陆景行知道沈清舟身份异常，但没有证据。'},
        {type:'道具',text:'铜制旧钥匙，来源尚未解释。'}
      ],
      foreshadow:[
        {id:'f1',status:'未回收',source:'第 3 章',text:'录音里重复出现三次的钟声。',plan:'第 12-15 章回收'},
        {id:'f2',status:'未回收',source:'第 6 章',text:'不同证词对当天在场人数描述不同。',plan:'第 18 章揭示记忆被篡改'}
      ],
      chapters:Array.from({length:14},(_,i)=>({id:'c'+(i+1),number:i+1,title:['异世惊梦','朝堂暗流','长安雨夜','疗养院','地下室','第一道裂痕','回城','暗棋','猎人与猎物','旧卷宗','试探','疗养院的护工','沉寂的噩梦','信任的崩塌'][i],summary:i===5?'核心事件：四人复听录音，发现剪辑痕迹与记忆不一致。\n悬念钩子：每个人对“当天在场人数”的描述都不同。':'待补充本章概要。',content:i===5?sampleChapter:'',updatedAt:Date.now()}))
    },
    {id:'p2',title:'沉渊',genre:'悬疑推理',status:'已完成',targetWords:120000,premise:'一座疗养院里，每个人都记得不同版本的同一场事故。',world:{type:'现代都市',era:'近未来',rules:'封闭疗养院、数字取证受限',theme:'记忆与证词'},outline:'已完成项目。',characters:[],memory:[],foreshadow:[],chapters:Array.from({length:30},(_,i)=>({id:'p2c'+(i+1),number:i+1,title:'第 '+(i+1)+' 章',summary:'',content:'',updatedAt:Date.now()}))}
  ]
};

function clone(x){return JSON.parse(JSON.stringify(x))}
let state = loadState();
let saveTimer=null;
let wizardStep=0;
let wizardDraft={title:'',genre:'悬疑推理',protagonist:'双主角',worldType:'现代都市',theme:'真相与选择',chapterCount:30,mode:'逐章串行'};

function loadState(){
  try{const raw=localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):clone(seed)}catch{return clone(seed)}
}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); $('#saveState').textContent='已保存'}
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1700)}
function project(){return state.projects.find(p=>p.id===state.activeProjectId)||state.projects[0]}
function chapter(){const p=project();return p.chapters.find(c=>c.id===state.activeChapterId)||p.chapters[0]}
function escapeHtml(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function countWords(s=''){return s.replace(/\s/g,'').length}

function renderAll(){renderSidebar();renderEditor();renderDashboard();renderWorld();renderCharacters();renderOutline();renderMemory();renderForeshadow();renderSettings();setView(state.activeView||'editor',false)}
function renderSidebar(){const p=project();$('#sideProjectTitle').textContent='《'+p.title+'》';const q=$('#chapterSearch').value.trim();$('#chapterList').innerHTML=p.chapters.filter(c=>!q||c.title.includes(q)||String(c.number).includes(q)).map(c=>`<button class="chapter-item ${c.id===state.activeChapterId?'active':''}" data-chapter="${c.id}"><span class="chapter-num">${String(c.number).padStart(2,'0')}</span><span>${escapeHtml(c.title)}</span></button>`).join('');$$('[data-chapter]').forEach(b=>b.onclick=()=>{state.activeChapterId=b.dataset.chapter;state.activeView='editor';persist();renderAll()})}
function renderEditor(){const p=project(),c=chapter();$('#breadcrumb').textContent=`${p.title} / 第 ${c.number} 章`;$('#viewTitle').textContent=c.title;$('#chapterTitleInput').value=c.title;$('#chapterSummary').innerHTML=escapeHtml(c.summary||'待补充本章概要。').replace(/\n/g,'<br>');$('#chapterEditor').value=c.content||'';$('#wordCount').textContent=countWords(c.content||'')+' 字';$('#aiContext').innerHTML=`<b>${escapeHtml(p.title)}</b><br>${escapeHtml(p.genre)}<br>当前：第 ${c.number} 章《${escapeHtml(c.title)}》<br>模式：${escapeHtml(state.writingMode)}`}
function renderDashboard(){const projects=state.projects;$('#projectGrid').innerHTML=projects.map(p=>{const written=p.chapters.filter(c=>countWords(c.content)>0).length;const pct=Math.min(100,Math.round(written/Math.max(1,p.chapters.length)*100));return `<article class="project-card" data-project="${p.id}"><div class="eyebrow">${escapeHtml(p.status)}</div><h3>《${escapeHtml(p.title)}》</h3><p>${escapeHtml(p.genre)} · ${p.chapters.length} 章 · ${written} 章已有正文</p><div class="progress-bar"><i style="width:${pct}%"></i></div></article>`}).join('');$$('[data-project]').forEach(x=>x.onclick=()=>{state.activeProjectId=x.dataset.project;state.activeChapterId=project().chapters[0]?.id;state.activeView='editor';persist();renderAll()})}
function pageHead(kicker,title,desc){return `<div class="page-head"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${desc}</p></div></div>`}
function renderWorld(){const p=project(),w=p.world||{};$('#worldContent').innerHTML=pageHead('WORLD BUILDING','世界观','所有规则都会进入 AI 写作上下文。')+`<div class="two-col"><div class="form-card"><label>世界类型<input data-world="type" value="${escapeHtml(w.type||'')}"></label><label>时代 / 地理<input data-world="era" value="${escapeHtml(w.era||'')}"></label><label>核心主题<input data-world="theme" value="${escapeHtml(w.theme||'')}"></label></div><div class="form-card"><label>不可违背的世界规则<textarea data-world="rules">${escapeHtml(w.rules||'')}</textarea></label></div></div>`;$$('[data-world]').forEach(el=>el.oninput=()=>{p.world[el.dataset.world]=el.value;persist()})}
function renderCharacters(){const p=project();$('#charactersContent').innerHTML=pageHead('CHARACTERS','人物档案','维护人物身份、性格、目标与长期一致性。')+`<div class="project-grid">${p.characters.map((c,i)=>`<article class="character-card"><div class="eyebrow">${escapeHtml(c.role)}</div><h3>${escapeHtml(c.name)}</h3><p><b>性格：</b>${escapeHtml(c.traits)}<br><b>目标：</b>${escapeHtml(c.goal)}</p></article>`).join('')}</div><div class="form-card" style="margin-top:12px"><button class="ghost" id="addCharacter">＋ 新增人物</button></div>`;$('#addCharacter').onclick=()=>{const name=prompt('人物名称');if(!name)return;p.characters.push({name,role:'配角',traits:'待设定',goal:'待设定'});persist();renderCharacters()}}
function renderOutline(){const p=project();$('#outlineContent').innerHTML=pageHead('STORY OUTLINE','故事大纲','从总纲到章节结构，作为长篇创作的骨架。')+`<div class="form-card"><label>故事一句话<input id="premiseField" value="${escapeHtml(p.premise||'')}"></label><label>总纲<textarea id="outlineField" style="min-height:320px">${escapeHtml(p.outline||'')}</textarea></label></div>`;$('#premiseField').oninput=e=>{p.premise=e.target.value;persist()};$('#outlineField').oninput=e=>{p.outline=e.target.value;persist()}}
function renderMemory(){const p=project();$('#memoryContent').innerHTML=pageHead('NOVEL MEMORY','小说记忆库','把每章关键事实沉淀成可检索的长期记忆。')+`<div class="project-grid">${p.memory.map((m,i)=>`<article class="memory-card"><div class="eyebrow">${escapeHtml(m.type)}</div><p>${escapeHtml(m.text)}</p></article>`).join('')}</div><div class="form-card" style="margin-top:12px"><button class="ghost" id="addMemory">＋ 新增记忆</button></div>`;$('#addMemory').onclick=()=>{const text=prompt('记忆内容');if(!text)return;p.memory.push({type:'事件',text});persist();renderMemory()}}
function renderForeshadow(){const p=project();$('#foreshadowContent').innerHTML=pageHead('FORESHADOWING','伏笔管理','记录埋设位置、状态和预计回收章节。')+`<div class="list-table">${p.foreshadow.map(f=>`<div class="list-row"><div>${escapeHtml(f.status)}</div><div>${escapeHtml(f.text)}<div class="muted">来源：${escapeHtml(f.source)}</div></div><div class="muted">${escapeHtml(f.plan)}</div></div>`).join('')||'<div class="list-row"><div>—</div><div>暂无伏笔</div><div></div></div>'}</div>`}
function renderSettings(){const p=project();$('#settingsContent').innerHTML=pageHead('SETTINGS','项目设置','当前 MVP 的数据保存在此浏览器；云数据库将在下一阶段接入。')+`<div class="two-col"><div class="setting-card"><h3>写作模式</h3><p>${escapeHtml(state.writingMode)}</p></div><div class="setting-card"><h3>数据位置</h3><p>浏览器 LocalStorage（v0.1）</p></div><div class="setting-card"><h3>AI 后端</h3><p>通过云端 /api/ai 代理，不在浏览器暴露密钥。</p></div><div class="setting-card"><h3>当前项目</h3><p>${escapeHtml(p.title)} · ${p.chapters.length} 章</p></div></div>`}

function setView(name,save=true){state.activeView=name;$$('.view').forEach(v=>v.classList.remove('active-view'));const map={editor:'editorView',dashboard:'dashboardView',world:'worldView',characters:'charactersView',outline:'outlineView',memory:'memoryView',foreshadow:'foreshadowView',settings:'settingsView'};$('#'+(map[name]||'editorView')).classList.add('active-view');$$('.rail-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(save)persist()}

$('#chapterEditor').addEventListener('input',e=>{const c=chapter();c.content=e.target.value;c.updatedAt=Date.now();$('#wordCount').textContent=countWords(c.content)+' 字';$('#saveState').textContent='保存中…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>{persist();renderDashboard()},450)});
$('#chapterTitleInput').addEventListener('input',e=>{chapter().title=e.target.value;$('#viewTitle').textContent=e.target.value;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{persist();renderSidebar()},350)});
$('#chapterSearch').oninput=renderSidebar;
$('#addChapterBtn').onclick=()=>{const p=project();const n=p.chapters.length+1;const c={id:'c'+Date.now(),number:n,title:'未命名章节',summary:'待补充本章概要。',content:'',updatedAt:Date.now()};p.chapters.push(c);state.activeChapterId=c.id;persist();renderAll();toast('已创建新章节')};
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));

function openWizard(){wizardStep=0;wizardDraft={title:'',genre:'悬疑推理',protagonist:'双主角',worldType:'现代都市',theme:'真相与选择',chapterCount:30,mode:state.writingMode};$('#wizardModal').classList.remove('hidden');renderWizard()}
$('#newNovelBtn').onclick=openWizard;$('#newNovelBtn2').onclick=openWizard;
function renderWizard(){const steps=['核心定位','世界观','结构','写作模式'];$('#stepper').innerHTML=steps.map((s,i)=>`<i class="step-dot ${i<=wizardStep?'active':''}"></i>`).join('');let html='';if(wizardStep===0)html=`<div class="wizard-fields"><label>小说名称<input id="wTitle" value="${escapeHtml(wizardDraft.title)}" placeholder="例如：长夜未央"></label><label>题材<select id="wGenre"><option>悬疑推理</option><option>穿越言情</option><option>都市异能</option><option>东方玄幻</option><option>科幻</option></select></label><label>主角结构<select id="wPro"><option>双主角</option><option>单男主</option><option>单女主</option><option>群像</option></select></label></div>`;if(wizardStep===1)html=`<div class="wizard-grid">${['架空历史','真实历史朝代','现代都市','东方玄幻','近未来','自定义世界'].map(x=>`<button class="wizard-option ${wizardDraft.worldType===x?'selected':''}" data-worldtype="${x}"><b>${x}</b><span>点击选择作为基础世界框架。</span></button>`).join('')}</div><div class="wizard-fields" style="margin-top:12px"><label>核心主题<input id="wTheme" value="${escapeHtml(wizardDraft.theme)}"></label></div>`;if(wizardStep===2)html=`<div class="wizard-fields"><label>计划章节数<input id="wCount" type="number" min="5" max="300" value="${wizardDraft.chapterCount}"></label><p style="color:var(--muted);font-size:11px">后续会在此基础上生成分卷、章节目标、关键转折和免费区钩子。</p></div>`;if(wizardStep===3)html=`<div class="wizard-grid">${['逐章串行','子 Agent 并行','导演模式','联合创作'].map(x=>`<button class="wizard-option ${wizardDraft.mode===x?'selected':''}" data-wmode="${x}"><b>${x}</b><span>${x==='逐章串行'?'连续性优先':x==='子 Agent 并行'?'批量生产，最后统一复核':x==='导演模式'?'AI 出结构，你写正文':'人机交替写作'}</span></button>`).join('')}</div>`;$('#wizardBody').innerHTML=html;$('#wizardPrev').style.visibility=wizardStep?'visible':'hidden';$('#wizardNext').textContent=wizardStep===3?'创建项目':'下一步';if($('#wGenre')){$('#wGenre').value=wizardDraft.genre;$('#wPro').value=wizardDraft.protagonist}$$('[data-worldtype]').forEach(b=>b.onclick=()=>{wizardDraft.worldType=b.dataset.worldtype;renderWizard()});$$('[data-wmode]').forEach(b=>b.onclick=()=>{wizardDraft.mode=b.dataset.wmode;renderWizard()})}
function captureWizard(){if($('#wTitle'))wizardDraft.title=$('#wTitle').value.trim();if($('#wGenre'))wizardDraft.genre=$('#wGenre').value;if($('#wPro'))wizardDraft.protagonist=$('#wPro').value;if($('#wTheme'))wizardDraft.theme=$('#wTheme').value;if($('#wCount'))wizardDraft.chapterCount=Math.max(5,Math.min(300,Number($('#wCount').value)||30))}
$('#wizardNext').onclick=()=>{captureWizard();if(wizardStep<3){wizardStep++;renderWizard();return}if(!wizardDraft.title)wizardDraft.title='未命名小说';const id='p'+Date.now();const chapters=Array.from({length:wizardDraft.chapterCount},(_,i)=>({id:id+'c'+(i+1),number:i+1,title:'第 '+(i+1)+' 章',summary:'待规划',content:'',updatedAt:Date.now()}));state.projects.unshift({id,title:wizardDraft.title,genre:wizardDraft.genre,status:'进行中',targetWords:wizardDraft.chapterCount*4000,premise:'',world:{type:wizardDraft.worldType,era:'',rules:'',theme:wizardDraft.theme},outline:'',characters:[],memory:[],foreshadow:[],chapters});state.activeProjectId=id;state.activeChapterId=chapters[0].id;state.writingMode=wizardDraft.mode;state.activeView='editor';persist();$('#wizardModal').classList.add('hidden');renderAll();toast('新小说已创建')};
$('#wizardPrev').onclick=()=>{captureWizard();wizardStep=Math.max(0,wizardStep-1);renderWizard()};$('#wizardSkip').onclick=()=>{$('#wizardNext').click()};
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).classList.add('hidden'));

$('#modeBtn').onclick=()=>$('#modeModal').classList.remove('hidden');$$('.mode-card').forEach(b=>b.onclick=()=>{$$('.mode-card').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');state.writingMode=b.dataset.mode;$('#modeHint').textContent='当前：'+state.writingMode;persist();renderEditor()});

async function sendAI(custom){const prompt=(custom||$('#aiPrompt').value).trim();if(!prompt)return;const p=project(),c=chapter();appendMsg('user',prompt);$('#aiPrompt').value='';appendMsg('assistant','正在请求云端 AI…');const messages=[{role:'system',content:`你是“墨境”小说创作引擎。必须服从项目设定，保持人物与时间线一致。\n项目：${p.title}\n题材：${p.genre}\n世界观：${JSON.stringify(p.world)}\n人物：${JSON.stringify(p.characters)}\n总纲：${p.outline}\n当前章节：第${c.number}章 ${c.title}\n本章概要：${c.summary}\n当前正文：${c.content}`},{role:'user',content:prompt}];try{const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages,temperature:.8})});const data=await r.json();replaceLastAssistant(data.ok?data.text:(data.message||'AI 尚未配置。'))}catch(e){replaceLastAssistant('AI 服务暂不可用：'+e.message)}}
function appendMsg(role,text){const el=document.createElement('div');el.className=role==='user'?'user-msg':'assistant-msg';el.textContent=text;$('#aiMessages').appendChild(el);el.scrollIntoView({behavior:'smooth',block:'end'})}
function replaceLastAssistant(text){const list=$$('#aiMessages .assistant-msg');if(list.length)list[list.length-1].textContent=text;else appendMsg('assistant',text)}
$('#sendAiBtn').onclick=()=>sendAI();$('#generateBtn').onclick=()=>sendAI('继续写当前章节的下一段。保持既定视角、人物动机和悬念节奏，不要总结，不要提前揭示最终答案。');$$('[data-ai-action]').forEach(b=>b.onclick=()=>sendAI(b.dataset.aiAction));

$('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='墨境-小说项目-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href);toast('项目已导出')};
$('#importInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{state=JSON.parse(reader.result);persist();renderAll();toast('项目已导入')}catch{toast('JSON 文件格式不正确')}};reader.readAsText(f)};

renderAll();
