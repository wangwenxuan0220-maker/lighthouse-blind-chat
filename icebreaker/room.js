'use strict';
const API_BASE=(window.ROOM_API_BASE||'').replace(/\/$/,'');
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let id=new URLSearchParams(location.hash.slice(1)).get('room'),credential=null,state=null,selected=null,table='',polling=false,ended=false,refreshHandle,expiryHandle,lastRound,editing=false,solo=false;
const displayToken=new URLSearchParams(location.hash.slice(1)).get('screen');
const key=()=>`lighthouse-room:${id}`;
try{credential=JSON.parse(sessionStorage.getItem(key())||'null');}catch{}
if(displayToken){credential={token:displayToken,role:'display'};document.body.classList.add('projector');}
function store(value){credential=value;try{if(value)sessionStorage.setItem(key(),JSON.stringify(value));else sessionStorage.removeItem(key());}catch{$('status').textContent='浏览器不能保存临时凭证，刷新后需要重新加入。';}}
function clearRoom(message){ended=true;$('topics-screen').hidden=true;$('topic-frame').removeAttribute('src');if(displayToken){$('screen-topic').textContent=message;$('screen-help').replaceChildren();}clearInterval(refreshHandle);clearInterval(expiryHandle);store(null);state=null;selected=null;$('room').hidden=true;$('room').querySelectorAll('input,textarea').forEach(el=>el.value='');$('people').replaceChildren();$('wall').replaceChildren();$('card-text').textContent='';$('card-author').textContent='';$('card-dialog').close();$('join').hidden=true;$('status').textContent=message;}
async function api(action='',body,base=false){
 const res=await fetch(API_BASE+(base?'/api/rooms':`/api/rooms/${id}${action?'/'+action:''}${table?'?table='+encodeURIComponent(table):''}`),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(credential?{Authorization:'Bearer '+credential.token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const data=await res.json();if(!res.ok){if(res.status===410)clearRoom(data.error);throw Error(data.error);}return data;
}
function run(fn){return async e=>{e?.preventDefault();try{$('status').textContent='';await fn(e);}catch(err){$('status').textContent=err.message;}};}
function fields(tables,p={}){return `<label>名字或昵称 *<input name="name" required maxlength="30" value="${esc(p.name)}"></label><label>行业<input name="industry" maxlength="80" value="${esc(p.industry)}" placeholder="可跳过"></label><label>星座<input name="star" maxlength="30" value="${esc(p.star)}" placeholder="不知道 / 不公开也可以"></label><label>MBTI<input name="mbti" maxlength="30" value="${esc(p.mbti)}" placeholder="可跳过"></label>${tables.length?`<label>我在哪桌<select name="table">${tables.map(t=>`<option ${t===p.table?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`:''}<button>保存身份卡</button>`;}
function profile(p){return `<h4>${esc(p.name)} <small>身份编号 ${esc(p.id.slice(-4))}</small></h4><p>${[p.industry,p.star,p.mbti,p.table].filter(Boolean).map(esc).join(' · ')||'很高兴认识你！'}</p><p lang="en">Hi, I’m ${esc(p.name)}.${p.industry?' I work in '+esc(p.industry)+'.':''}${p.star?' My star sign is '+esc(p.star)+'.':''}${p.mbti?' My MBTI type is '+esc(p.mbti)+'.':''}</p>`;}
function updateDialog(){const c=state?.cards.find(c=>c.id===selected);if(!c){$('card-dialog').close();return;}$('card-text').textContent=c.text;$('card-author').innerHTML=c.revealed?`<strong>It’s me! 原来是我！</strong>${profile(c.author)}<p>Tell us the story behind it.<br>聊聊这句话背后的故事吧。</p>`:'先猜猜是谁，再请对方分享。';$('reveal').hidden=c.revealed||!['host','leader'].includes(state.role);$('hide-card').hidden=state.role!=='host';}
function render(){
 $('solo').hidden=Boolean(id);renderShared();
 document.body.dataset.active='true';$('entry').hidden=true;$('join').hidden=true;$('room').hidden=false;$('room-title').textContent=state.title;$('topic').textContent=state.topic;$('counts').textContent=`${state.count} 人 · 已提交 ${state.submitted} 句`;
 $('host').hidden=state.role!=='host';$('participant').hidden=state.role==='host';
 if(state.role==='host'){$('table-label').hidden=!state.tables.length;const options='<option value="">全场</option>'+state.tables.map(t=>`<option>${esc(t)}</option>`).join('');if($('table-filter').innerHTML!==options){$('table-filter').innerHTML=options;$('table-filter').value=table;}}
 if(state.me&&!$('profile').children.length){$('profile').innerHTML=fields(state.tables,state.me);$('sentence').elements.text.value=state.mine;}
 if(state.round!==lastRound){editing=false;solo=false;$('sentence').elements.text.value=state.mine||'';lastRound=state.round;}
 const editable=['intro','collect'].includes(state.phase);
 const completed=Boolean(state.mine)||state.skipped;
 $('write-screen').hidden=!editable||(completed&&!editing);$('waiting').hidden=!editable||!completed||editing;
 $('participant').hidden=state.role==='host'||!editable;
 $('saved-title').textContent=state.skipped?'已跳过，安心等大家就好。':'填写完成，已经保存啦！';
 $('complete-count').textContent=`${state.completed} / ${state.count} 位伙伴已准备好`;$('complete-progress').max=Math.max(1,state.count);$('complete-progress').value=state.completed;
 $('waiting-copy').textContent=state.completed===state.count?'大家都准备好啦，等待主持人开启句子墙。':'小船正在集合，等待伙伴完成和主持人确认…';
 $('host-completion').hidden=state.role!=='host'||!editable;$('host-complete-count').textContent=`${state.completed} / ${state.count} 人已准备好`;
 const inTopics=state.phase==='topics'||solo;showTopics(inTopics);
 const step=inTopics?3:editable?(completed&&!editing?1:0):2;document.querySelectorAll('#journey li').forEach((el,i)=>el.classList.toggle('current',i===step));for(const el of $('profile').elements)el.disabled=!editable;for(const el of $('sentence').elements)el.disabled=!editable;$('withdraw').disabled=false;
 document.querySelectorAll('[data-phase]').forEach(b=>b.classList.toggle('active',b.dataset.phase===state.phase));
 $('stage-title').textContent=({intro:'先认识一下 · Say hello',collect:'写下一句真实的你',wall:'Who said that? 猜猜是谁',reveal:'原来是你 · 揭晓时刻',topics:'一起抽一个新话题'})[state.phase];
 $('stage-title').hidden=editable&&state.role!=='host';$('wall-note').hidden=editable&&state.role!=='host';$('wall').hidden=editable;
 $('people').hidden=state.phase!=='intro'||state.role!=='host';$('people').innerHTML=state.people.map(p=>`<article class="person">${profile(p)}${state.role==='host'&&state.tables.length?`<button data-leader="${p.id}">设为本桌桌长</button>`:''}</article>`).join('');
 $('wall-note').textContent=['wall','reveal'].includes(state.phase)?'点击一句话放大。可以口头猜，也可以直接揭晓。'+(state.cards.length>8?'每次展示8句，自动轮换。':''):editable?'可跳过任何环节；主持人展示句子墙后，本轮停止修改。':'';
 const start=state.cards.length>8?Math.floor(Date.now()/15000)*8%state.cards.length:0;
 const cards=Array.from({length:Math.min(8,state.cards.length)},(_,i)=>state.cards[(start+i)%state.cards.length]);
 const markup=cards.map((c,i)=>`<button class="note ${c.revealed?'done':''}" style="--delay:-${i}s" data-card="${c.id}">${esc(c.text)}<small>${c.revealed?'原来是 '+esc(c.author.name):'点击，猜猜是谁 →'}</small></button>`).join('');if($('wall').innerHTML!==markup)$('wall').innerHTML=markup;
 if($('card-dialog').open)updateDialog();
}
async function refresh(){if(polling||ended||!credential)return;polling=true;try{state=await api();render();$('status').textContent='';}catch(e){$('status').textContent=e.message+(ended?'':'（连接异常，恢复后自动同步）');}finally{polling=false;}}
async function start(){await refresh();refreshHandle=setInterval(refresh,2000);expiryHandle=setInterval(()=>{if(!state)return;const remaining=state.expires-Date.now();if(remaining<=0)return clearRoom('活动已到期，资料已清空。');$('expiry').textContent=`临时房间 · 约 ${Math.ceil(remaining/60000)} 分钟后自动清空`;},1000);}
$('create').onsubmit=run(async()=>{const f=new FormData($('create'));const data=await api('',{title:f.get('title'),topic:f.get('topic'),tables:f.get('tables').split('\n')},true);id=data.id;location.hash='room='+id;store(data);await start();await invite();});
async function invite(){const q=await api('qr',{origin:location.href.split('#')[0]});$('invite').value=q.url;$('qr').src=q.image;}
$('copy').onclick=run(async()=>{await navigator.clipboard.writeText($('invite').value);$('status').textContent='已复制参与者入口';});
$('join-form').onsubmit=run(async()=>{store(await api('join',Object.fromEntries(new FormData($('join-form')))));editing=true;await start();});
$('profile').onsubmit=run(async()=>{await api('profile',Object.fromEntries(new FormData($('profile'))));await refresh();$('status').textContent='身份已更新';});
$('withdraw').onclick=run(async()=>{await api('skip',{});editing=false;$('sentence').elements.text.value='';await refresh();$('status').textContent='已跳过，等待其他伙伴';});
$('sentence').onsubmit=run(async()=>{if(!$('sentence').elements.text.value.trim())throw Error('写一句话，或者点击「这次先跳过」。');await api('submit',{text:$('sentence').elements.text.value});editing=false;await refresh();$('status').textContent='';window.scrollTo({top:0,behavior:'smooth'});});
$('phases').onclick=run(async e=>{const phase=e.target.dataset.phase;if(phase){await api('phase',{phase});await refresh();}});
$('table-filter').onchange=run(async()=>{table=$('table-filter').value;await refresh();});
$('people').onclick=run(async e=>{const id=e.target.dataset.leader;if(id){await api('leader',{id});$('status').textContent='已设置本桌桌长';}});
$('wall').onclick=e=>{const b=e.target.closest('[data-card]');if(!b)return;selected=b.dataset.card;updateDialog();$('card-dialog').showModal();};
$('close-card').onclick=()=>$('card-dialog').close();
$('reveal').onclick=run(async()=>{await api('reveal',{id:selected});await refresh();});
$('hide-card').onclick=run(async()=>{await api('hide',{id:selected});await refresh();});
$('round').onclick=run(async()=>{if(!confirm('清空本轮所有句子，保留参与者身份，开始下一轮？'))return;const topic=prompt('新一轮主题',state.topic);if(topic===null)return;await api('round',{topic});$('sentence').elements.text.value='';await refresh();});
$('end').onclick=run(async()=>{if(!confirm('结束后所有身份和句子都会清空，无法恢复。确定结束？'))return;await api('end',{});clearRoom('活动已结束，身份和句子已清空，旧入口已失效。');});
run(async()=>{if(!id)return;document.body.dataset.active='true';if(credential){await start();if(state?.role==='host')await invite();}else{const info=await api('info');$('entry').hidden=true;$('join').hidden=false;$('join-title').textContent=info.title;$('join-topic').textContent=info.topic;$('join-form').innerHTML=fields(info.tables);}})();
window.addEventListener('hashchange',()=>{if(new URLSearchParams(location.hash.slice(1)).get('room')!==id)location.reload();});

function showTopics(show){$('topics-screen').hidden=!show;if(show){$('room').hidden=state?.role!=='host';$('entry').hidden=true;$('join').hidden=true;$('shared-deck').hidden=!state||solo;$('topic-frame').hidden=Boolean(state)&&!solo;if((!state||solo)&&!$('topic-frame').getAttribute('src'))$('topic-frame').src=$('topic-frame').dataset.src;}else if(state){$('room').hidden=false;}}
$('solo').onclick=()=>{solo=true;showTopics(true);document.body.dataset.active='true';document.querySelectorAll('#journey li').forEach((el,i)=>el.classList.toggle('current',i===3));};
$('back-event').onclick=()=>{solo=false;if(state?.phase==='topics'){if(state.role==='host')run(async()=>{await api('phase',{phase:'wall'});await refresh();})();else $('status').textContent='大家正在抽话题，由主持人控制下一环节。';}else if(state)render();else{showTopics(false);$('entry').hidden=false;document.body.dataset.active='false';}};
$('edit-answer').onclick=()=>{editing=true;render();};
$('begin-wall').onclick=run(async()=>{await api('phase',{phase:'wall'});await refresh();});

window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===$('topic-frame').contentWindow&&e.data?.type==='lighthouse-topic-height'&&Number.isFinite(e.data.height))$('topic-frame').style.height=Math.max(450,Math.min(6000,e.data.height))+'px';});
