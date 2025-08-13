/* French B2 Journey — Advanced build (auto-XP, SRS+, TTS queue) */
(() => {
  // ---------- helpers ----------
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const today=()=>new Date().toISOString().slice(0,10);
  const addDays=(d,n)=>{const x=new Date(d); x.setDate(x.getDate()+n); return x;};
  const fmt=d=>new Date(d).toISOString().slice(0,10);
  const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const words=t=>(t||'').trim().split(/\s+/).filter(Boolean);

  // ---------- safe store ----------
  const store=(()=>{let p=true,mem={};try{localStorage.setItem('__t','1');localStorage.removeItem('__t');}catch{p=false}
    const get=(k,d)=>{try{if(p){const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}}catch{p=false}return k in mem?mem[k]:d};
    const set=(k,v)=>{try{if(p){localStorage.setItem(k,JSON.stringify(v));return true}}catch{p=false}mem[k]=v;return false};
    const clear=()=>{try{localStorage.clear()}catch{}for(const k in mem)delete mem[k]};
    return {get,set,clear,isPersistent:()=>p};
  })();

  // ---------- keys ----------
  const K={goal:'fj_goal_xp',xp:'fj_xp_by_day',awards:'fj_awards_by_day',
    dailyMin:'fj_daily_minutes',weeklyH:'fj_weekly_hours',b2:'fj_b2_target',
    seed:'fj_phr_seed',vocab:'fj_vocab',calT:'fj_cal_target',calD:'fj_cal_done'};
  if(store.get(K.goal)==null)store.set(K.goal,30);
  if(store.get(K.xp)==null)store.set(K.xp,{});
  if(store.get(K.awards)==null)store.set(K.awards,{});
  if(store.get(K.dailyMin)==null)store.set(K.dailyMin,40);
  if(store.get(K.weeklyH)==null)store.set(K.weeklyH,8);
  if(store.get(K.b2)==null)store.set(K.b2,new Date(new Date().getFullYear(),11,31).toISOString().slice(0,10));
  if(store.get(K.vocab)==null)store.set(K.vocab,[]);

  // ---------- XP engine (auto) ----------
  const xpMap=()=>store.get(K.xp,{}), awMap=()=>store.get(K.awards,{});
  const getXP=(d=today())=>xpMap()[d]||0;
  const setXP=(v,d=today())=>{const m=xpMap();m[d]=v;store.set(K.xp,m);};
  function award(tag,amount=5,limit=Infinity){ // per-day per-tag guard
    const d=today(); const a=awMap(); a[d]=a[d]||{}; a[d][tag]=a[d][tag]||0;
    if(a[d][tag]>=limit) return; // limit reached
    setXP(getXP(d)+amount,d); a[d][tag]+=1; store.set(K.awards,a); refreshDash(); draw14(); updateChecklist();
  }

  // ---------- TTS queue (phrases/news) ----------
  let frVoice=null; try{ speechSynthesis.onvoiceschanged=()=>{const vs=speechSynthesis.getVoices(); frVoice=vs.find(v=>/^fr/i.test(v.lang))||null;}; }catch{}
  function speakOne(text,rate=1){try{const u=new SpeechSynthesisUtterance(text);u.lang='fr-FR';u.rate=rate;if(frVoice)u.voice=frVoice;speechSynthesis.speak(u);return u;}catch{alert('TTS not available');return null}}
  let q=[], playing=false, stopFlag=false;
  function playQueue(list,rate=1,interval=1200,doneTag){ if(!('speechSynthesis'in window)) {alert('TTS not available');return}
    stopQueue(); q=list.slice(); stopFlag=false;
    function next(){ if(stopFlag||!q.length){ playing=false; if(doneTag) award(doneTag,5,1); return; }
      const text=q.shift(); const u=speakOne(text,rate); playing=true;
      if(!u){ playing=false; return; }
      u.onend=()=>{ if(stopFlag){playing=false;return;} setTimeout(next,interval); };
      u.onerror=()=>{ setTimeout(next,interval); };
    } next();
  }
  function stopQueue(){ try{stopFlag=true; speechSynthesis.cancel();}catch{} playing=false; q.length=0; }

  // ---------- Dashboard ----------
  function ringDraw(v,goal){
    const c=$('#ring'); if(!c)return; const g=c.getContext('2d'); const W=c.width,H=c.height; g.clearRect(0,0,W,H);
    const cx=W/2,cy=H/2,r=Math.min(W,H)/2-8; const start=-Math.PI/2; const perc=Math.min(1,v/goal||0);
    // bg
    g.lineWidth=12; g.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--ringbg')||'#0d1830';
    g.beginPath(); g.arc(cx,cy,r,0,Math.PI*2); g.stroke();
    // fg
    g.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--ring')||'#72b0ff';
    g.beginPath(); g.arc(cx,cy,r,start,start+perc*2*Math.PI); g.stroke();
  }
  function weekNum(date=new Date()){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil(((d-y)/86400000+1)/7);}
  function weekXP(){const m=xpMap(),now=new Date(),wk=weekNum(now);let s=0;for(const[k,v]of Object.entries(m)){const dt=new Date(k);if(weekNum(dt)===wk&&dt.getFullYear()===now.getFullYear())s+=v||0}return s;}
  function last14(){const m=xpMap(),t=new Date(),arr=[];for(let i=13;i>=0;i--){const d=new Date(t);d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);arr.push({k,xp:m[k]||0})}return arr;}
  function draw14(){const c=$('#chart14'); if(!c)return; const g=c.getContext('2d'); const r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1; c.width=Math.floor(r.width*dpr); c.height=Math.floor(150*dpr);
    const data=last14(),W=c.width,H=c.height,p=22,slot=(W-2*p)/data.length,bw=Math.max(6,slot*.6),max=Math.max(store.get(K.goal,30),...data.map(d=>d.xp),30);
    g.clearRect(0,0,W,H); g.fillStyle='#5aa2ff'; let sum=0; data.forEach((d,i)=>{sum+=d.xp;const h=(H-2*p)*(d.xp/max); g.fillRect(Math.round(p+i*slot),Math.round(H-p-h),Math.round(bw),Math.round(h));}); $('#sum14')&&($('#sum14').textContent=sum);}
  function refreshDash(){
    if(document.body.dataset.page!=='dashboard')return;
    const goal=store.get(K.goal,30), xp=getXP();
    $('#goalVal').textContent=goal; $('#xpBar').style.width=Math.min(100,Math.round(xp/goal*100))+'%';
    $('#streakBadge').textContent='🔥 Streak: '+calcStreak(goal); $('#wkXp').textContent=weekXP();
    $('#saveStatus').textContent=store.isPersistent()?'💾 saved':'⚠️ memory';
    $('#xpLabel').textContent=`${xp}/${goal}`; ringDraw(xp,goal);
    const end=new Date(store.get(K.b2)); const days=Math.max(0,Math.ceil((end-new Date())/86400000)); $('#countdownBadge').textContent=`📅 ${days} days to B2`;
    $('#nextAction').textContent = suggestNext();
  }
  function calcStreak(goal){const m=xpMap();let s=0,day=new Date();for(;;){const k=day.toISOString().slice(0,10);if((m[k]||0)>=goal){s++;day.setDate(day.getDate()-1)}else break}return s;}
  function suggestNext(){
    const a=awMap()[today()]||{};
    if(!a.vocabSession) return 'Do a Quick-Review (5 cards)';
    if(!a.compDone) return 'One comprehension activity';
    if(!a.speakingMin) return 'Record ≥ 60s speaking';
    if(!a.listenTask) return 'One listening task';
    if(!a.phrSet) return 'Play today’s phrases';
    return 'Free choice — keep the streak!';
  }
  function updateChecklist(){
    const a=awMap()[today()]||{};
    $('#chk-vocab').textContent=(a.vocabSession?'✅':'⬜')+' Vocab review (SRS)';
    $('#chk-comp').textContent=(a.compDone?'✅':'⬜')+' Comprehension activity';
    $('#chk-speak').textContent=(a.speakingMin?'✅':'⬜')+' Speaking ≥ 60s';
    $('#chk-listen').textContent=(a.listenTask?'✅':'⬜')+' Listening task';
    $('#chk-phr').textContent=(a.phrSet?'✅':'⬜')+' Phrases set';
  }

  // ---------- Comprehension ----------
  async function initComprehension(){
    if(document.body.dataset.page!=='comprehension')return;
    const fb=[{
      type:'mcq',title:'Transports propres',level:'B1',
      fr:'La ville investit dans les bus électriques pour réduire la pollution.',
      en:'The city invests in electric buses to reduce pollution.',
      options:['Pour attirer les touristes.','Pour réduire la pollution.','Pour baisser les prix.'],
      answer:1
    },{
      type:'cloze',title:'Santé publique',level:'B1',
      fr:'Il est important de ___ régulièrement et de ___ suffisamment.',
      en:'It is important to ___ regularly and to ___ enough.',
      blanks:['faire de l’exercice','dormir']
    },{
      type:'sa',title:'Télétravail',level:'B2',
      fr:'Selon le texte, quels sont deux avantages du télétravail ?',
      en:'According to the text, what are two advantages of remote work?',
      key:'flexibilité économie de temps moins de déplacements'
    },{
      type:'tf',title:'Énergie',level:'B1',
      fr:'Les panneaux solaires ne fonctionnent que lorsqu’il fait très chaud.',
      en:'Solar panels work only when it is very hot.',
      statements:[{q:'Vrai ou faux ?',a:false}]
    }];
    const data = await fetchJSON('data/news.json',fb);
    const items = Array.isArray(data)&&data.length?data:fb;

    // Tabs
    const tabs=$$('.tabs .tab'); const panes={mcq:$('#pane-mcq'),cloze:$('#pane-cloze'),sa:$('#pane-sa'),tf:$('#pane-tf')};
    tabs.forEach(t=>t.onclick=()=>{
      tabs.forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      Object.values(panes).forEach(p=>p.style.display='none');
      panes[t.dataset.t].style.display='';
    });

    // MCQ
    let mi=0, mcqEN=false;
    function renderMCQ(){
      const it=items.filter(x=>x.type==='mcq'); if(!it.length) return;
      const a=it[mi%it.length];
      $('#mcqTitle').textContent=`${a.title} · ${a.level}`; $('#mcqText').value= (mcqEN?a.en:a.fr)||'';
      const box=$('#mcqOptions'); box.innerHTML='';
      (a.options||[]).forEach((opt,i)=>{ const b=document.createElement('button'); b.className='btn'; b.textContent=opt; b.onclick=()=>{ const ok=i==a.answer; $('#mcqResult').textContent= ok?'✅ Correct':'❌ Incorrect'; if(ok){ award('compDone',5,2);} }; box.appendChild(b); });
    }
    $('#mcqLang').onclick=()=>{mcqEN=!mcqEN;renderMCQ();};
    $('#mcqNext').onclick=()=>{mi++;renderMCQ();};
    $('#mcqSpeak').onclick=()=>speak($('#mcqText').value,.95);
    renderMCQ();

    // Cloze
    let ci=0, clEN=false;
    function renderCloze(){
      const it=items.filter(x=>x.type==='cloze'); if(!it.length) return;
      const a=it[ci%it.length]; $('#clozeTitle').textContent=`${a.title} · ${a.level}`; $('#clozeText').value=(clEN?a.en:a.fr)||'';
      const box=$('#clozeBlanks'); box.innerHTML='';
      (a.blanks||[]).forEach((w,ix)=>{ const inp=document.createElement('input'); inp.className='input'; inp.placeholder=`Blank ${ix+1}`; inp.dataset.key=w.toLowerCase(); box.appendChild(inp); });
      $('#clozeScore').textContent='';
    }
    $('#clozeLang').onclick=()=>{clEN=!clEN;renderCloze();};
    $('#clozeNext').onclick=()=>{ci++;renderCloze();};
    $('#clozeSpeak').onclick=()=>speak($('#clozeText').value,.95);
    $('#clozeCheck').onclick=()=>{
      const ins=$$('#clozeBlanks input'); let hit=0;
      ins.forEach(i=>{ if(i.value.trim().toLowerCase()===i.dataset.key) hit++; });
      const sc=Math.round(hit/Math.max(1,ins.length)*100); $('#clozeScore').textContent=`Score: ${sc}%`;
      if(sc>=60) award('compDone',5,2);
    };
    renderCloze();

    // Short Answer
    let si=0, saEN=false;
    function renderSA(){
      const it=items.filter(x=>x.type==='sa'); if(!it.length) return;
      const a=it[si%it.length]; $('#saTitle').textContent=`${a.title} · ${a.level}`; $('#saText').value=(saEN?a.en:a.fr)||''; $('#saInput').value=''; $('#saScore').textContent='';
    }
    $('#saLang').onclick=()=>{saEN=!saEN;renderSA();};
    $('#saNext').onclick=()=>{si++;renderSA();};
    $('#saSpeak').onclick=()=>speak($('#saText').value,.95);
    $('#saScoreBtn').onclick=()=>{
      const a=items.filter(x=>x.type==='sa')[si%items.filter(x=>x.type==='sa').length];
      const u=($('#saInput').value||'').toLowerCase(); const key=(a.key||'').toLowerCase().split(/\s+/);
      let hit=0; key.forEach(k=>{ if(u.includes(k)) hit++; }); const sc=Math.round(hit/Math.max(1,key.length)*100);
      $('#saScore').textContent=`Match: ${sc}%`; if(sc>=50) award('compDone',5,2);
    };
    renderSA();

    // True/False
    let ti=0, tfEN=false;
    function renderTF(){
      const it=items.filter(x=>x.type==='tf'); if(!it.length) return;
      const a=it[ti%it.length]; $('#tfTitle').textContent=`${a.title} · ${a.level}`; $('#tfText').value=(tfEN?a.en:a.fr)||'';
      const box=$('#tfQ'); box.innerHTML='';
      (a.statements||[]).forEach(st=>{
        const r=document.createElement('div'); r.className='row';
        const vb=document.createElement('button'); vb.className='btn'; vb.textContent='Vrai';
        const fb=document.createElement('button'); fb.className='btn'; fb.textContent='Faux';
        vb.onclick=()=>{ const ok=!!st.a; $('#tfScore').textContent= ok?'✅ Correct':'❌ Incorrect'; if(ok) award('compDone',5,2); };
        fb.onclick=()=>{ const ok=!st.a; $('#tfScore').textContent= ok?'✅ Correct':'❌ Incorrect'; if(ok) award('compDone',5,2); };
        r.appendChild(document.createTextNode(st.q)); r.appendChild(vb); r.appendChild(fb); box.appendChild(r);
      });
    }
    $('#tfLang').onclick=()=>{tfEN=!tfEN;renderTF();};
    $('#tfNext').onclick=()=>{ti++;renderTF();};
    $('#tfSpeak').onclick=()=>speak($('#tfText').value,.95);
    renderTF();
  }

  // ---------- Listening ----------
  async function initListening(){
    if(document.body.dataset.page!=='listening')return;
    // tabs
    const tabs=$$('.tabs .tab'); const pd=$('#pane-dict'), pn=$('#pane-news');
    tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.remove('active')); b.classList.add('active'); pd.style.display=b.dataset.t==='dict'?'':'none'; pn.style.display=b.dataset.t==='news'?'':'none';});

    // dictation
    const dfb=[{text:"Pouvez-vous répéter plus lentement, s'il vous plaît ?",hint:"Demande polie"}];
    const dicts=await fetchJSON('data/dictation.json',dfb); let di=0, last=null;
    function dShow(){const d=dicts[di%dicts.length]; $('#dictationHint').textContent='Hint: '+(d.hint||''); $('#dictationInput').value=''; $('#dictationScore').textContent='Score: 0%'; last=null;}
    function dPlay(){const d=dicts[di%dicts.length]; try{speechSynthesis.cancel(); const u=speakOne(d.text,.95); last=u;}catch{}}
    $('#playDictation').onclick=dPlay; $('#replayDictation').onclick=()=>{try{last?speechSynthesis.speak(last):dPlay();}catch{}};
    $('#nextDictation').onclick=()=>{di=(di+1)%dicts.length; dShow();};
    $('#checkDictation').onclick=()=>{const tgt=(dicts[di%dicts.length].text||'').toLowerCase(); const g=($('#dictationInput').value||'').toLowerCase();
      const A=tgt.replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/), B=g.replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/); const set=new Set(A); let m=0; B.forEach(w=>set.has(w)&&m++); const sc=A.length?Math.round(m/A.length*100):0; $('#dictationScore').textContent=`Score: ${sc}%`; if(sc>=60) award('listenTask',5,2);};
    dShow();

    // news bulletins (synthetic summaries)
    const nfb={france:["À Paris, les travaux de mobilité douce se poursuivent, avec de nouvelles pistes cyclables ouvertes dans plusieurs arrondissements."],
               world:["Dans le monde, plusieurs régions affrontent des vagues de chaleur; les autorités recommandent de rester hydraté."],
               economy:["L’inflation montre des signes de stabilisation, tandis que les entreprises surveillent la demande intérieure."],
               tech:["Les innovations en IA générative continuent d’émerger, avec un accent sur l’éthique et la transparence."],
               sport:["En sport, les championnats nationaux reprennent ce week-end avec des affiches très attendues."],
               culture:["La saison des festivals bat son plein, mettant en lumière des artistes émergents à travers le pays."]};
    const news=await fetchJSON('data/news_summaries.json',nfb);
    function bulletin(topic){
      const arr=news[topic]||nfb.france; const idx=(parseInt(today().replace(/-/g,''),10)+arr.length)%arr.length;
      return `[${topic.toUpperCase()}] ${arr[idx]}`;
    }
    $('#playNews').onclick=()=>{ const t=$('#newsTopic').value; const text=bulletin(t); $('#newsBox').value=text; playQueue([text],.98,0,'listenTask'); };
    $('#stopNews').onclick=()=>stopQueue();
  }

  // ---------- Speaking ----------
  async function initSpeaking(){
    if(document.body.dataset.page!=='speaking')return;
    const fb={daily:["Décris ta routine du matin.","Parle de ta ville.","Quel est ton objectif cette semaine ?"]};
    const prompts=await fetchJSON('data/prompts.json',fb); const cat=$('#promptCat');
    Object.keys(prompts).forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;cat.appendChild(o);});
    function rnd(cat){const arr=prompts[cat]||Object.values(prompts)[0]||[];return arr[Math.floor(Math.random()*arr.length)]||'';}
    function setP(){ $('#promptBox').value=rnd(cat.value); }
    $('#newPrompt').onclick=setP; cat.onchange=setP; $('#speakPrompt').onclick=()=>speak($('#promptBox').value,1); setP();

    const SR=window.SpeechRecognition||window.webkitSpeechRecognition; let rec=null,start=0,timer=null;
    const out=$('#speechOut'); const state=s=>$('#recState').textContent='🗣️ State: '+s;
    $('#askMic').onclick=async()=>{try{const s=await navigator.mediaDevices.getUserMedia({audio:true}); s.getTracks().forEach(t=>t.stop()); $('#micState').textContent='🎙️ Micro: granted';}catch{$('#micState').textContent='🎙️ Micro: blocked';alert('Allow microphone')}}; 
    $('#startRec').onclick=()=>{
      if(!SR){alert('Speech recognition not available (Chrome).');return}
      if(rec) return; rec=new SR(); rec.lang='fr-FR'; rec.interimResults=true; rec.continuous=true; out.value=''; state('listening'); start=Date.now();
      rec.onresult=e=>{let t=''; for(let i=0;i<e.results.length;i++) t+=e.results[i][0].transcript+(e.results[i].isFinal?'\n':' '); out.value=t.trim();};
      rec.onend=()=>{state('idle'); clearInterval(timer); timer=null; const secs=Math.round((Date.now()-start)/1000); if(secs>=60) award('speakingMin',5,2); rec=null;};
      try{rec.start(); $('#stopRec').disabled=false; timer=setInterval(()=>{document.title=`B2 — ${Math.round(words(out.value).length/Math.max(1,(Date.now()-start)/1000)*60)} wpm`;},1000);}catch{rec=null;}
    };
    $('#stopRec').onclick=()=>{try{rec&&rec.stop();}catch{} $('#stopRec').disabled=true;};
  }

  // ---------- Vocabulary (SRS + Quick Review) ----------
  function deck(){return store.get(K.vocab,[])} function saveDeck(d){store.set(K.vocab,d)}
  function dueCount(){const t=today();return deck().filter(w=>w.due<=t).length}
  function addCard(fr,en){const id=Date.now()+Math.random(); const c={id,fr,en,ease:2.5,interval:0,reps:0,leech:0,due:fmt(today())}; saveDeck([...deck(),c]);}
  async function maybeSeed(){ if(deck().length) return; const fb={pairs:["bonjour|hello","merci|thank you"]}; const data=await fetchJSON('data/vocab.json',fb); if(Array.isArray(data.pairs)){ const now=today(); const seeded=data.pairs.map((ln,i)=>{const [fr,en]=ln.split('|').map(s=>s.trim()); return {id:Date.now()+i+Math.random(),fr,en,ease:2.5,interval:0,reps:0,leech:0,due:now};}); saveDeck(seeded);} }
  function renderTable(){
    if(document.body.dataset.page!=='vocab')return; const tb=$('#vTable tbody'); tb.innerHTML='';
    deck().forEach(w=>{const tr=document.createElement('tr'); tr.innerHTML=`<td>${esc(w.fr)}</td><td>${esc(w.en)}</td><td class="small">${w.due}</td><td>${w.leech||0}</td><td><button class="btn bad small" data-del="${w.id}">Del</button></td>`; tb.appendChild(tr);});
    tb.onclick=e=>{const id=e.target.getAttribute('data-del'); if(!id) return; saveDeck(deck().filter(x=>x.id!=id)); renderTable(); stats();};
  }
  function stats(){ if(document.body.dataset.page!=='vocab')return; $('#dueNow').textContent=dueCount(); $('#totalCards').textContent=deck().length; }
  function srsRate(card,grade){
    if(grade<3){card.reps=0; card.interval=1; card.ease=Math.max(1.3,(card.ease||2.5)-0.2); card.leech=(card.leech||0)+1;}
    else{card.reps=(card.reps||0)+1; if(card.reps===1) card.interval=1; else if(card.reps===2) card.interval=3; else card.interval=Math.round((card.interval||1)*(card.ease||2.5)); card.ease=Math.min(3.1,(card.ease||2.5)+(grade===4?0.15:0));}
    card.due=fmt(addDays(new Date(),card.interval||1));
  }
  // Quick Review
  let qrQ=[], qrCur=null;
  function makeQRQueue(){
    const t=today(); const due=deck().filter(w=>w.due<=t);
    const leeches=deck().filter(w=>(w.leech||0)>=2); const mix=[...leeches,...due].slice(0,12);
    if(!mix.length) return deck().slice(0,8); return mix;
  }
  function qrServe(){
    qrQ=makeQRQueue(); qrCur=qrQ.shift();
    if(!qrCur){ $('#qr-front').textContent='No cards due'; $('#qr-back').style.display='none'; $('#qr-info').textContent='Due: 0'; return; }
    $('#qr-front').textContent=qrCur.fr; $('#qr-back').textContent=qrCur.en; $('#qr-back').style.display='none';
    $('#qr-info').textContent=`Due: ${dueCount()} • Leech: ${qrCur.leech||0}`;
  }
  function initVocab(){
    if(document.body.dataset.page!=='vocab')return;
    maybeSeed().then(()=>{ renderTable(); stats(); qrServe(); });
    $('#addWord').onclick=()=>{const fr=$('#vFr').value.trim(),en=$('#vEn').value.trim(); if(!fr||!en)return; addCard(fr,en); $('#vFr').value='';$('#vEn').value=''; renderTable(); stats(); };
    $('#exportVocab').onclick=()=>{try{const blob=new Blob([JSON.stringify(deck(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='vocab.json';a.click();URL.revokeObjectURL(url);}catch{alert('Export unavailable');}};
    $('#importVocab').onchange=e=>{const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{try{const data=JSON.parse(r.result); if(Array.isArray(data)) saveDeck(data); else if(Array.isArray(data.pairs)){ const now=today(); saveDeck(data.pairs.map((ln,i)=>{const [fr,en]=ln.split('|').map(s=>s.trim()); return {id:Date.now()+i+Math.random(),fr,en,ease:2.5,interval:0,reps:0,leech:0,due:now};})); } renderTable(); stats(); qrServe(); }catch{alert('Invalid JSON')}}; r.readAsText(f);};
    $('#clearVocab').onclick=()=>{ if(confirm('Delete all words?')){ saveDeck([]); renderTable(); stats(); qrServe(); } };

    // Review session (classic)
    let Q=[], cur=null;
    function serve(){ cur=Q.shift(); if(!cur){ $('#quizFront h2').textContent='All done 👏'; ['rateAgain','rateHard','rateGood','rateEasy'].forEach(id=>$('#'+id).disabled=true); $('#quizBack').textContent=''; award('vocabSession',5,2); return; } $('#quizFront h2').textContent=cur.fr; $('#quizBack').textContent=''; ['rateAgain','rateHard','rateGood','rateEasy'].forEach(id=>$('#'+id).disabled=true); $('#revealA').disabled=false;}
    $('#startQuiz').onclick=()=>{const t=today(); Q=deck().filter(w=>w.due<=t); if(!Q.length){alert('No cards due.');return} serve();};
    $('#skipCard').onclick=serve;
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

  // ---------- Phrases ----------
  async function initPhrases(){
    if(document.body.dataset.page!=='phrases')return;
    const fb=["Bonjour, comment ça va ?","Merci beaucoup !","Pouvez-vous parler plus lentement ?","Je ne comprends pas.","C’est une bonne idée.","À demain !"];
    const data=await fetchJSON('data/phrases.json',fb); const P=Array.isArray(data)&&data.length?data:fb;
    function pick10(){const seed=parseInt((store.get(K.seed)??Date.now()).toString().slice(-6),10); const day=parseInt(today().replace(/-/g,''),10); const rand=n=>(Math.abs(Math.sin(seed+day+n))*10000)%P.length|0; const set=new Set(); while(set.size<10&&set.size<P.length)set.add(rand(set.size)); return [...set].map(i=>P[i]);}
    function render(){const c=$('#phraseList'); c.innerHTML=''; pick10().forEach((p,i)=>{const row=document.createElement('div'); row.className='row'; row.style.margin='6px 0'; const b=document.createElement('button'); b.className='btn'; b.textContent='🔊'; b.onclick=()=>speakOne(p,1); const s=document.createElement('span'); s.textContent=(i+1)+'. '+p; row.appendChild(b); row.appendChild(s); c.appendChild(row);});}
    $('#refreshPhrases').onclick=()=>{store.set(K.seed,Date.now()); render();};
    $('#speakAllPhrases').onclick=()=>{playQueue(pick10(),1,1300,'phrSet');};
    $('#stopAllPhrases').onclick=()=>stopQueue();
    render();
  }

  // ---------- Goals ----------
  function initGoals(){
    if(document.body.dataset.page!=='goals')return;
    $('#dailyMinutes').value=store.get(K.dailyMin,40);
    $('#weeklyHours').value=store.get(K.weeklyH,8);
    $('#dailyXP').value=store.get(K.goal,30);
    $('#b2Target').value=store.get(K.b2);
    const upd=()=>{const t=new Date($('#b2Target').value||store.get(K.b2)); const days=Math.max(0,Math.ceil((t-new Date())/86400000)); $('#b2Countdown').textContent=`${days} days left`;};
    upd();
    $('#saveDailyMinutes').onclick=()=>store.set(K.dailyMin,Math.max(10,parseInt($('#dailyMinutes').value||40,10)));
    $('#saveWeeklyHours').onclick=()=>store.set(K.weeklyH,Math.max(1,parseInt($('#weeklyHours').value||8,10)));
    $('#saveDailyXP').onclick=()=>store.set(K.goal,Math.max(10,parseInt($('#dailyXP').value||30,10)));
    $('#saveTarget').onclick=()=>{const v=$('#b2Target').value; if(v){store.set(K.b2,v);upd();}};
  }

  // ---------- Calendar ----------
  function initCalendar(){
    if(document.body.dataset.page!=='calendar')return;
    const targetInput=$('#target-date'), setBtn=$('#setTarget'), container=$('#calendarContainer'), summary=$('#summary');
    const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], DAYS=['Mo','Tu','We','Th','Fr','Sa','Su'];
    function getTarget(){return new Date(store.get(K.calT)||store.get(K.b2));}
    function getDone(){return new Set(store.get(K.calD,[]));}
    function saveDone(s){store.set(K.calD,[...s]);}
    function render(){
      const target=getTarget(); targetInput.value=fmt(target); const done=getDone(); container.innerHTML=''; const todayD=new Date();
      for(let m=0;m<12;m++){
        const head=document.createElement('div'); head.className='calMonth'; head.textContent=`${MONTHS[m]} ${target.getFullYear()}`; container.appendChild(head);
        const grid=document.createElement('div'); grid.className='calGrid'; DAYS.forEach(d=>{const h=document.createElement('div');h.className='calCell';h.style.background='#111a2f';h.textContent=d;grid.appendChild(h);});
        const first=new Date(target.getFullYear(),m,1), off=(first.getDay()+6)%7; for(let i=0;i<off;i++){const e=document.createElement('div');e.className='calCell';e.style.visibility='hidden';grid.appendChild(e);}
        const n=new Date(target.getFullYear(),m+1,0).getDate();
        for(let d=1;d<=n;d++){const cell=document.createElement('div');cell.className='calCell'; const dt=new Date(target.getFullYear(),m,d); const iso=fmt(dt); cell.textContent=d;
          if(iso===fmt(todayD))cell.classList.add('today'); if(dt>todayD) cell.classList.add('future'); else { if(done.has(iso))cell.classList.add('done'); cell.onclick=()=>{ if(cell.classList.toggle('done'))done.add(iso); else done.delete(iso); saveDone(done); update(); }; }
          grid.appendChild(cell);
        }
        container.appendChild(grid);
      } update();
    }
    function update(){ const target=getTarget(), done=getDone(); const daysLeft=Math.max(0,Math.ceil((target-new Date())/86400000)); summary.textContent=`Studied days: ${done.size} • Days left: ${daysLeft}`; }
    setBtn.onclick=()=>{const v=targetInput.value; if(v){store.set(K.calT,v);render();}};
    if(!store.get(K.calT)) store.set(K.calT,store.get(K.b2));
    render();
  }

  // ---------- Data ----------
  function initData(){
    if(document.body.dataset.page!=='data')return;
    $('#exportData').onclick=()=>{const data={}; [K.goal,K.xp,K.awards,K.dailyMin,K.weeklyH,K.b2,K.seed,K.vocab,K.calT,K.calD].forEach(k=>data[k]=store.get(k));
      try{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='french_b2_journey_backup.json';a.click();URL.revokeObjectURL(url);}catch{alert('Export unavailable');}};
    $('#importData').onchange=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const obj=JSON.parse(r.result);Object.entries(obj).forEach(([k,v])=>store.set(k,v));alert('Import OK — reloading');location.reload();}catch{alert('Invalid JSON')}};r.readAsText(f);};
    $('#factoryReset').onclick=()=>{if(confirm('Erase all data?')){store.clear();location.reload();}};
  }

  // ---------- JSON helper ----------
  async function fetchJSON(path,fb){try{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw 0;return await r.json();}catch{return fb}}

  // ---------- boot ----------
  function boot(){
    // nav highlight
    const page=document.body.dataset.page||''; $$('.nav a').forEach(a=>a.classList.toggle('active', a.getAttribute('href').includes(page)||(page==='dashboard'&&a.getAttribute('href').includes('index'))));
    // pages
    if(page==='dashboard'){refreshDash();draw14();updateChecklist();window.addEventListener('resize',draw14);}
    initComprehension(); initListening(); initSpeaking(); initVocab(); initPhrases(); initGoals(); initCalendar(); initData();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
