/* French B2 Journey – single shared script (safe + mobile friendly) */
(() => {
  /* ---------- helpers ---------- */
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const todayKey = () => new Date().toISOString().slice(0,10);
  const addDays  = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const fmt      = (d)=> new Date(d).toISOString().slice(0,10);
  const esc = s => String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  /* ---------- safe storage adapter (prevents freezes) ---------- */
  const store = (() => {
    let persistent = true; const mem = {};
    try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); }
    catch { persistent = false; }
    const get = (k, d) => {
      try { if (persistent) { const v = localStorage.getItem(k); return v==null?d:JSON.parse(v); } }
      catch { persistent = false; }
      return (k in mem)? mem[k] : d;
    };
    const set = (k, v) => {
      try { if (persistent) { localStorage.setItem(k, JSON.stringify(v)); return true; } }
      catch { persistent = false; }
      mem[k]=v; return false;
    };
    const clear = () => { try{localStorage.clear()}catch{} for(const k in mem) delete mem[k]; };
    return { get, set, clear, isPersistent:()=>persistent };
  })();

  /* ---------- keys & defaults ---------- */
  const K = {
    goalDailyXP:'fj_goal_xp',
    xpByDay:'fj_xp_by_day',
    flagsByDay:'fj_flags_by_day',
    dailyMinutes:'fj_daily_minutes',
    weeklyHours:'fj_weekly_hours',
    b2Target:'fj_b2_target',
    phrasesSeed:'fj_phr_seed',
    vocab:'fj_vocab',
    calTarget:'fj_cal_target',
    calDone:'fj_cal_done'
  };
  if (store.get(K.goalDailyXP)==null) store.set(K.goalDailyXP,30);
  if (store.get(K.xpByDay)==null)     store.set(K.xpByDay,{});
  if (store.get(K.flagsByDay)==null)  store.set(K.flagsByDay,{});
  if (store.get(K.dailyMinutes)==null)store.set(K.dailyMinutes,40);
  if (store.get(K.weeklyHours)==null) store.set(K.weeklyHours,8);
  if (store.get(K.vocab)==null)       store.set(K.vocab,[]);
  if (store.get(K.b2Target)==null)    store.set(K.b2Target, new Date(new Date().getFullYear(),11,31).toISOString().slice(0,10));

  /* ---------- TTS + Speech Recognition (guarded) ---------- */
  let frVoice = null;
  function pickVoice(){
    try {
      const vs = speechSynthesis.getVoices();
      frVoice = vs.find(v=>/^fr/i.test(v.lang)) || null;
    }catch{}
  }
  try { speechSynthesis.onvoiceschanged = pickVoice; pickVoice(); } catch {}
  function speak(text, rate=1){
    try{
      if(!('speechSynthesis' in window)) throw 0;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang='fr-FR'; u.rate=rate; if(frVoice) u.voice=frVoice; speechSynthesis.speak(u);
    }catch{ alert('Speech synthesis not available in this browser.'); }
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function startSR(outEl, onState){
    if(!SR){ alert('Speech recognition not available in this browser (try Chrome).'); return null; }
    let rec = new SR(); rec.lang='fr-FR'; rec.interimResults=true; rec.continuous=true;
    if(onState) onState('listening');
    rec.onresult = e => {
      let txt = ''; for(let i=0;i<e.results.length;i++) txt += e.results[i][0].transcript + (e.results[i].isFinal?'\n':' ');
      if(outEl) outEl.value = txt.trim();
    };
    rec.onerror  = e => console.warn('SR error', e);
    rec.onend    = () => onState && onState('idle');
    try{ rec.start(); }catch(e){ console.warn(e); alert('Could not start mic; please allow microphone.'); return null; }
    return rec;
  }

  /* ---------- XP and streak ---------- */
  const xpMap = ()=>store.get(K.xpByDay,{});
  function getXP(d=todayKey()){ return xpMap()[d]||0; }
  function setXP(v,d=todayKey()){ const m=xpMap(); m[d]=v; store.set(K.xpByDay,m); }
  function addXP(n){ setXP(getXP()+n); refreshDashboard(); draw14(); }
  function weekNumber(date=new Date()){
    const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
    const day=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-day);
    const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil(((d-y)/86400000+1)/7);
  }
  function calcStreak(goal){ const m=xpMap(); let s=0, day=new Date(); for(;;){ const k=day.toISOString().slice(0,10); if((m[k]||0)>=goal){ s++; day=addDays(day,-1);} else break; } return s; }
  function weekXP(){ const m=xpMap(); const d=new Date(); const wk=weekNumber(d); let sum=0; for(const [k,v] of Object.entries(m)){ const dt=new Date(k); if(weekNumber(dt)===wk && dt.getFullYear()===d.getFullYear()) sum+=v||0; } return sum; }

  /* ---------- Dashboard init ---------- */
  function refreshCountdown(){
    const t = store.get(K.b2Target);
    const end = t ? new Date(t) : new Date(new Date().getFullYear(),11,31);
    const days = Math.max(0, Math.ceil((end - new Date())/86400000));
    const el = $('#countdownBadge'); if(el) el.textContent = `📅 ${days} days to B2`;
  }
  function refreshDashboard(){
    const goal=store.get(K.goalDailyXP,30), xp=getXP();
    $('#goalVal') && ($('#goalVal').textContent = goal);
    $('#goalBadge') && ($('#goalBadge').textContent = `🎯 ${goal} xp/day`);
    $('#xpVal') && ($('#xpVal').textContent = xp);
    $('#xpBar') && ($('#xpBar').style.width = Math.min(100,Math.round(xp/goal*100))+'%');
    $('#streakBadge') && ($('#streakBadge').textContent = `🔥 Streak: ${calcStreak(goal)}`);
    $('#wkXp') && ($('#wkXp').textContent = weekXP());
    $('#sum14') && ($('#sum14').textContent = last14().reduce((a,b)=>a+b.xp,0));
    const ss = $('#saveStatus'); if(ss) ss.textContent = store.isPersistent()? '💾 saved' : '⚠️ memory';
  }
  function last14(){ const m=xpMap(); const t=new Date(); const days=[]; for(let i=13;i>=0;i--){ const d=addDays(t,-i); const k=d.toISOString().slice(0,10); days.push({k, xp:m[k]||0}); } return days; }
  function draw14(){
    const c = $('#chart14'); if(!c) return; const g=c.getContext('2d');
    const r=c.getBoundingClientRect(), dpr=window.devicePixelRatio||1; c.width=Math.floor(r.width*dpr); c.height=Math.floor(150*dpr);
    g.clearRect(0,0,c.width,c.height);
    const data=last14(), max=Math.max(30,...data.map(d=>d.xp),30), W=c.width,H=c.height,p=22, slot=(W-2*p)/data.length, bw=Math.max(6,slot*.6);
    g.fillStyle='#5aa2ff'; data.forEach((d,i)=>{ const h=(H-2*p)*(d.xp/max); const x=p+i*slot; g.fillRect(Math.round(x), Math.round(H-p-h), Math.round(bw), Math.round(h)); });
  }
  function initDashboard(){
    if(document.body.dataset.page!=='dashboard') return;
    refreshDashboard(); draw14(); refreshCountdown();
    window.addEventListener('resize', draw14);
    $$('button[data-xp]').forEach(b=> b.addEventListener('click', ()=> addXP(parseInt(b.dataset.xp,10)||5)));
    $('#resetDay')?.addEventListener('click', ()=>{ setXP(0); refreshDashboard(); draw14(); });
    $('#incGoal')?.addEventListener('click', ()=>{ store.set(K.goalDailyXP, store.get(K.goalDailyXP,30)+5); refreshDashboard(); });
    $('#decGoal')?.addEventListener('click', ()=>{ store.set(K.goalDailyXP, Math.max(10, store.get(K.goalDailyXP,30)-5)); refreshDashboard(); });
  }

  /* ---------- Comprehension ---------- */
  async function initComprehension(){
    if(document.body.dataset.page!=='comprehension') return;
    const fb=[{title:'Le vélo en ville', fr:"Aujourd’hui, la mairie a ouvert une nouvelle piste cyclable au centre-ville pour réduire la circulation et la pollution.", en:"Today, the city hall opened a new bike lane downtown to reduce traffic and pollution.", qs:["Pourquoi la mairie a-t-elle ouvert la piste ?"], ans:["Pour réduire la circulation et la pollution."]}];
    let articles = await fetchJSON('data/news.json', fb);
    let idx=0, showEN=false;
    function render(){
      const a = articles[idx%articles.length];
      $('#artTitle').textContent = a.title;
      $('#artBox').value = showEN ? a.en : a.fr;
      $('#toggleLang').textContent = showEN ? 'Show FR' : 'Show EN';
      $('#qa').innerHTML = `<ol class="small">${(a.qs||[]).map((q,i)=>`<li>${esc(q)} <details class="muted"><summary>Answer</summary>${esc((a.ans||[])[i]||'')}</details></li>`).join('')}</ol>`;
    }
    $('#prevArt')?.addEventListener('click', ()=>{ idx=(idx-1+articles.length)%articles.length; render(); });
    $('#nextArt')?.addEventListener('click', ()=>{ idx=(idx+1)%articles.length; render(); });
    $('#toggleLang')?.addEventListener('click', ()=>{ showEN=!showEN; render(); });
    $('#speakArt')?.addEventListener('click', ()=> speak($('#artBox').value, .95));
    $('#stopSpeakArt')?.addEventListener('click', ()=>{ try{ speechSynthesis.cancel(); }catch{} });
    $('#markCompXP')?.addEventListener('click', ()=> addXP(5));
    render();
  }

  /* ---------- Speaking ---------- */
  async function initSpeaking(){
    if(document.body.dataset.page!=='speaking') return;
    const fb={daily:["Décris ta routine du matin.","Parle de ta ville.","Quel est ton objectif cette semaine ?"]};
    const prompts = await fetchJSON('data/prompts.json', fb);
    const catSel = $('#promptCat');
    Object.keys(prompts).forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; catSel.appendChild(o); });
    function randomPrompt(cat){ const arr=prompts[cat]||Object.values(prompts)[0]||[]; return arr[Math.floor(Math.random()*arr.length)]||''; }
    function setPrompt(){ $('#promptBox').value = randomPrompt(catSel.value); }
    catSel.addEventListener('change', setPrompt);
    $('#newPrompt')?.addEventListener('click', setPrompt);
    $('#speakPrompt')?.addEventListener('click', ()=> speak($('#promptBox').value, 1));
    let rec=null;
    $('#askMic')?.addEventListener('click', async ()=>{
      try{ const s=await navigator.mediaDevices.getUserMedia({audio:true}); s.getTracks().forEach(t=>t.stop()); $('#micState').textContent='🎙️ Micro: granted'; }
      catch{ $('#micState').textContent='🎙️ Micro: blocked'; alert('Please allow microphone for github.io'); }
    });
    $('#startRec')?.addEventListener('click', ()=>{
      rec = startSR($('#speechOut'), st=> $('#recState').textContent='🗣️ State: '+st);
      if(rec) $('#stopRec').disabled=false;
    });
    $('#stopRec')?.addEventListener('click', ()=>{ try{rec&&rec.stop();}catch{} $('#stopRec').disabled=true; });
    $('#markSpeakXP')?.addEventListener('click', ()=> addXP(5));
    setPrompt();
  }

  /* ---------- Listening ---------- */
  async function initListening(){
    if(document.body.dataset.page!=='listening') return;
    const fb=[{text:"Pouvez-vous répéter plus lentement, s'il vous plaît ?", hint:"Demande polie"}];
    const dicts = await fetchJSON('data/dictation.json', fb);
    let i=0, last=null;
    function show(){ const d=dicts[i%dicts.length]; $('#dictationHint').textContent='Hint: '+(d.hint||''); $('#dictationTarget').textContent=d.text; $('#dictationInput').value=''; $('#dictationScore').textContent='Score: 0%'; }
    function play(d){ try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(d.text); u.lang='fr-FR'; u.rate=.95; last=u; speechSynthesis.speak(u);}catch{ alert('TTS not available'); } }
    $('#playDictation')?.addEventListener('click', ()=> play(dicts[i%dicts.length]));
    $('#replayDictation')?.addEventListener('click', ()=> last? speechSynthesis.speak(last) : play(dicts[i%dicts.length]));
    $('#nextDictation')?.addEventListener('click', ()=>{ i=(i+1)%dicts.length; show(); });
    $('#checkDictation')?.addEventListener('click', ()=>{
      const target = ($('#dictationTarget').textContent||'').toLowerCase();
      const guess  = ($('#dictationInput').value||'').toLowerCase();
      const A = target.replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/);
      const B = guess .replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/);
      const set=new Set(A); let match=0; B.forEach(w=> set.has(w)&&match++);
      const score = A.length? Math.round(match/A.length*100) : 0;
      $('#dictationScore').textContent = `Score: ${score}%`;
    });
    $('#markListenXP')?.addEventListener('click', ()=> addXP(5));
    show();
  }

  /* ---------- Vocabulary ---------- */
  function vocabList(){ return store.get(K.vocab,[]); }
  function setVocab(v){ store.set(K.vocab,v); }
  function dueCount(){ const today=fmt(todayKey()); return vocabList().filter(w=> w.due<=today).length; }
  function refreshVocabTable(){
    if(document.body.dataset.page!=='vocab') return;
    const tb = $('#vTable tbody'); const list=vocabList(); tb.innerHTML='';
    list.forEach(w=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${esc(w.fr)}</td><td>${esc(w.en)}</td><td class="small">${w.due}</td><td><button class="btn bad small" data-del="${w.id}">Del</button></td>`; tb.appendChild(tr); });
    tb.onclick = e=>{ const id=e.target.getAttribute('data-del'); if(!id) return; setVocab(vocabList().filter(x=>x.id!=id)); refreshVocabTable(); refreshVocabStats(); };
    refreshVocabStats();
  }
  function refreshVocabStats(){ $('#dueNow') && ($('#dueNow').textContent = dueCount()); $('#totalCards') && ($('#totalCards').textContent = vocabList().length); }
  function addWord(fr,en){ const id=Date.now()+Math.random(); const item={id,fr,en,ease:2.5,interval:0,reps:0,due:fmt(todayKey())}; setVocab([...vocabList(), item]); refreshVocabTable(); }
  function initVocab(){
    if(document.body.dataset.page!=='vocab') return;
    refreshVocabTable();
    $('#addWord')?.addEventListener('click', ()=>{ const fr=$('#vFr').value.trim(), en=$('#vEn').value.trim(); if(!fr||!en) return; addWord(fr,en); $('#vFr').value=''; $('#vEn').value=''; });
    $('#exportVocab')?.addEventListener('click', ()=>{
      try{ const blob=new Blob([JSON.stringify(vocabList(),null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='vocab.json'; a.click(); URL.revokeObjectURL(url); }
      catch{ alert('Export unavailable in this browser.'); }
    });
    $('#importVocab')?.addEventListener('change', e=>{
      const f=e.target.files?.[0]; if(!f) return; const r=new FileReader();
      r.onload=()=>{ try{ const arr=JSON.parse(r.result); if(Array.isArray(arr)){ setVocab(arr); refreshVocabTable(); } }catch{ alert('Invalid JSON'); } };
      r.readAsText(f);
    });
    $('#clearVocab')?.addEventListener('click', ()=>{ if(confirm('Delete all words?')){ setVocab([]); refreshVocabTable(); } });
    $('#startQuiz')?.addEventListener('click', startQuiz);
    $('#skipCard')?.addEventListener('click', serveNextCard);
    $('#revealA')?.addEventListener('click', ()=>{ if(!currentCard) return; $('#quizBack').textContent=currentCard.en; setRateBtns(false); $('#revealA').disabled=true; });
    $('#rateAgain')?.addEventListener('click', ()=> rateCard(0));
    $('#rateHard') ?.addEventListener('click', ()=> rateCard(2));
    $('#rateGood') ?.addEventListener('click', ()=> rateCard(3));
    $('#rateEasy') ?.addEventListener('click', ()=> rateCard(4));
    $('#markVocabXP')?.addEventListener('click', ()=> addXP(5));
  }
  let quizQueue=[], currentCard=null;
  function setRateBtns(dis){ ['rateAgain','rateHard','rateGood','rateEasy'].forEach(id=>{ const el=$('#'+id); if(el) el.disabled=dis; }); }
  function serveNextCard(){
    currentCard = quizQueue.shift();
    if(!currentCard){ $('#quizFront h2').textContent='All done 👏'; setRateBtns(true); $('#markVocabXP').disabled=false; $('#quizBack').textContent=''; return; }
    $('#quizFront h2').textContent=currentCard.fr;
    $('#quizBack').textContent=''; setRateBtns(true); $('#revealA').disabled=false;
  }
  function startQuiz(){
    const today=fmt(todayKey()); quizQueue = vocabList().filter(v=> v.due<=today);
    if(!quizQueue.length){ alert('No cards due. Add words or wait for due date.'); return; }
    serveNextCard();
  }
  function rateCard(grade){
    const c=currentCard; if(!c) return;
    if(grade<3){ c.reps=0; c.interval=1; c.ease=Math.max(1.3, c.ease-0.2); }
    else { c.reps+=1; if(c.reps===1) c.interval=1; else if(c.reps===2) c.interval=3; else c.interval=Math.round(c.interval*c.ease); c.ease=Math.min(3.0, c.ease+(grade===4?0.15:0)); }
    c.due = fmt(addDays(new Date(), c.interval));
    const list=vocabList(); const idx=list.findIndex(v=>v.id===c.id); if(idx>-1) list[idx]=c; setVocab(list);
    refreshVocabTable(); serveNextCard();
  }

  /* ---------- Phrases ---------- */
  async function initPhrases(){
    if(document.body.dataset.page!=='phrases') return;
    const fb=["Bonjour, comment ça va ?","Merci beaucoup !","Excusez-moi, où sont les toilettes ?","Je voudrais un café, s’il vous plaît.","Combien ça coûte ?","Pouvez-vous m’aider ?","Je ne comprends pas.","Je suis désolé(e).","C’est une bonne idée.","À demain !"];
    const phrases = await fetchJSON('data/phrases.json', fb);
    function pick10(){
      const seed = parseInt((store.get(K.phrasesSeed) ?? Date.now()).toString().slice(-6),10);
      const day  = parseInt(todayKey().replace(/-/g,''),10);
      const rand = n => (Math.abs(Math.sin(seed+day+n))*10000) % phrases.length | 0;
      const set=new Set(); while(set.size<10 && set.size<phrases.length) set.add(rand(set.size));
      return [...set].map(i=>phrases[i]);
    }
    function render(){
      const c=$('#phraseList'); c.innerHTML=''; pick10().forEach((p,i)=>{ const row=document.createElement('div'); row.className='row'; row.style.margin='6px 0'; const btn=document.createElement('button'); btn.className='btn'; btn.textContent='🔊'; btn.onclick=()=>speak(p,1); const span=document.createElement('span'); span.textContent=(i+1)+'. '+p; row.appendChild(btn); row.appendChild(span); c.appendChild(row); });
    }
    $('#refreshPhrases')?.addEventListener('click', ()=>{ store.set(K.phrasesSeed, Date.now()); render(); });
    $('#speakAllPhrases')?.addEventListener('click', ()=> pick10().forEach((p,i)=> setTimeout(()=>speak(p,1), i*1400)));
    $('#markPhrasesXP')?.addEventListener('click', ()=> addXP(5));
    render();
  }

  /* ---------- Goals ---------- */
  function initGoals(){
    if(document.body.dataset.page!=='goals') return;
    $('#dailyMinutes').value = store.get(K.dailyMinutes,40);
    $('#weeklyHours').value  = store.get(K.weeklyHours,8);
    $('#dailyXP').value      = store.get(K.goalDailyXP,30);
    $('#b2Target').value     = store.get(K.b2Target);
    const updCountdown = ()=>{ const t=new Date($('#b2Target').value||store.get(K.b2Target)); const days=Math.max(0,Math.ceil((t-new Date())/86400000)); $('#b2Countdown').textContent = `${days} days left`; };
    updCountdown();
    $('#saveDailyMinutes')?.addEventListener('click', ()=> store.set(K.dailyMinutes, Math.max(10, parseInt($('#dailyMinutes').value||40,10))));
    $('#saveWeeklyHours') ?.addEventListener('click', ()=> store.set(K.weeklyHours,  Math.max(1,  parseInt($('#weeklyHours').value||8,10))));
    $('#saveDailyXP')     ?.addEventListener('click', ()=>{ store.set(K.goalDailyXP, Math.max(10, parseInt($('#dailyXP').value||30,10))); });
    $('#saveTarget')      ?.addEventListener('click', ()=>{ const v=$('#b2Target').value; if(v){ store.set(K.b2Target, v); updCountdown(); }});
  }

  /* ---------- Calendar ---------- */
  function initCalendar(){
    if(document.body.dataset.page!=='calendar') return;
    const targetInput = $('#target-date'), setBtn=$('#setTarget'), container=$('#calendarContainer'), summary=$('#summary');
    const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYS=['Mo','Tu','We','Th','Fr','Sa','Su'];
    function getTarget(){ return new Date(store.get(K.calTarget) || store.get(K.b2Target)); }
    function getDone(){ return new Set(store.get(K.calDone,[])); }
    function saveDone(s){ store.set(K.calDone, Array.from(s)); }
    function renderCal(){
      const target=getTarget(); targetInput.value = target.toISOString().slice(0,10);
      const start = new Date(new Date().getFullYear(),0,1);
      const done = getDone();
      container.innerHTML='';
      const today = new Date();
      for(let m=0;m<12;m++){
        const head=document.createElement('div'); head.className='calMonth'; head.textContent = `${MONTHS[m]} ${target.getFullYear()}`; container.appendChild(head);
        const grid=document.createElement('div'); grid.className='calGrid';
        DAYS.forEach(d=>{ const h=document.createElement('div'); h.className='calCell calHead'; h.textContent=d; grid.appendChild(h); });
        const first = new Date(target.getFullYear(),m,1);
        const offset = (first.getDay()+6)%7;
        for(let i=0;i<offset;i++){ const e=document.createElement('div'); e.className='calCell'; e.style.visibility='hidden'; grid.appendChild(e); }
        const daysInMonth = new Date(target.getFullYear(),m+1,0).getDate();
        for(let d=1; d<=daysInMonth; d++){
          const cell=document.createElement('div'); cell.className='calCell';
          const dateObj=new Date(target.getFullYear(),m,d);
          const iso=dateObj.toISOString().slice(0,10);
          cell.textContent=d;
          if(iso === today.toISOString().slice(0,10)) cell.classList.add('today');
          if(dateObj>today) cell.classList.add('future'); else {
            cell.addEventListener('click', ()=>{
              if(cell.classList.toggle('done')) { done.add(iso); } else { done.delete(iso); }
              saveDone(done); updateSummary();
            });
          }
          if(done.has(iso)) cell.classList.add('done');
          grid.appendChild(cell);
        }
        container.appendChild(grid);
      }
      updateSummary();
    }
    function updateSummary(){
      const target=getTarget(), done=getDone();
      const start = new Date(new Date().getFullYear(),0,1);
      const totalDays = Math.floor((target-start)/86400000)+1;
      const daysLeft  = Math.max(0, Math.ceil((target - new Date())/86400000));
      summary.textContent = `Studied: ${done.size} • Days left: ${daysLeft} • Year total: ${totalDays}`;
    }
    setBtn.addEventListener('click', ()=>{ const v=targetInput.value; if(v){ store.set(K.calTarget,v); renderCal(); }});
    if(!store.get(K.calTarget)) store.set(K.calTarget, store.get(K.b2Target));
    renderCal();
  }

  /* ---------- Data backup ---------- */
  function initData(){
    if(document.body.dataset.page!=='data') return;
    $('#exportData')?.addEventListener('click', ()=>{
      const data={};
      [K.goalDailyXP,K.xpByDay,K.flagsByDay,K.dailyMinutes,K.weeklyHours,K.b2Target,K.phrasesSeed,K.vocab,K.calTarget,K.calDone]
        .forEach(k=>data[k]=store.get(k));
      try{ const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='french_b2_journey_backup.json'; a.click(); URL.revokeObjectURL(url); }
      catch{ alert('Export unavailable.'); }
    });
    $('#importData')?.addEventListener('change', e=>{
      const f=e.target.files?.[0]; if(!f) return; const r=new FileReader();
      r.onload=()=>{ try{ const obj=JSON.parse(r.result); Object.entries(obj).forEach(([k,v])=>store.set(k,v)); alert('Import OK — reloading'); location.reload(); }catch{ alert('Invalid JSON'); } };
      r.readAsText(f);
    });
    $('#factoryReset')?.addEventListener('click', ()=>{ if(confirm('Erase all data?')){ store.clear(); location.reload(); }});
  }

  /* ---------- JSON helper with fallback ---------- */
  async function fetchJSON(path, fallback){
    try{ const r=await fetch(path,{cache:'no-store'}); if(!r.ok) throw 0; return await r.json(); }
    catch{ return fallback; }
  }

  /* ---------- boot ---------- */
  function highlightNav(){
    const page = document.body.dataset.page || '';
    $$('.nav a').forEach(a=> a.classList.toggle('active', a.getAttribute('href').includes(page)|| (page==='dashboard'&&a.getAttribute('href').includes('index'))));
  }
  function boot(){
    highlightNav();
    initDashboard(); initComprehension(); initSpeaking(); initListening();
    initVocab(); initPhrases(); initGoals(); initCalendar(); initData();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
