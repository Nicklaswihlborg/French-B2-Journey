/* French B2 Journey — Vocab randomization, “Next” buttons, sentence flashcards, load-starter */
(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const today=()=>new Date().toISOString().slice(0,10);
  const addDays=(d,n)=>{const x=new Date(d); x.setDate(x.getDate()+n); return x;};
  const fmt=d=>new Date(d).toISOString().slice(0,10);
  const words=t=>(t||'').trim().split(/\s+/).filter(Boolean);
  const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const shuffle=a=>{const x=a.slice(); for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [x[i],x[j]]=[x[j],x[i]];} return x;};

  // storage
  const store=(()=>{let p=true,mem={};try{localStorage.setItem('__t','1');localStorage.removeItem('__t');}catch{p=false}
    const get=(k,d)=>{try{if(p){const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}}catch{p=false}return k in mem?mem[k]:d};
    const set=(k,v)=>{try{if(p){localStorage.setItem(k,JSON.stringify(v));return true}}catch{p=false}mem[k]=v;return false};
    const clear=()=>{try{localStorage.clear()}catch{}for(const k in mem)delete mem[k]}; return {get,set,clear,isPersistent:()=>p};
  })();

  const K={goal:'fj_goal_xp',xp:'fj_xp_by_day',aw:'fj_awards_by_day',b2:'fj_b2_target',
           vocab:'fj_vocab',compDeck:'fj_comp_deck',phrSeed:'fj_phr_seed'};

  if(store.get(K.goal)==null) store.set(K.goal,30);
  if(store.get(K.xp)==null)   store.set(K.xp,{});
  if(store.get(K.aw)==null)   store.set(K.aw,{});
  if(store.get(K.b2)==null)   store.set(K.b2,new Date(new Date().getFullYear(),11,31).toISOString().slice(0,10));

  const xpMap=()=>store.get(K.xp,{}), awMap=()=>store.get(K.aw,{});
  const getXP=(d=today())=>xpMap()[d]||0;
  const setXP=(v,d=today())=>{const m=xpMap();m[d]=v;store.set(K.xp,m);};
  function award(tag,amount=5,limit=Infinity){const d=today(); const a=awMap(); a[d]=a[d]||{}; a[d][tag]=a[d][tag]||0; if(a[d][tag]>=limit) return; setXP(getXP(d)+amount,d); a[d][tag]+=1; store.set(K.aw,a); refreshDash?.(); draw14?.();}

  // TTS
  let frVoice=null; try{speechSynthesis.onvoiceschanged=()=>{const vs=speechSynthesis.getVoices(); frVoice=vs.find(v=>/^fr/i.test(v.lang))||null;};}catch{}
  function speakOne(text,rate=1){try{const u=new SpeechSynthesisUtterance(text);u.lang='fr-FR';u.rate=rate;if(frVoice)u.voice=frVoice;speechSynthesis.speak(u);}catch{alert('TTS not available');}}

  // fetch JSON
  async function fetchJSON(path,fb){try{const r=await fetch(path,{cache:'no-store'}); if(!r.ok) throw 0; return await r.json();}catch{return fb}}

  /* ===========================
     DASH (minimal, reused)
  =========================== */
  function last14(){const m=xpMap(),t=new Date(),arr=[];for(let i=13;i>=0;i--){const d=new Date(t);d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);arr.push({k,xp:m[k]||0})}return arr;}
  function draw14(){const c=$('#chart14'); if(!c)return; const g=c.getContext('2d'); const r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1; c.width=Math.floor(r.width*dpr); c.height=Math.floor(150*dpr);
    const data=last14(),W=c.width,H=c.height,p=22,slot=(W-2*p)/data.length,bw=Math.max(6,slot*.6),max=Math.max(store.get(K.goal,30),...data.map(d=>d.xp),30);
    g.clearRect(0,0,W,H); g.fillStyle='#5aa2ff'; let sum=0; data.forEach((d,i)=>{sum+=d.xp;const h=(H-2*p)*(d.xp/max); g.fillRect(Math.round(p+i*slot),Math.round(H-p-h),Math.round(bw),Math.round(h));}); $('#sum14')&&($('#sum14').textContent=sum);}
  function refreshDash(){
    if(document.body.dataset.page!=='dashboard') return;
    const goal=store.get(K.goal,30), xp=getXP(); $('#goalVal')&&($('#goalVal').textContent=goal); $('#xpBar')&&($('#xpBar').style.width=Math.min(100,Math.round(xp/goal*100))+'%');
    const end=new Date(store.get(K.b2)); const days=Math.max(0,Math.ceil((end-new Date())/86400000)); $('#countdownBadge')&&($('#countdownBadge').textContent=`📅 ${days} days to B2`);
    $('#xpLabel')&&($('#xpLabel').textContent=`${xp}/${goal}`);
  }

  /* ===========================
     VOCAB (randomized + Next + load-starter)
  =========================== */
  function deck(){return store.get(K.vocab,[])} function saveDeck(d){store.set(K.vocab,d)}
  function addCard(fr,en){const id=Date.now()+Math.random(); const c={id,fr,en,ease:2.5,interval:0,reps:0,leech:0,due:fmt(today())}; saveDeck([...deck(),c]);}
  function dueCount(){const t=today(); return deck().filter(w=>w.due<=t).length}
  function srsRate(card,grade){
    if(grade<3){card.reps=0; card.interval=1; card.ease=Math.max(1.3,(card.ease||2.5)-0.2); card.leech=(card.leech||0)+1;}
    else{card.reps=(card.reps||0)+1; if(card.reps===1) card.interval=1; else if(card.reps===2) card.interval=3; else card.interval=Math.round((card.interval||1)*(card.ease||2.5)); card.ease=Math.min(3.2,(card.ease||2.5)+(grade===4?0.15:0));}
    card.due=fmt(addDays(new Date(),card.interval||1));
  }
  async function maybeSeedVocab(){
    if(deck().length) return;
    const fb={pairs:["bonjour|hello","merci|thank you"]};
    const data=await fetchJSON('data/vocab.json',fb);
    if(Array.isArray(data.pairs)){ const now=today(); const seeded=data.pairs.map((ln,i)=>{const [fr,en]=ln.split('|').map(s=>s.trim()); return {id:Date.now()+i+Math.random(),fr,en,ease:2.5,interval:0,reps:0,leech:0,due:now};}); saveDeck(seeded);}
  }
  function stats(){ if(document.body.dataset.page!=='vocab')return; $('#dueNow').textContent=dueCount(); $('#totalCards').textContent=deck().length; }
  function renderTable(){
    if(document.body.dataset.page!=='vocab')return; const tb=$('#vTable tbody'); tb.innerHTML='';
    deck().forEach(w=>{const tr=document.createElement('tr'); tr.innerHTML=`<td>${esc(w.fr)}</td><td>${esc(w.en)}</td><td class="small">${w.due}</td><td>${w.leech||0}</td><td><button class="btn bad small" data-del="${w.id}">Del</button></td>`; tb.appendChild(tr);});
    tb.onclick=e=>{const id=e.target.getAttribute('data-del'); if(!id) return; saveDeck(deck().filter(x=>x.id!=id)); renderTable(); stats();};
  }

  // Quick Review (random)
  let qrQ=[], qrCur=null;
  function qrQueue(){
    const t=today();
    const due = deck().filter(w=>w.due<=t);
    const leeches = deck().filter(w=>(w.leech||0)>=2);
    const pool = [...leeches, ...due];
    const base = pool.length? pool : deck();
    return shuffle(base).slice(0,12);
  }
  function qrServe(){
    qrQ = qrQueue(); qrCur = qrQ.shift();
    if(!qrCur){ $('#qr-front').textContent='No cards'; $('#qr-back').style.display='none'; $('#qr-info').textContent='Due: 0'; return; }
    $('#qr-front').textContent=qrCur.fr; $('#qr-back').textContent=qrCur.en; $('#qr-back').style.display='none';
    $('#qr-info').textContent=`Due: ${dueCount()} • Leech: ${qrCur.leech||0}`;
  }

  function initVocab(){
    if(document.body.dataset.page!=='vocab') return;
    maybeSeedVocab().then(()=>{ renderTable(); stats(); qrServe(); });

    // CRUD
    $('#addWord').onclick=()=>{const fr=$('#vFr').value.trim(),en=$('#vEn').value.trim(); if(!fr||!en)return; addCard(fr,en); $('#vFr').value=''; $('#vEn').value=''; renderTable(); stats();};
    $('#exportVocab').onclick=()=>{const blob=new Blob([JSON.stringify(deck(),null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='vocab.json'; a.click(); URL.revokeObjectURL(url);};
    $('#importVocab').onchange=e=>{const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{try{const d=JSON.parse(r.result); if(Array.isArray(d)) saveDeck(d); else if(Array.isArray(d.pairs)){ const now=today(); saveDeck(d.pairs.map((ln,i)=>{const [fr,en]=ln.split('|').map(s=>s.trim()); return {id:Date.now()+i+Math.random(),fr,en,ease:2.5,interval:0,reps:0,leech:0,due:now};})); } renderTable(); stats(); qrServe(); }catch{alert('Invalid JSON')}}; r.readAsText(f);};

    // NEW: Load starter 500+ deck (replaces deck)
    $('#loadStarter').onclick=async()=>{ if(!confirm('Replace your current deck with the 500+ starter deck?')) return;
      const data=await fetchJSON('data/vocab.json',{pairs:[]}); if(Array.isArray(data.pairs)&&data.pairs.length){ const now=today(); const seeded=data.pairs.map((ln,i)=>{const [fr,en]=ln.split('|').map(s=>s.trim()); return {id:Date.now()+i+Math.random(),fr,en,ease:2.5,interval:0,reps:0,leech:0,due:now};}); saveDeck(seeded); renderTable(); stats(); qrServe(); alert('Loaded 500+ starter deck.'); }
      else alert('Could not load starter deck.');
    };
    $('#clearVocab').onclick=()=>{ if(confirm('Delete all words?')){ saveDeck([]); renderTable(); stats(); qrServe(); } };

    // Classic session (random order) + “Next”
    let Q=[], cur=null;
    function serve(){ cur=Q.shift(); if(!cur){ $('#quizFront h2').textContent='All done 👏'; ['rateAgain','rateHard','rateGood','rateEasy'].forEach(id=>$('#'+id).disabled=true); $('#quizBack').textContent=''; award('vocabSession',5,2); return; } $('#quizFront h2').textContent=cur.fr; $('#quizBack').textContent=''; ['rateAgain','rateHard','rateGood','rateEasy'].forEach(id=>$('#'+id).disabled=true); $('#revealA').disabled=false;}
    $('#startQuiz').onclick=()=>{const t=today(); Q=shuffle(deck().filter(w=>w.due<=t)); if(!Q.length){alert('No cards due.');return} serve();};
    $('#nextCard').onclick=serve;
    $('#revealA').onclick=()=>{ if(!cur)return; $('#quizBack').textContent=cur.en; ['rateAgain','rateHard','rateGood','rateEasy'].forEach(id=>$('#'+id).disabled=false); $('#revealA').disabled=true; };
    function rate(g){ const list=deck(); const i=list.findIndex(x=>x.id===cur.id); if(i>-1){ srsRate(list[i],g); saveDeck(list); } renderTable(); stats(); serve(); }
    $('#rateAgain').onclick=()=>rate(0); $('#rateHard').onclick=()=>rate(2); $('#rateGood').onclick=()=>rate(3); $('#rateEasy').onclick=()=>rate(4);

    // Quick Review handlers
    $('#qr-show').onclick=()=>{ $('#qr-back').style.display='block'; };
    $('#qr-speak').onclick=()=>{ speakOne($('#qr-front').textContent,1); };
    $('#qr-next').onclick=()=>{ qrServe(); };
    $('#qr-dk').onclick=()=>{ if(!qrCur)return; const list=deck(); const i=list.findIndex(x=>x.id===qrCur.id); if(i>-1){ list[i].leech=(list[i].leech||0)+1; list[i].ease=Math.max(1.3,(list[i].ease||2.5)-0.4); list[i].interval=1; list[i].due=fmt(addDays(new Date(),1)); saveDeck(list);} award('vocabSession',5,2); qrServe(); renderTable(); stats(); };
    $('#qr-know').onclick=()=>{ if(!qrCur)return; const list=deck(); const i=list.findIndex(x=>x.id===qrCur.id); if(i>-1){ srsRate(list[i],4); saveDeck(list);} award('vocabSession',5,2); qrServe(); renderTable(); stats(); };
  }

  /* ===========================
     COMPREHENSION — Sentence Flashcards
  =========================== */
  function compDeck(){return store.get(K.compDeck,[])} function saveCompDeck(d){store.set(K.compDeck,d)}
  async function maybeSeedComp(){
    if(compDeck().length) return;
    const fb={pairs:["Je m’appelle Nick.|My name is Nick."]};
    const data=await fetchJSON('data/sentences.json',fb);
    if(Array.isArray(data.pairs)){ const now=today(); const seeded=data.pairs.map((ln,i)=>{const [fr,en]=ln.split('|').map(s=>s.trim()); return {id:Date.now()+i+Math.random(),fr,en,ease:2.5,interval:0,reps:0,leech:0,due:now};}); saveCompDeck(seeded);}
  }
  let cfQ=[], cfCur=null;
  function cfQueue(){
    const t=today();
    const due = compDeck().filter(w=>w.due<=t);
    const leeches = compDeck().filter(w=>(w.leech||0)>=2);
    const pool = [...leeches, ...due];
    const base = pool.length? pool : compDeck();
    return shuffle(base).slice(0,12);
  }
  function cfServe(){
    if(document.body.dataset.page!=='comprehension') return;
    cfQ = cfQueue(); cfCur = cfQ.shift();
    if(!cfCur){ $('#cf-front').textContent='No sentences'; $('#cf-back').style.display='none'; $('#cf-info').textContent='Due: 0'; return; }
    $('#cf-front').textContent=cfCur.fr; $('#cf-back').textContent=cfCur.en; $('#cf-back').style.display='none';
    $('#cf-info').textContent=`Due: ${compDeck().filter(w=>w.due<=today()).length} • Leech: ${cfCur.leech||0}`;
  }
  function compRate(card,grade){ // reuse SRS
    if(grade<3){card.reps=0; card.interval=1; card.ease=Math.max(1.3,(card.ease||2.5)-0.2); card.leech=(card.leech||0)+1;}
    else{card.reps=(card.reps||0)+1; if(card.reps===1) card.interval=1; else if(card.reps===2) card.interval=3; else card.interval=Math.round((card.interval||1)*(card.ease||2.5)); card.ease=Math.min(3.2,(card.ease||2.5)+(grade===4?0.15:0));}
    card.due=fmt(addDays(new Date(),card.interval||1));
  }
  function initCompFlashcards(){
    if(document.body.dataset.page!=='comprehension') return;
    maybeSeedComp().then(()=> cfServe());
    $('#cf-show').onclick=()=>{ $('#cf-back').style.display='block'; };
    $('#cf-speak').onclick=()=>{ speakOne($('#cf-front').textContent,1); };
    $('#cf-next').onclick=()=> cfServe();
    $('#cf-dk').onclick=()=>{ if(!cfCur)return; const list=compDeck(); const i=list.findIndex(x=>x.id===cfCur.id); if(i>-1){ list[i].leech=(list[i].leech||0)+1; list[i].ease=Math.max(1.3,(list[i].ease||2.5)-0.4); list[i].interval=1; list[i].due=fmt(addDays(new Date(),1)); saveCompDeck(list);} award('compDone',5,2); cfServe(); };
    $('#cf-know').onclick=()=>{ if(!cfCur)return; const list=compDeck(); const i=list.findIndex(x=>x.id===cfCur.id); if(i>-1){ compRate(list[i],4); saveCompDeck(list);} award('compDone',5,2); cfServe(); };
  }

  /* ===========================
     EXISTING COMP MODES (kept light)
  =========================== */
  async function initComprehensionModes(){
    if(document.body.dataset.page!=='comprehension')return;
    const fb=[{type:'mcq',title:'Transports propres',level:'B1',fr:'La ville investit dans les bus électriques pour réduire la pollution.',en:'The city invests in electric buses to reduce pollution.',options:['Pour attirer les touristes.','Pour réduire la pollution.','Pour baisser les prix.'],answer:1}];
    const data=await fetchJSON('data/news.json',fb);
    const items=Array.isArray(data)&&data.length?data:fb;
    const tabs=$$('.tabs .tab'); const panes={mcq:$('#pane-mcq'),cloze:$('#pane-cloze'),sa:$('#pane-sa'),tf:$('#pane-tf')};
    tabs.forEach(t=>t.onclick=()=>{tabs.forEach(x=>x.classList.remove('active')); t.classList.add('active'); Object.values(panes).forEach(p=>p.style.display='none'); panes[t.dataset.t].style.display='';});

    // MCQ
    let mi=0, mcqEN=false;
    function renderMCQ(){const it=items.filter(x=>x.type==='mcq'); if(!it.length)return; const a=it[mi%it.length]; $('#mcqTitle').textContent=`${a.title} · ${a.level}`; $('#mcqText').value=(mcqEN?a.en:a.fr)||''; const box=$('#mcqOptions'); box.innerHTML=''; (a.options||[]).forEach((opt,i)=>{const b=document.createElement('button'); b.className='btn'; b.textContent=opt; b.onclick=()=>{const ok=i==a.answer; $('#mcqResult').textContent=ok?'✅ Correct':'❌ Incorrect'; if(ok) award('compDone',5,2);}; box.appendChild(b);});}
    $('#mcqLang').onclick=()=>{mcqEN=!mcqEN;renderMCQ();}; $('#mcqNext').onclick=()=>{mi++;renderMCQ();}; $('#mcqSpeak').onclick=()=>speakOne($('#mcqText').value,.95); renderMCQ();

    // Keep cloze/sa/tf lightweight (can expand later)…
  }

  /* ===========================
     BOOT
  =========================== */
  function boot(){
    const page=document.body.dataset.page||''; $$('.nav a').forEach(a=>a.classList.toggle('active', a.getAttribute('href').includes(page)||(page==='dashboard'&&a.getAttribute('href').includes('index'))));
    if(page==='dashboard'){refreshDash();draw14();window.addEventListener('resize',draw14);}
    initVocab();
    initCompFlashcards();
    initComprehensionModes();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
