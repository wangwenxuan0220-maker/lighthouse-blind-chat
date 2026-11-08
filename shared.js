let sharedStamp='',projectionStamp='',sharedRevealTimer=null,projectionRevision='';
function hintMarkup(items){return (items||[]).map(x=>`<div class="shared-hint"><b lang="en">${esc(x.en)}</b><span>${esc(x.zh)}</span></div>`).join('');}
function renderShared(){
 if(!state?.deck)return;
 const d=state.deck,person=d.order.find(p=>p.id===d.turn),manager=['host','leader'].includes(state.role),mine=state.me?.id===d.turn;
 const waiting=d.card&&state.serverTime<d.revealAt;
 const stamp=[d.scope,d.revision,Boolean(waiting)].join(':');
 $('turn-kicker').textContent=d.card?'A LITTLE SURPRISE FOR EVERYONE':'PASS THE LIGHT ✦';
 $('turn-name').textContent=d.card?`${d.drawnBy?.name||'伙伴'} 抽到的话题`:mine?'轮到你啦！':person?`把灯光交给 ${person.name}`:'等待第一位伙伴加入';
 $('turn-note').textContent=d.card?'同一张话题，所有人一起聊。':mine?'你的手机就是遥控器，轻点下面的盲盒吧。':'轮到的伙伴在手机抽卡，大屏和大家的手机会一起更新。';
 $('shared-draw').hidden=Boolean(d.card)||!(manager||mine);$('shared-draw').disabled=!person||state.phase!=='topics';
 $('deck-manager').hidden=!manager;
 const options=d.order.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');if($('pick-person').innerHTML!==options)$('pick-person').innerHTML=options;
 if(document.activeElement!==$('deck-level'))$('deck-level').value=String(d.level);if(document.activeElement!==$('screen-hint'))$('screen-hint').value=d.hint;
 $('deck-remaining').textContent=`${d.scope?d.scope+' · ':''}本活动该等级还剩 ${d.remaining} 张 · 全场不重复`;
 if(stamp!==sharedStamp){sharedStamp=stamp;
  $('shared-card').innerHTML=!d.card?'<div class="shared-box" aria-hidden="true">✦<span>一个话题，一段新故事</span></div>':waiting?'<div class="shared-box opening" role="status">✷<span>正在展开你的好奇心…</span></div>':`<article class="shared-topic arrived"><span class="badge">L${d.card.level} · ${esc(d.card.sourceId)}</span><h2 lang="en">${esc(d.card.questionEn)}</h2><p class="shared-zh">${esc(d.card.questionZh)}</p><details><summary>词汇小帮手</summary>${hintMarkup(d.card.vocabulary)}</details><details><summary>试着这样开口</summary>${hintMarkup(d.card.sentenceStarters)}</details><details><summary>继续聊聊</summary>${hintMarkup(d.card.followUps)}</details></article>`;
 }
 if(displayToken)renderProjection(waiting);
 clearTimeout(sharedRevealTimer);if(waiting){const remaining=d.revealAt-state.serverTime;sharedRevealTimer=setTimeout(()=>{if(state?.deck?.revision===d.revision){state.serverTime=d.revealAt;renderShared();}},remaining);}
}
function renderProjection(waiting){
 $('projection').hidden=false;
 const d=state.deck,person=d.order.find(p=>p.id===d.turn);$('screen-room').textContent=state.title;
 $('screen-count').textContent=`${d.scope||'全场'} · ${state.count} 人`;$('screen-turn').textContent=d.card?`${d.drawnBy?.name} 的好奇心 ✦`:person?`下一束灯光：${person.name}`:'等待伙伴加入';
 $('screen-table').hidden=!state.tables.length;
 const options=state.tables.map(t=>`<option>${esc(t)}</option>`).join('');if($('screen-table').innerHTML!==options){$('screen-table').innerHTML=options;$('screen-table').value=d.scope;}
 const stamp=JSON.stringify([state.phase,d.scope,d.revision,d.hint,waiting,state.completed,state.count,state.cards]);if(stamp===projectionStamp)return;projectionStamp=stamp;
 const animate=projectionRevision!==d.scope+':'+d.revision;if(!waiting)projectionRevision=d.scope+':'+d.revision;
 if(state.phase==='topics'){
  $('screen-topic').innerHTML=!d.card?`<p class="eyebrow">IT’S YOUR TURN</p><div class="spotlight-icon">✦</div><h1>${esc(person?.name||'欢迎加入')}</h1><p>请在手机上抽出下一张话题</p>`:waiting?'<div class="spotlight-icon opening">✷</div><h1>好奇心正在展开…</h1>':`<div class="screen-question ${animate?'arrived':''}"><span class="badge">${esc(d.drawnBy?.name)} 抽到了 · L${d.card.level}</span><h1 lang="en">${esc(d.card.questionEn)}</h1><p>${esc(d.card.questionZh)}</p></div>`;
  $('screen-help').innerHTML=d.card&&!waiting?`<p class="eyebrow">${({vocabulary:'WORD TREASURES',sentenceStarters:'LET’S SAY IT',followUps:'KEEP TALKING'})[d.hint]}</p><h2>${({vocabulary:'词汇小帮手',sentenceStarters:'试着这样开口',followUps:'继续聊聊'})[d.hint]}</h2>${hintMarkup(d.card[d.hint])}`:'<div class="screen-lighthouse"><svg viewBox="0 0 160 180" width="120" aria-hidden="true"><path fill="#f3c45e" opacity=".65" d="M70 30 0 0v65zm20 0 70-30v65z"/><path fill="#fff9e9" stroke="#306990" stroke-width="5" d="M58 155 67 42h26l9 113z"/><path fill="#de8567" d="m64 80 32 0 3 30H61z"/><path fill="#306990" d="M62 40V23l18-12 18 12v17zM50 155h60v8H50zM75 135h12v20H75z"/><path fill="#ffdb72" d="M72 25h16v12H72z"/><path fill="#a4c385" d="M20 175q60-35 120 0z"/></svg></div><h2>把灯光，传给下一位。</h2><p>一个人抽，全场一起聊。<br>不必完美，开口就很棒。</p>';
 }else if(['wall','reveal'].includes(state.phase)){
  $('screen-topic').innerHTML=`<h2>WHO SAID THAT? 原来是你</h2><div class="screen-stickers">${state.cards.slice(0,6).map(c=>`<div class="note">${esc(c.text)}<small>${c.revealed?'原来是 '+esc(c.author.name):'猜猜是谁？'}</small></div>`).join('')}</div>`;
  $('screen-help').innerHTML='<h2>猜一猜，再听故事。</h2><p>主持人揭晓后，作者名字会同步显示。</p>';
 }else{
  $('screen-topic').innerHTML=`<p class="eyebrow">GATHERING OUR CREW</p><div class="spotlight-icon">✷</div><h1>${state.completed} / ${state.count}</h1><p>位伙伴已准备好 · 等待主持人开启</p>`;$('screen-help').innerHTML=`<h2>今晚的话题</h2><p>${esc(state.topic)}</p><p>在自己的手机填写，灯塔会把大家的故事收集起来。</p>`;
 }
}
window.addEventListener('DOMContentLoaded',()=>{
 $('shared-draw').onclick=run(async()=>{$('shared-draw').disabled=true;try{await api('draw',{revision:state.deck.revision});await refresh();}finally{if(state)renderShared();}});
 $('next-turn').onclick=run(async()=>{await api('next',{revision:state.deck.revision});await refresh();});
 $('pick-turn').onclick=run(async()=>{await api('pick',{revision:state.deck.revision,id:$('pick-person').value});await refresh();});
 $('deck-level').onchange=run(async()=>{await api('deckfilter',{level:$('deck-level').value});await refresh();});
 $('screen-hint').onchange=run(async()=>{await api('hint',{hint:$('screen-hint').value});await refresh();});
 $('open-projector').onclick=run(async()=>{const w=window.open('about:blank','lighthouse-projector');try{const data=await api('projection',{});const url=new URL(location.href);url.hash='room='+id+'&screen='+data.token;if(w)w.location.href=url.href;else throw Error('浏览器拦截了新窗口，请允许本网站打开投屏窗口后重试。');}catch(e){w?.close();throw e;}});
 $('screen-table').onchange=run(async()=>{table=$('screen-table').value;await refresh();});
 $('screen-fullscreen').onclick=run(async()=>{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();});
});
