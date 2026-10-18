'use strict';
const $=id=>document.getElementById(id);
const bank=window.TOPIC_BANK;
let storage;try{storage=window.localStorage;}catch{storage={getItem(){throw Error('unavailable');},setItem(){throw Error('unavailable');}};}const deck=new TopicDeck(bank,storage);
const names=['全部话题','轻松日常','个性经历','内心深聊','搞笑脑洞','大胆直球'];
const formatLabels={question:'问题卡 · 分享你的答案',topic:'主题卡 · 围绕主题自由聊',story:'经历卡 · 讲一个故事',debate:'观点卡 · 赞同、反对或看情况'};
const notes=['500 张双语卡 · 问题、主题、经历、观点，都可以聊。','轻松开口，从日常的小喜好开始。','分享一点经历，发现彼此有趣的一面。','慢一点聊，给真诚的想法留些空间。','打开脑洞，没有逻辑也没关系。','成年人双方自愿选择；任何时候都可以换一题。'];
let busy=false,resetAction=null,returnFocus=null;
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function phrases(items){return items.map(p=>`<p class="phrase"><span lang="en" style="color:var(--ink)">${escapeHtml(p.en)}</span><span>${escapeHtml(p.zh)}</span></p>`).join('');}
function filterLabel(){const f=deck.state.filter;if(f==='all')return '全部话题';if(f.startsWith('level:'))return bank.levels.find(l=>'level:'+l.id===f).name;return bank.categories.find(c=>'category:'+c.id===f).name;}
function selectedLevel(){const f=deck.state.filter;if(f==='all')return 0;if(f.startsWith('level:'))return Number(f.split(':')[1]);return bank.categories.find(c=>'category:'+c.id===f).level;}
function renderChooser(){const level=selectedLevel();$('levels').innerHTML=names.map((name,i)=>`<button class="level" type="button" data-level="${i}" aria-pressed="${level===i}">${name}${i?`<small>L${i}</small>`:''}</button>`).join('');$('category').innerHTML=`<option value="all">全部主题 · ${bank.questions.length} 张</option>`+bank.levels.map(l=>`<optgroup label="L${l.id} ${l.name}"><option value="level:${l.id}">全部${l.name} · ${bank.questions.filter(q=>q.level===l.id).length} 张</option>${bank.categories.filter(c=>c.level===l.id).map(c=>`<option value="category:${c.id}">${c.name} · ${bank.questions.filter(q=>q.category===c.id).length} 张</option>`).join('')}</optgroup>`).join('');$('category').value=deck.state.filter;$('level-note').textContent=notes[level];}
function renderCard(){const q=deck.current();$('card').hidden=deck.state.screen==='choose';if(deck.state.screen==='choose'){$('card').innerHTML='';return;}if(deck.state.screen==='empty'){$('card').innerHTML='<div class="empty-card"><div class="done" aria-hidden="true">✧</div><h2 tabindex="-1" id="question-title">这个主题已经抽完啦</h2><p>换个主题继续发现，<br>或让这些话题重新回到盲盒。</p><button type="button" class="secondary" id="reset-scope">重抽这个主题</button></div>';return;}const cat=bank.categories.find(c=>c.id===q.category);const guess=deck.state.mode==='guess';$('card').innerHTML=`<div class="card-body"><div class="question-top"><span class="badge">L${q.level} · ${escapeHtml(cat.name)}</span><span class="question-number">${q.id.replace('EN','#')}</span></div>${q.level===5?'<p class="adult-note">大胆话题 · 双方自在，再继续聊</p>':''}<p class="format-label">${formatLabels[q.format]||formatLabels.question}</p><h2 class="question-en" id="question-title" lang="en" tabindex="-1">${escapeHtml(q.questionEn)}</h2><p class="question-zh">${escapeHtml(q.questionZh)}</p>${q.guessEnabled?`<div class="mode-switch" role="group" aria-label="回答方式"><button type="button" data-mode="direct" aria-pressed="${!guess}">直接回答</button><button type="button" data-mode="guess" aria-pressed="${guess}">先猜猜我 ✧</button></div>`:''}${guess?'<p class="guess-rule">先请旁边的人猜你会怎么回答，再揭晓你的想法。<span lang="en">Let someone guess your answer and say why. Then share what you really think.</span></p>':''}<div class="hints"><details><summary>表达提示 <small>A LITTLE HELP</small></summary><div class="hint-content"><h3>可以用到的词</h3><div class="vocab">${q.vocabulary.map(v=>`<div><strong lang="en">${escapeHtml(v.en)}</strong><span>${escapeHtml(v.zh)}</span></div>`).join('')}</div>${guess?`<h3>猜的人 · Make a guess</h3>${phrases(q.guessStarters)}<h3>回答的人 · Reveal your answer</h3>${phrases(q.revealStarters)}`:`<h3>试着这样开口</h3>${phrases(q.sentenceStarters)}`}</div></details><details><summary>继续聊聊 <small>KEEP IT GOING</small></summary><div class="hint-content">${phrases(q.followUps)}</div></details></div></div>`;}
function render(){document.body.dataset.screen=deck.state.screen;renderChooser();$('chooser').hidden=deck.state.screen!=='choose';$('scope-name').textContent=filterLabel();$('remaining').textContent=`还剩 ${deck.available().length} 张`;$('change').hidden=deck.state.screen==='choose';$('draw').hidden=deck.state.screen==='empty';$('draw').innerHTML=deck.state.screen==='card'?'Draw another card <span aria-hidden="true">→</span><small>再抽一张</small>':'Draw a card <span aria-hidden="true">→</span><small>抽一张，开始聊聊</small>';$('storage-note').hidden=deck.storageAvailable;renderCard();}
$('levels').addEventListener('click',e=>{const b=e.target.closest('[data-level]');if(!b||busy)return;deck.select(+b.dataset.level?'level:'+b.dataset.level:'all');render();document.querySelector(`[data-level="${b.dataset.level}"]`).focus();});
$('category').addEventListener('change',e=>{if(busy)return;deck.select(e.target.value);render();$('category').focus();});
$('draw').addEventListener('click',()=>{
 if(busy)return;
 busy=true;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const origin=$('draw').getBoundingClientRect();
 const q=deck.draw();
 const overlay=$('paper-draw');
 let finished=false,timer;
 function finish(){
  if(finished)return;
  finished=true;clearTimeout(timer);
  overlay.removeEventListener('animationend',onEnd);
  overlay.hidden=true;
  document.querySelectorAll('main,.site-header,footer').forEach(el=>el.inert=false);
  render();busy=false;$('draw').disabled=false;
  if(!reduced&&q){$('card').classList.remove('paper-revealed');void $('card').offsetWidth;$('card').classList.add('paper-revealed');}
  $('announcement').textContent=q?`已抽到 ${q.id}，${filterLabel()}，还剩 ${deck.available().length} 张。`:'这个主题已经抽完啦';
  $('question-title')?.focus({preventScroll:true});
  $('card').scrollIntoView({block:'nearest',behavior:'auto'});
 }
 function onEnd(event){if(event.animationName==='paper-scene')finish();}
 if(reduced||!q){finish();return;}
 $('draw').disabled=true;
 $('announcement').textContent='正在展开话题纸条。';
 overlay.style.setProperty('--from-x',`${origin.left+origin.width/2-innerWidth/2}px`);
 overlay.style.setProperty('--from-y',`${Math.max(-innerHeight/2,Math.min(innerHeight/2,origin.top+origin.height/2-innerHeight*.44))}px`);
 document.querySelectorAll('main,.site-header,footer').forEach(el=>el.inert=true);
 overlay.addEventListener('animationend',onEnd);
 overlay.hidden=false;
 timer=setTimeout(finish,1500);
});
$('change').addEventListener('click',()=>{if(busy)return;deck.choose();render();$('chooser').scrollIntoView({block:'start'});$('category').focus({preventScroll:true});});
$('card').addEventListener('click',e=>{if(busy)return;const mode=e.target.closest('[data-mode]');if(mode){deck.setMode(mode.dataset.mode);renderCard();document.querySelector(`[data-mode="${mode.dataset.mode}"]`).focus();}if(e.target.closest('#reset-scope'))openReset('scope');});
function openReset(kind){if(busy)return;returnFocus=document.activeElement;resetAction=kind;$('dialog-title').textContent=kind==='all'?'重新开始？':'重抽这个主题？';$('dialog-description').textContent=kind==='all'||deck.state.filter==='all'?`这会清空本浏览器的全部抽题记录，${bank.questions.length} 张话题卡都可以重新抽取。`:`只会重置「${filterLabel()}」范围内的已抽记录，其他主题的记录会保留。`;$('confirm-dialog').showModal();$('cancel-reset').focus();}
$('restart').addEventListener('click',()=>openReset('all'));
$('cancel-reset').addEventListener('click',()=>$('confirm-dialog').close());
$('confirm-dialog').addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();});
$('confirm-reset').addEventListener('click',()=>{resetAction==='all'?deck.resetAll():deck.resetScope();$('confirm-dialog').close();render();$('draw').focus();$('announcement').textContent='抽题记录已重置。';});
render();
