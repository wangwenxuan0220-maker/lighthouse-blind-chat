(function(root){
'use strict';
const KEY='lighthouse-topic-box-v1';
class TopicDeck {
 constructor(bank,storage,random=Math.random){this.bank=bank;this.storage=storage;this.random=random;this.storageAvailable=true;this.state={version:bank.version,filter:'all',current:null,mode:'direct',used:[],screen:'choose'};try{const old=JSON.parse(storage.getItem(KEY)||'null');if(old&&typeof old==='object')this.state={...this.state,...old};}catch(e){this.storageAvailable=false;}this.normalize();}
 validFilter(f){return f==='all'||this.bank.levels.some(l=>f==='level:'+l.id)||this.bank.categories.some(c=>f==='category:'+c.id);}
 normalize(){const ids=new Set(this.bank.questions.map(q=>q.id));this.state.used=[...new Set((Array.isArray(this.state.used)?this.state.used:[]).filter(id=>ids.has(id)))];if(!this.validFilter(this.state.filter))this.state.filter='all';const q=this.current();if(!q||!this.pool().some(x=>x.id===q.id)){this.state.current=null;this.state.screen='choose';}else if(!this.state.used.includes(q.id))this.state.used.push(q.id);if(!q?.guessEnabled||this.state.mode!=='guess')this.state.mode='direct';if(!['choose','card','empty'].includes(this.state.screen))this.state.screen='choose';if(this.state.screen==='card'&&!this.current())this.state.screen='choose';this.state.version=this.bank.version;this.save();}
 save(){try{this.storage.setItem(KEY,JSON.stringify(this.state));}catch(e){this.storageAvailable=false;}}
 pool(){const f=this.state.filter;return this.bank.questions.filter(q=>f==='all'||f==='level:'+q.level||f==='category:'+q.category);}
 available(){const used=new Set(this.state.used);return this.pool().filter(q=>!used.has(q.id));}
 current(){return this.bank.questions.find(q=>q.id===this.state.current)||null;}
 select(filter){if(!this.validFilter(filter))return;this.state.filter=filter;this.state.current=null;this.state.mode='direct';this.state.screen='choose';this.save();}
 draw(){const available=this.available();if(!available.length){this.state.screen='empty';this.state.current=null;this.state.mode='direct';this.save();return null;}const q=available[Math.floor(this.random()*available.length)];this.state.current=q.id;this.state.used.push(q.id);this.state.mode='direct';this.state.screen='card';this.save();return q;}
 setMode(mode){this.state.mode=mode==='guess'&&this.current()?.guessEnabled?'guess':'direct';this.save();}
 choose(){this.state.screen='choose';this.save();}
 resetScope(){const pool=new Set(this.pool().map(q=>q.id));this.state.used=this.state.used.filter(id=>!pool.has(id));this.state.current=null;this.state.mode='direct';this.state.screen='choose';this.save();}
 resetAll(){this.state={version:this.bank.version,filter:'all',current:null,mode:'direct',used:[],screen:'choose'};this.save();}
}
if(typeof module!=='undefined'&&module.exports)module.exports={TopicDeck,KEY};else root.TopicDeck=TopicDeck;
})(typeof window!=='undefined'?window:globalThis);
