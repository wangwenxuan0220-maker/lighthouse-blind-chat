import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import QRCode from 'qrcode';
const root=path.dirname(fileURLToPath(import.meta.url));
const topicBank=JSON.parse(await readFile(path.join(root,'topics/questions.json'),'utf8'));
const token=()=>randomBytes(24).toString('hex');
const clean=(v,max=80)=>typeof v==='string'?v.trim().slice(0,max):'';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
export function createApp({ttl=12*60*60*1000,allowedOrigin=process.env.FRONTEND_ORIGIN}={}){
 const rooms=new Map();
 const timer=setInterval(()=>{for(const [id,r] of rooms)if(Date.now()>=r.expires)rooms.delete(id);},1000);timer.unref();
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  const send=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  try{
   const url=new URL(req.url,'http://localhost');
   if(!url.pathname.startsWith('/api/')){
    const topics=url.pathname.startsWith('/topics/');
    const file=topics?(url.pathname.slice(8)||'index.html'):(url.pathname==='/'?'index.html':url.pathname.slice(1));
    if(!(topics?['index.html','styles.css','coastal.css','app.js','engine.js','questions.js','questions.json','lighthouse.svg','reference-ui.png']:['index.html','room.js','shared.js','room.css','config.js','coast.png','playful.ttf','FONT-LICENSE.txt']).includes(file))return fail(404,'页面不存在');
    const types={html:'text/html',js:'text/javascript',css:'text/css',json:'application/json',svg:'image/svg+xml',png:'image/png',ttf:'font/ttf',txt:'text/plain'};
    res.setHeader('Content-Type',types[file.split('.').pop()]+'; charset=utf-8');res.end(await readFile(path.join(topics?path.join(root,'topics'):path.join(root,'public'),file)));return;
   }
   const origin=req.headers.origin;
   if(origin&&origin!==`${req.headers['x-forwarded-proto']||'http'}://${req.headers.host}`&&origin!==allowedOrigin)fail(403,'请从活动页面操作');
   if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');}
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
   let body={};
   if(req.method==='POST'){
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)fail(413,'内容过长');}
    try{body=JSON.parse(raw||'{}');}catch{fail(400,'格式错误');}
   }
   if(url.pathname==='/api/rooms'&&req.method==='POST'){
    if(rooms.size>=100)fail(503,'服务繁忙，请稍后再试');
    const id=randomBytes(12).toString('hex'),host=token();
    const title=clean(body.title),topic=clean(body.topic,200);if(!title||!topic)fail(400,'请填写活动名称和主题');
    const tables=Array.isArray(body.tables)?[...new Set(body.tables.map(v=>clean(v,30)).filter(Boolean))]:[];
    if(tables.length>50)fail(400,'桌数过多');
    rooms.set(id,{id,host,displayToken:token(),decks:new Map(),used:new Set(),title,topic,tables,phase:'intro',round:1,skipped:new Set(),expires:Date.now()+ttl,people:new Map(),cards:new Map(),leaders:new Map()});
    return send({id,token:host,role:'host'},201);
   }
   const match=url.pathname.match(/^\/api\/rooms\/([a-f0-9]{24})(?:\/([a-z]+))?$/);if(!match)fail(404,'入口不存在');
   const [,id,action]=match,r=rooms.get(id);if(!r||Date.now()>=r.expires){rooms.delete(id);fail(410,'活动已结束或服务已重启，请联系主持人获取新入口');}
   if(action==='info'&&req.method==='GET')return send({title:r.title,topic:r.topic,tables:r.tables,phase:r.phase});
   if(action==='join'&&req.method==='POST'){
    if(r.phase!=='intro'&&r.phase!=='collect')fail(409,'本轮已锁定，请主持人先开放填写');
    const name=clean(body.name,30);if(!name)fail(400,'请填写昵称');
    const table=r.tables.length?clean(body.table,30):'';if(r.tables.length&&!r.tables.includes(table))fail(400,'请选择桌子');
    const t=token(),pid=randomBytes(12).toString('hex');
    r.people.set(t,{id:pid,name,industry:clean(body.industry),star:clean(body.star,30),mbti:clean(body.mbti,30),table});
    return send({id,token:t,role:'participant'},201);
   }
   const auth=(req.headers.authorization||'').replace(/^Bearer /,'');
   const isHost=auth===r.host,isDisplay=auth===r.displayToken,me=r.people.get(auth);if(!isHost&&!isDisplay&&!me)fail(401,'请重新扫码加入');
   const isLeader=me&&r.leaders.get(me.table)===me.id;
   const scope=(isHost||isDisplay)?(url.searchParams.get('table')||((r.phase==='topics'||isDisplay)&&r.tables.length?r.tables[0]:'')):me.table;
   const visible=p=>!r.tables.length||((isHost||isDisplay)&&!scope)||p.table===scope;
   const tableScope=r.tables.length?(isHost||isDisplay?(url.searchParams.get('table')||r.tables[0]):me.table):'';
   const order=[...r.people.values()].filter(p=>!r.tables.length||p.table===tableScope);
   if(!r.decks.has(tableScope))r.decks.set(tableScope,{turn:order[0]?.id||null,revision:0,card:null,drawnBy:null,revealAt:0,level:0,category:'',hint:'vocabulary'});
   const deck=r.decks.get(tableScope);
   if(!order.some(p=>p.id===deck.turn))deck.turn=order[0]?.id||null;
   const pool=topicBank.questions.filter(q=>(!deck.level||q.level===deck.level)&&(!deck.category||q.category===deck.category));
   const shared={...deck,categories:topicBank.categories,levels:topicBank.levels,scope:tableScope,order:order.map(p=>({id:p.id,name:p.name})),remaining:pool.filter(q=>!r.used.has(q.id)).length};
   if(!action&&req.method==='GET'){
    const people=[...r.people.values()].filter(visible);
    const cards=['wall','reveal'].includes(r.phase)?[...r.cards.values()].filter(c=>visible(r.people.get(c.owner))).sort((a,b)=>a.id.localeCompare(b.id)).map(c=>({id:c.id,text:c.text,revealed:c.revealed,author:c.revealed?r.people.get(c.owner):undefined})):[];
    return send({title:r.title,topic:r.topic,tables:r.tables,phase:r.phase,round:r.round,expires:r.expires,deck:shared,serverTime:Date.now(),role:isDisplay?'display':isHost?'host':isLeader?'leader':'participant',me,people,cards,count:people.length,submitted:[...r.cards.values()].filter(c=>visible(r.people.get(c.owner))).length,completed:people.filter(p=>r.skipped.has(p.id)||[...r.cards.values()].some(c=>r.people.get(c.owner).id===p.id)).length,skipped:me?r.skipped.has(me.id):false,mine:me?[...r.cards.values()].find(c=>c.owner===auth)?.text||'':undefined});
   }
   if(req.method!=='POST')fail(405,'不支持的操作');
   if(isDisplay&&!['draw','redraw','next','hint','deckfilter'].includes(action))fail(403,'大屏仅支持抽卡和提示操作');
   if(['draw','redraw','next','pick','deckfilter','hint'].includes(action)){
    if(r.phase!=='topics')fail(409,'请等待主持人进入抽卡环节');
    const manager=isHost||isLeader||isDisplay;
    if(action==='draw'||action==='redraw'){
     if(action==='redraw'&&!manager)fail(403,'只有主持人或大屏可以换题');
     if(!manager&&me?.id!==deck.turn)fail(403,'还没有轮到你');
     if(body.revision!==deck.revision||(action==='draw'&&deck.card))fail(409,'这轮已经抽过，请等待下一位');
     if(!deck.turn)fail(409,'请先邀请一位参与者');
     const available=pool.filter(q=>!r.used.has(q.id));if(!available.length)fail(409,'这一组话题已抽完，请换个等级');
     deck.card=available[Math.floor(Math.random()*available.length)];r.used.add(deck.card.id);deck.drawnBy=order.find(p=>p.id===deck.turn);deck.revealAt=Date.now()+3000;deck.revision++;return send({ok:true});
    }
    if(action==='deckfilter'){
     if(!manager&&(me?.id!==deck.turn||deck.card))fail(403,'请在轮到你且尚未抽卡时选择');
     const n=Number(body.level),category=body.category??deck.category??'';
     if(!Number.isInteger(n)||n<0||n>5)fail(400,'等级无效');
     if(category&&!topicBank.categories.some(c=>c.id===category))fail(400,'话题不存在');
     if(!topicBank.questions.some(q=>(!n||q.level===n)&&(!category||q.category===category)))fail(400,'该等级下没有此话题，请重新选择');
     deck.level=n;deck.category=category;return send({ok:true});
    }
    if(!manager)fail(403,'只有主持人或本桌桌长可以安排轮次');
    if(action==='hint'){if(!['vocabulary','sentenceStarters','followUps'].includes(body.hint))fail(400,'提示类型不存在');deck.hint=body.hint;return send({ok:true});}
    
    if(body.revision!==deck.revision)fail(409,'轮次已更新，请稍后重试');
    if(action==='pick'){if(!order.some(p=>p.id===body.id))fail(400,'参与者不在本桌');deck.turn=body.id;}
    else deck.turn=order[(order.findIndex(p=>p.id===deck.turn)+1)%order.length]?.id||null;
    deck.card=null;deck.drawnBy=null;deck.revealAt=0;deck.revision++;return send({ok:true});
   }

   if(action==='skip'){if(!me)fail(403,'请使用参与者入口');if(!['intro','collect'].includes(r.phase))fail(409,'本轮已锁定');for(const [cid,c] of r.cards)if(c.owner===auth)r.cards.delete(cid);r.skipped.add(me.id);return send({ok:true});}
   if(action==='withdraw'){if(!me)fail(403,'请使用参与者入口');r.skipped.delete(me.id);for(const [cid,c] of r.cards)if(c.owner===auth)r.cards.delete(cid);return send({ok:true});}
   if(action==='submit'){
    if(!me)fail(403,'请通过参与者入口填写');if(!['intro','collect'].includes(r.phase))fail(409,'本轮已锁定');
    const text=clean(body.text,240);let card=[...r.cards.values()].find(c=>c.owner===auth);
    if(!text){if(card)r.cards.delete(card.id);return send({ok:true});}
    if(!card){card={id:randomBytes(12).toString('hex'),owner:auth};r.cards.set(card.id,card);}r.skipped.delete(me.id);Object.assign(card,{text,revealed:false});return send({ok:true});
   }
   if(action==='reveal'){
    const card=r.cards.get(body.id);if(!card)fail(404,'句子不存在');
    if(!isHost&&!(isLeader&&r.people.get(card.owner).table===me.table))fail(403,'只有主持人或本桌桌长可以揭晓');
    if(!['wall','reveal'].includes(r.phase))fail(409,'请先展示句子墙');card.revealed=true;return send({ok:true});
   }
   if(action==='profile'){
    if(!me)fail(403,'请使用参与者入口');if(!['intro','collect'].includes(r.phase))fail(409,'本轮已锁定');
    if(!clean(body.name,30))fail(400,'请填写昵称');
    const table=r.tables.length?clean(body.table,30):'';if(r.tables.length&&!r.tables.includes(table))fail(400,'桌子不存在');
    if(r.leaders.get(me.table)===me.id&&table!==me.table)r.leaders.delete(me.table);
    Object.assign(me,{name:clean(body.name,30),industry:clean(body.industry),star:clean(body.star,30),mbti:clean(body.mbti,30),table});return send({ok:true});
   }
   if(!isHost)fail(403,'只有主持人可以执行');
   if(action==='projection')return send({token:r.displayToken});
   if(action==='end'){rooms.delete(id);return send({ok:true});}
   if(action==='phase'){
    if(!['intro','collect','wall','reveal','topics'].includes(body.phase))fail(400,'阶段不存在');
    if(['intro','collect'].includes(body.phase)&&[...r.cards.values()].some(c=>c.revealed))fail(409,'已揭晓后请开启新一轮');r.phase=body.phase;return send({ok:true});
   }
   if(action==='round'){r.round++;r.cards.clear();r.skipped.clear();r.topic=clean(body.topic,200)||r.topic;r.phase='collect';return send({ok:true});}
   if(action==='leader'){
    const p=[...r.people.values()].find(p=>p.id===body.id);if(!p||!r.tables.includes(p.table))fail(400,'请先选择一位已分桌的参与者');r.leaders.set(p.table,p.id);return send({ok:true});
   }
   if(action==='hide'){r.cards.delete(body.id);return send({ok:true});}
   if(action==='qr'){
    const origin=clean(body.origin,200);let u;try{u=new URL(origin);}catch{fail(400,'地址无效');}
    if(!['https:','http:'].includes(u.protocol))fail(400,'地址无效');
    u.search='';u.hash='room='+id;
    return send({url:u.href,image:await QRCode.toDataURL(u.href,{width:320,margin:4})});
   }
   fail(404,'操作不存在');
  }catch(e){send({error:e.code?e.message:'服务暂时不可用'},e.code||500);}
 });
 server.on('close',()=>{clearInterval(timer);rooms.clear();});return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url))createApp().listen(Number(process.env.PORT)||8787,'0.0.0.0',()=>console.log('Temporary rooms service ready'));
