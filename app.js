/* French B2 Journey — Unified app.js
   - Vocabulary: randomized flashcards, “Next”, conjugation + examples on Show/Reveal, 500+ loader
   - Listening: Daily Set, News briefing (TTS), Practice Bank; shows CORRECT sentence after Check; saves progress
   - Comprehension: Sentence flashcards + light MCQ/etc.
   - Robust guards (won’t crash if elements missing)
*/
(() => {
  // ---------- helpers ----------
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const today=()=>new Date().toISOString().slice(0,10);
  const addDays=(d,n)=>{const x=new Date(d); x.setDate(x.getDate()+n); return x;};
  const fmt=d=>new Date(d).toISOString().slice(0,10);
  const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const shuffle=a=>{const x=a.slice(); for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [x[i],x[j]]=[x[j],x[i]];} return x;};
  const words=t=>(t||'').trim().split(/\s+/).filter(Boolean);

  // ---------- storage ----------
  const store=(()=>{let p=true,mem={};try{localStorage.setItem('__t','1');localStorage.removeItem('__t');}catch{p=false}
    const get=(k,d)=>{try{if(p){const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}}catch{p=false}return k in mem?mem[k]:d};
    const set=(k,v)=>{try{if(p){localStorage.setItem(k,JSON.stringify(v));return true}}catch{p=false}mem[k]=v;return false};
    return {get,set,isPersistent:()=>p};
  })();

  // ---------- keys & defaults ----------
  const K={
    goal:'fj_goal_xp', xp:'fj_xp_by_day', aw:'fj_awards_by_day', b2:'fj_b2_target',
    vocab:'fj_vocab', compDeck:'fj_comp_deck',
    listenProg:'fj_listen_prog', vocabProg:'fj_vocab_prog'
  };
  if(store.get(K.goal)==null) store.set(K.goal,30);
  if(store.get(K.xp)==null)   store.set(K.xp,{});
  if(store.get(K.aw)==null)   store.set(K.aw,{});
  if(store.get(K.b2)==null)   store.set(K.b2,new Date(new Date().getFullYear(),11,31).toISOString().slice(0,10));
  if(store.get(K.vocab)==null)store.set(K.vocab,[]);

  // ---------- XP / awards / per-day logs ----------
  const xpMap=()=>store.get(K.xp,{}), awMap=()=>store.get(K.aw,{});
  const getXP=(d=today())=>xpMap()[d]||0;
  const setXP=(v,d=today())=>{const m=xpMap();m[d]=v;store.set(K.xp,m);};
  function award(tag,amount=5,limit=Infinity){const d=today(); const a=awMap(); a[d]=a[d]||{}; a[d][tag]=a[d][tag]||0; if(a[d][tag]>=limit) return; setXP(getXP(d)+amount,d); a[d][tag]+=1; store.set(K.aw,a);}
  function logListen(fn){ const d=today(); const p=store.get(K.listenProg,{}); p[d]=p[d]||{done:0, best:0, avg:0, total:0, news:0, minutes:0}; fn(p[d]); store.set(K.listenProg,p); }
  function logVocab(fn){ const d=today(); const p=store.get(K.vocabProg,{}); p[d]=p[d]||{reviews:0, know:0, dk:0}; fn(p[d]); store.set(K.vocabProg,p); }

  // ---------- TTS ----------
  let frVoice=null; try{speechSynthesis.onvoiceschanged=()=>{const vs=speechSynthesis.getVoices(); frVoice=vs.find(v=>/^fr/i.test(v.lang))||null;};}catch{}
  function speakOne(text,rate=1){try{const u=new SpeechSynthesisUtterance(text);u.lang='fr-FR';u.rate=rate;if(frVoice)u.voice=frVoice;speechSynthesis.speak(u);return u;}catch{return null}}
  let q=[], playing=false, stopFlag=false;
  function playQueue(list,rate=1,interval=800,doneCb){ stopQueue(); q=list.slice(); stopFlag=false; function next(){ if(stopFlag||!q.length){ playing=false; doneCb&&doneCb(); return; } const t=q.shift(); const u=speakOne(t,rate); playing=true; if(!u){playing=false;return;} u.onend=()=>{ if(stopFlag){playing=false;return;} setTimeout(next,interval); }; u.onerror=()=>setTimeout(next,interval); } next(); }
  function stopQueue(){try{stopFlag=true; speechSynthesis.cancel();}catch{} playing=false; q.length=0;}

  // ---------- fetch JSON ----------
  async function fetchJSON(path,fb){try{const r=await fetch(path,{cache:'no-store'}); if(!r.ok) throw 0; return await r.json();}catch{return fb}}

  // ======================================================================
  // VOCABULARY (SRS + conjugation + examples)
  // ======================================================================
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

  // --- Conjugation & example generator ---
  const IRR = {
    "être":  ["je suis","tu es","il/elle est","nous sommes","vous êtes","ils/elles sont"],
    "avoir": ["j’ai","tu as","il/elle a","nous avons","vous avez","ils/elles ont"],
    "aller": ["je vais","tu vas","il/elle va","nous allons","vous allez","ils/elles vont"],
    "faire": ["je fais","tu fais","il/elle fait","nous faisons","vous faites","ils/elles font"],
    "venir": ["je viens","tu viens","il/elle vient","nous venons","vous venez","ils/elles viennent"],
    "pouvoir":["je peux","tu peux","il/elle peut","nous pouvons","vous pouvez","ils/elles peuvent"],
    "devoir": ["je dois","tu dois","il/elle doit","nous devons","vous devez","ils/elles doivent"],
    "vouloir":["je veux","tu veux","il/elle veut","nous voulons","vous voulez","ils/elles veulent"],
    "prendre":["je prends","tu prends","il/elle prend","nous prenons","vous prenez","ils/elles prennent"],
    "mettre": ["je mets","tu mets","il/elle met","nous mettons","vous mettez","ils/elles mettent"],
    "dire":   ["je dis","tu dis","il/elle dit","nous disons","vous dites","ils/elles disent"],
    "voir":   ["je vois","tu vois","il/elle voit","nous voyons","vous voyez","ils/elles voient"],
    "savoir": ["je sais","tu sais","il/elle sait","nous savons","vous savez","ils/elles savent"]
  };
  const PRON = ["je","tu","il/elle","nous","vous","ils/elles"];
  function startsVowel(h){return /^[aeiouyhâàéèêëîïôöùûüœAEIOUYH]/.test(h||"");}
  function stripReflexive(fr){ return fr.replace(/^s['’]\s*/i,'').replace(/^se\s+/i,'').trim(); }
  function baseFromEntry(fr){
    const token = fr.split(/\s+/)[0].toLowerCase();
    const reflexive = /^s['’]?|^se\s+/i.test(fr);
    let base = reflexive ? stripReflexive(fr) : token;
    base = base.replace(/[()]/g,'');
    if(/(er|ir|re)$/i.test(base)) return {base,reflexive};
    return null;
  }
  function conjRegular(base){
    if(base.endsWith('er')){
      const stem=base.slice(0,-2);
      const je = (startsVowel(stem) ? "j’" : "je ") + stem + "e";
      return [je, stem+"es", stem+"e", stem+"ons", stem+"ez", stem+"ent"];
    }
    if(base.endsWith('ir')){
      const stem=base.slice(0,-2);
      return ["je "+stem+"is","tu "+stem+"is","il/elle "+stem+"it","nous "+stem+"issons","vous "+stem+"issez","ils/elles "+stem+"issent"];
    }
    if(base.endsWith('re')){
      const stem=base.slice(0,-2);
      return ["je "+stem+"s","tu "+stem+"s","il/elle "+stem,"nous "+stem+"ons","vous "+stem+"ez","ils/elles "+stem+"ent"];
    }
    return null;
  }
  function applyReflexive(rows){
    const pro = ["me","te","se","nous","vous","se"];
    return rows.map((form,i)=>{
      if(form.startsWith("j’")) return "je "+pro[i]+" "+form.slice(2);
      if(form.startsWith("je ")) return "je "+pro[i]+" "+form.slice(3);
      if(form.startsWith("tu ")) return "tu "+pro[i]+" "+form.slice(3);
      if(form.startsWith("il/elle ")) return "il/elle "+pro[i]+" "+form.slice(8);
      if(form.startsWith("nous ")) return "nous "+pro[i]+" "+form.slice(5);
      if(form.startsWith("vous ")) return "vous "+pro[i]+" "+form.slice(5);
      if(form.startsWith("ils/elles ")) return "ils/elles "+pro[i]+" "+form.slice(10);
      return pro[i]+" "+form;
    }).map(r=>r.replace(/^je ([aeiouy])/i,"j’$1").replace(/^je me ([aeiouy])/i,"je m’$1").replace(/^je te ([aeiouy])/i,"je t’$1"));
  }
  function conjPresent(fr){
    const info = baseFromEntry(fr);
    if(!info) return null;
    const {base,reflexive} = info;
    let rows = IRR[base] || conjRegular(base);
    if(!rows) return null;
    if(reflexive) rows = applyReflexive(rows);
    return rows;
  }
  function conjTableHTML(fr){
    const rows = conjPresent(fr);
    if(!rows) return '';
    const cells = rows.map((f,i)=>`<tr><td class="small" style="opacity:.8">${PRON[i]}</td><td>${esc(f)}</td></tr>`).join('');
    return `<h4 style="margin:.6rem 0 .3rem">Présent</h4>
            <div class="tableWrap"><table><tbody>${cells}</tbody></table></div>`;
  }
  function exampleFor(fr,en){
    const info = baseFromEntry(fr);
    if(info){ // verb
      const forms = conjPresent(fr); if(!forms) return '';
      const je=forms[0], nous=forms[3];
      const fr1 = `${je} souvent.`; const fr2 = `${nous} maintenant.`;
      const en1 = `I ${en.replace(/^to\s+/,'')} often.`; const en2 = `We ${en.replace(/^to\s+/,'')} now.`;
      return `<h4 style="margin:.6rem 0 .3rem">Exemples</h4>
              <div class="small">• ${esc(fr1)} <span class="muted">(${esc(en1)})</span></div>
              <div class="small">• ${esc(fr2)} <span class="muted">(${esc(en2)})</span></div>`;
    }
    const hasArticle = /^(le|la|les|l’|un|une|des|du|de la|de l’)\b/i.test(fr);
    const frN = hasArticle ? fr : `le/la ${fr}`;
    const fr1 = `J’ai besoin de ${frN}.`; const fr2 = `C’est ${frN}.`;
    const en1 = `I need ${en}.`;          const en2 = `It is ${en}.`;
    return `<h4 style="margin:.6rem 0 .3rem">Exemples</h4>
            <div class="small">• ${esc(fr1)} <span class="muted">(${esc(en1)})</span></div>
            <div class="small">• ${esc(fr2)} <span class="muted">(${esc(en2)})</span></div>`;
  }
  function buildDetailsHTML(fr,en){
    const conj = conjTableHTML(fr);
    const ex = exampleFor(fr,en);
    return `${conj}${ex}`;
  }

  // --- Vocab page wiring ---
  function statsV(){ if(document.body.dataset.page!=='vocab')return; $('#dueNow')&&($('#dueNow').textContent=dueCount()); $('#totalCards')&&($('#totalCards').textContent=deck().length); }
  function renderTable(){
    if(document.body.dataset.page!=='vocab')return; const tb=$('#vTable tbody'); if(!tb)return;
    tb.innerHTML='';
    deck().forEach(w=>{const tr=document.createElement('tr'); tr.innerHTML=`<td>${esc(w.fr)}</td><td>${esc(w.en)}</td><td class="small">${w.due}</td><td>${w.leech||0}</td><td><button class="btn bad small" data-del="${w.id}">Del</button></td>`; tb.appendChild(tr);});
    tb.onclick=e=>{const id=e.target.getAttribute('data-del'); if(!id) return; saveDeck(deck().filter(x=>x.id!=id)); renderTable(); statsV();};
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
    if(document.body.dataset.page!=='vocab') return;
    const front=$('#qr-front'), back=$('#qr-back'), info=$('#qr-info'), extra=$('#qr-extra');
    if(!front||!back||!info) return;
    qrQ = qrQueue(); qrCur = qrQ.shift();
    if(!qrCur){ front.textContent='No cards'; back.style.display='none'; info.textContent='Due: 0'; if(extra) extra.innerHTML=''; return; }
    front.textContent=qrCur.fr; back.textContent=qrCur.en; back.style.display='none'; info.textContent=`Due: ${dueCount()} • Leech: ${qrCur.leech||0}`; if(extra) extra.innerHTML='';
  }

  async function initVocab(){
    if(document.body.dataset.page!=='vocab') return;
    await maybeSeedVocab();
    renderTable(); statsV(); qrServe();

    // CRUD & deck ops
    $('#addWord')?.addEventListener('click',()=>{const fr=$('#vFr').value.trim(),en=$('#vEn').value.trim(); if(!fr||!en)return; addCard(fr,en); $('#vFr').value=''; $('#vEn').value=''; renderTable(); statsV();});
    $('#exportVocab')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(deck(),null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='vocab.json'; a.click(); URL.revokeObjectURL(url);});
    $('#importVocab')?.addEventListener('change',e=>{const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{try{const d=JSON.parse(r.result); if(Array.isArray(d)) saveDeck(d); else if(Array.isArray(d.pairs)){ const now=today(); saveDeck(d.pairs.map((ln,i)=>{const [fr,en]=ln.split('|').map(s=>s.trim()); return {id:Date.now()+i+Math.random(),fr,en,ease:2.5,interval:0,reps:0,leech:0,due:now};})); } renderTable(); statsV(); qrServe(); }catch{alert('Invalid JSON')}}; r.readAsText(f);});
    $('#clearVocab')?.addEventListener('click',()=>{ if(confirm('Delete all words?')){ saveDeck([]); renderTable(); statsV(); qrServe(); } });
    $('#loadStarter')?.addEventListener('click',async()=>{ if(!confirm('Replace your current deck with the 500+ starter deck?')) return;
      const data=await fetchJSON('data/vocab.json',{pairs:[]}); if(Array.isArray(data.pairs)&&data.pairs.length){ const now=today(); const seeded=data.pairs.map((ln,i)=>{const [fr,en]=ln.split('|').map(s=>s.trim()); return {id:Date.now()+i+Math.random(),fr,en,ease:2.5,interval:0,reps:0,leech:0,due:now};}); saveDeck(seeded); renderTable(); statsV(); qrServe(); alert(`Loaded ${seeded.length} cards.`); }
      else alert('Could not load starter deck.');
    });

    // Classic Review session
    let Q=[], cur=null;
    function serve(){ const front=$('#quizFront h2'), back=$('#quizBack'), extra=$('#quizExtra');
      if(!front||!back) return;
      cur=Q.shift(); if(!cur){ front.textContent='All done 👏'; ['rateAgain','rateHard','rateGood','rateEasy'].forEach(id=>$('#'+id)?.setAttribute('disabled','')); back.textContent=''; if(extra) extra.innerHTML=''; award('vocabSession',5,2); return; }
      front.textContent=cur.fr; back.textContent=''; if(extra) extra.innerHTML=''; ['rateAgain','rateHard','rateGood','rateEasy'].forEach(id=>$('#'+id)?.setAttribute('disabled','')); $('#revealA')?.removeAttribute('disabled');
    }
    $('#startQuiz')?.addEventListener('click',()=>{const t=today(); Q=shuffle(deck().filter(w=>w.due<=t)); if(!Q.length){alert('No cards due.');return} serve();});
    $('#nextCard')?.addEventListener('click',serve);
    $('#revealA')?.addEventListener('click',()=>{ if(!cur)return; const back=$('#quizBack'), extra=$('#quizExtra'); back.textContent=cur.en; ['rateAgain','rateHard','rateGood','rateEasy'].forEach(id=>$('#'+id)?.removeAttribute('disabled')); $('#revealA')?.setAttribute('disabled',''); if(extra) extra.innerHTML = buildDetailsHTML(cur.fr, cur.en); });
    function rate(g){ const list=deck(); const i=list.findIndex(x=>x.id===cur.id); if(i>-1){ srsRate(list[i],g); saveDeck(list); } renderTable(); statsV(); serve(); }
    $('#rateAgain')?.addEventListener('click',()=>{rate(0); logVocab(s=>{s.reviews++; s.dk++;});});
    $('#rateHard') ?.addEventListener('click',()=>{rate(2); logVocab(s=>{s.reviews++; s.dk++;});});
    $('#rateGood') ?.addEventListener('click',()=>{rate(3); logVocab(s=>{s.reviews++; s.know++;});});
    $('#rateEasy') ?.addEventListener('click',()=>{rate(4); logVocab(s=>{s.reviews++; s.know++;});});

    // Quick Review controls (also logs progress)
    $('#qr-show')?.addEventListener('click',()=>{ const back=$('#qr-back'), extra=$('#qr-extra'); if(!qrCur||!back)return; back.style.display='block'; if(extra) extra.innerHTML = buildDetailsHTML(qrCur.fr, qrCur.en); });
    $('#qr-speak')?.addEventListener('click',()=>{ const t=$('#qr-front')?.textContent||''; speakOne(t,1); });
    $('#qr-next') ?.addEventListener('click',()=>{ qrServe(); });
    $('#qr-dk')   ?.addEventListener('click',()=>{ if(!qrCur)return; const list=deck(); const i=list.findIndex(x=>x.id===qrCur.id); if(i>-1){ list[i].leech=(list[i].leech||0)+1; list[i].ease=Math.max(1.3,(list[i].ease||2.5)-0.4); list[i].interval=1; list[i].due=fmt(addDays(new Date(),1)); saveDeck(list);} logVocab(s=>{s.reviews++; s.dk++;}); award('vocabSession',5,2); qrServe(); renderTable(); statsV(); });
    $('#qr-know') ?.addEventListener('click',()=>{ if(!qrCur)return; const list=deck(); const i=list.findIndex(x=>x.id===qrCur.id); if(i>-1){ srsRate(list[i],4); saveDeck(list);} logVocab(s=>{s.reviews++; s.know++;}); award('vocabSession',5,2); qrServe(); renderTable(); statsV(); });
  }

  // ======================================================================
  // COMPREHENSION — Sentence flashcards + light modes
  // ======================================================================
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
    const front=$('#cf-front'), back=$('#cf-back'), info=$('#cf-info');
    if(!front||!back||!info) return;
    cfQ = cfQueue(); cfCur = cfQ.shift();
    if(!cfCur){ front.textContent='No sentences'; back.style.display='none'; info.textContent='Due: 0'; return; }
    front.textContent=cfCur.fr; back.textContent=cfCur.en; back.style.display='none';
    info.textContent=`Due: ${compDeck().filter(w=>w.due<=today()).length} • Leech: ${cfCur.leech||0}`;
  }
  function compRate(card,grade){
    if(grade<3){card.reps=0; card.interval=1; card.ease=Math.max(1.3,(card.ease||2.5)-0.2); card.leech=(card.leech||0)+1;}
    else{card.reps=(card.reps||0)+1; if(card.reps===1) card.interval=1; else if(card.reps===2) card.interval=3; else card.interval=Math.round((card.interval||1)*(card.ease||2.5)); card.ease=Math.min(3.2,(card.ease||2.5)+(grade===4?0.15:0));}
    card.due=fmt(addDays(new Date(),card.interval||1));
  }
  function initCompFlashcards(){
    if(document.body.dataset.page!=='comprehension') return;
    maybeSeedComp().then(()=> cfServe());
    $('#cf-show')?.addEventListener('click',()=>{ $('#cf-back')?.style.setProperty('display','block'); });
    $('#cf-speak')?.addEventListener('click',()=>{ speakOne($('#cf-front')?.textContent||'',1); });
    $('#cf-next') ?.addEventListener('click',()=> cfServe());
    $('#cf-dk')   ?.addEventListener('click',()=>{ if(!cfCur)return; const list=compDeck(); const i=list.findIndex(x=>x.id===cfCur.id); if(i>-1){ list[i].leech=(list[i].leech||0)+1; list[i].ease=Math.max(1.3,(list[i].ease||2.5)-0.4); list[i].interval=1; list[i].due=fmt(addDays(new Date(),1)); saveCompDeck(list);} award('compDone',5,2); cfServe(); });
    $('#cf-know') ?.addEventListener('click',()=>{ if(!cfCur)return; const list=compDeck(); const i=list.findIndex(x=>x.id===cfCur.id); if(i>-1){ compRate(list[i],4); saveCompDeck(list);} award('compDone',5,2); cfServe(); });
  }

  // Light comprehension modes (keep basic)
  async function initComprehensionModes(){
    if(document.body.dataset.page!=='comprehension')return;
    const fb=[{type:'mcq',title:'Transports propres',level:'B1',fr:'La ville investit dans les bus électriques pour réduire la pollution.',en:'The city invests in electric buses to reduce pollution.',options:['Pour attirer les touristes.','Pour réduire la pollution.','Pour baisser les prix.'],answer:1}];
    const data=await fetchJSON('data/news.json',fb);
    const items=Array.isArray(data)&&data.length?data:fb;
    const tabs=$$('.tabs .tab'); const panes={mcq:$('#pane-mcq'),cloze:$('#pane-cloze'),sa:$('#pane-sa'),tf:$('#pane-tf')};
    tabs.forEach(t=>t.onclick=()=>{tabs.forEach(x=>x.classList.remove('active')); t.classList.add('active'); Object.values(panes).forEach(p=>p&&(p.style.display='none')); panes[t.dataset.t]&& (panes[t.dataset.t].style.display='');});
    // MCQ minimal
    let mi=0, mcqEN=false;
    function renderMCQ(){const it=items.filter(x=>x.type==='mcq'); if(!it.length)return; const a=it[mi%it.length]; $('#mcqTitle')&&($('#mcqTitle').textContent=`${a.title} · ${a.level}`); $('#mcqText')&&($('#mcqText').value=(mcqEN?a.en:a.fr)||''); const box=$('#mcqOptions'); if(!box)return; box.innerHTML=''; (a.options||[]).forEach((opt,i)=>{const b=document.createElement('button'); b.className='btn'; b.textContent=opt; b.onclick=()=>{const ok=i==a.answer; $('#mcqResult')&&($('#mcqResult').textContent=ok?'✅ Correct':'❌ Incorrect'); if(ok) award('compDone',5,2);}; box.appendChild(b);});}
    $('#mcqLang')?.addEventListener('click',()=>{mcqEN=!mcqEN;renderMCQ();}); $('#mcqNext')?.addEventListener('click',()=>{mi++;renderMCQ();}); $('#mcqSpeak')?.addEventListener('click',()=>speakOne($('#mcqText')?.value||'',.95)); renderMCQ();
  }

  // ======================================================================
  // LISTENING — Daily, News, Bank (show CORRECT text after Check)
  // ======================================================================
  async function initListening(){
    if(document.body.dataset.page!=='listening') return;

    // Tabs
    const tabs=$$('.tabs .tab'); const panes={daily:$('#pane-daily'),news:$('#pane-news'),bank:$('#pane-bank')};
    tabs.forEach(t=>t.onclick=()=>{tabs.forEach(x=>x.classList.remove('active')); t.classList.add('active'); Object.values(panes).forEach(p=>p&&(p.style.display='none')); panes[t.dataset.t]&&(panes[t.dataset.t].style.display='');});

    // Data
    const fbItems={items:[{id:1,level:'A2',hint:'fallback',text:"Pouvez-vous répéter plus lentement, s’il vous plaît ?"}]};
    const EX=await fetchJSON('data/listening_exercises.json',fbItems);
    const items = Array.isArray(EX.items)&&EX.items.length? EX.items : fbItems.items;

    const nfb={france:["À Paris, de nouvelles pistes cyclables sont ouvertes pour faciliter la mobilité douce."],
               world:["Des vagues de chaleur touchent plusieurs pays; les autorités recommandent de s’hydrater."],
               economy:["L’inflation se stabilise tandis que la demande intérieure reste contrastée."],
               tech:["Les innovations en IA générative s’accélèrent, avec un accent sur l’éthique."],
               sport:["Les championnats reprennent ce week-end avec des affiches attendues."],
               culture:["La saison des festivals met en lumière de jeunes artistes."]};
    const NEWS=await fetchJSON('data/news_summaries.json',nfb);

    // Daily (3 items, deterministic)
    function dailyPick(){
      const seed=parseInt(today().replace(/-/g,''),10);
      const idxs=new Set(); let i=0;
      while(idxs.size<3 && idxs.size<items.length){ idxs.add((Math.abs(Math.sin(seed+i))*10000|0)%items.length); i++; }
      return [...idxs].map(i=>items[i]);
    }
    function renderDaily(){
      const wrap=$('#dailyWrap'); if(!wrap) return; wrap.innerHTML='';
      const pick=dailyPick();
      pick.forEach((it,ix)=>{
        const block=document.createElement('div'); block.className='card'; block.style.margin='0 0 .8rem';
        block.innerHTML=`
          <div class="row wrap">
            <h3 class="grow">${ix+1}. [${it.level}]</h3>
            <button class="btn play">🔊 Play</button>
            <button class="btn replay">↻ Replay</button>
          </div>
          <div class="row small"><span class="pill hint">${esc(it.hint||'Hint')}</span></div>
          <textarea class="input mono ans" rows="3" placeholder="Type what you hear…"></textarea>
          <div class="row">
            <button class="btn check">Check</button>
            <span class="pill score">Score: 0%</span>
          </div>
          <div class="small muted correct"></div>
        `;
        const play=block.querySelector('.play'), rep=block.querySelector('.replay'), ans=block.querySelector('.ans'), chk=block.querySelector('.check'), sc=block.querySelector('.score'), corr=block.querySelector('.correct');
        let last=null; play.onclick=()=>{ try{speechSynthesis.cancel(); last=speakOne(it.text,.98);}catch{} };
        rep.onclick=()=>{ try{ last ? speechSynthesis.speak(last) : play.onclick(); }catch{} };
        chk.onclick=()=>{ const tgt=(it.text||'').toLowerCase(); const g=(ans.value||'').toLowerCase();
          const A=tgt.replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/), B=g.replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/);
          const set=new Set(A); let m=0; B.forEach(w=>set.has(w)&&m++); const score=A.length?Math.round(m/A.length*100):0; sc.textContent=`Score: ${score}%`;
          corr.innerHTML = `<b>Correct:</b> ${esc(it.text)}`;
          logListen(p=>{ p.done = Math.min(3, p.done+1); p.total += score; p.best = Math.max(p.best, score); p.avg = Math.round(p.total/Math.max(1,p.done)); });
          updateDailyBadges();
          if(score>=60) award('listenTask',5,2);
        };
        wrap.appendChild(block);
      });
      updateDailyBadges();
    }
    function updateDailyBadges(){
      const d=store.get(K.listenProg,{})[today()]||{done:0,avg:0};
      $('#dailyProgress')&&($('#dailyProgress').textContent = `Completed: ${d.done||0}/3`);
      $('#dailyAvg')&&($('#dailyAvg').textContent = `Avg score: ${d.avg||0}%`);
    }
    $('#dailyRefresh')?.addEventListener('click',renderDaily);

    // News
    function getBriefing(topic){
      const arr=NEWS[topic]||NEWS.france||[];
      const idx=(parseInt(today().replace(/-/g,''),10)+arr.length)%Math.max(1,arr.length);
      const lines = [arr[idx], arr[(idx+1)%arr.length]].filter(Boolean);
      return lines;
    }
    $('#newsPlayAll')?.addEventListener('click',()=>{
      const t=$('#newsTopic')?.value||'france'; const lines=getBriefing(t);
      $('#newsTranscript')&&($('#newsTranscript').value = lines.join('\n\n'));
      const minutesEst = Math.max(1, Math.round(words(lines.join(' ')).length/150));
      playQueue(lines,.98,600,()=>{ logListen(p=>{ p.news=1; p.minutes += minutesEst; }); award('listenTask',5,2); });
    });
    $('#newsStop')?.addEventListener('click',()=>stopQueue());

    // Bank
    let bankIdx=0, bankList=items.slice();
    function ensureBankCorrectNode(){
      let c=$('#bankCorrect');
      if(!c){ c=document.createElement('div'); c.id='bankCorrect'; c.className='small muted'; const anchor=$('#bankScore')||$('#bankInput'); anchor?.parentNode?.insertBefore(c, anchor.nextSibling); }
      return c;
    }
    function filterBank(){
      const lvl=$('#bankLevel')?.value||'all';
      bankList = lvl==='all'? items.slice() : items.filter(x=>x.level===lvl);
      bankIdx=0; renderBank();
    }
    function renderBank(){
      const c=ensureBankCorrectNode();
      if(!bankList.length){ $('#bankHint')&&($('#bankHint').textContent='No items'); $('#bankInput')&&($('#bankInput').value=''); $('#bankScore')&&($('#bankScore').textContent='Score: 0%'); if(c) c.textContent=''; return; }
      const it = bankList[bankIdx%bankList.length];
      $('#bankHint')&&($('#bankHint').textContent = `Hint: ${it.hint||''} • [${it.level}]`);
      $('#bankInput')&&($('#bankInput').value=''); $('#bankScore')&&($('#bankScore').textContent='Score: 0%'); if(c) c.textContent='';
    }
    $('#bankLevel')?.addEventListener('change',filterBank);
    $('#bankNext') ?.addEventListener('click',()=>{ bankIdx=(bankIdx+1)%Math.max(1,bankList.length); renderBank(); });
    $('#bankPlay') ?.addEventListener('click',()=>{ const it=bankList[bankIdx%bankList.length]; speakOne(it.text,.98); });
    $('#bankReplay')?.addEventListener('click',()=>$('#bankPlay')?.click());
    $('#bankCheck') ?.addEventListener('click',()=>{
      const it=bankList[bankIdx%bankList.length]; const corr=ensureBankCorrectNode();
      const tgt=(it.text||'').toLowerCase(); const g=($('#bankInput')?.value||'').toLowerCase();
      const A=tgt.replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/), B=g.replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/);
      const set=new Set(A); let m=0; B.forEach(w=>set.has(w)&&m++); const score=A.length?Math.round(m/A.length*100):0;
      $('#bankScore')&&($('#bankScore').textContent=`Score: ${score}%`);
      corr && (corr.innerHTML = `<b>Correct:</b> ${esc(it.text)}`);
      logListen(p=>{ p.total += score; p.done = Math.min(3, Math.max(p.done,1)); p.best = Math.max(p.best,score); p.avg = Math.round(p.total/Math.max(1,p.done)); });
      updateDailyBadges();
      if(score>=60) award('listenTask',5,2);
    });

    // Boot listening UI
    renderDaily(); filterBank();
  }

  // ======================================================================
  // BOOT
  // ======================================================================
  function boot(){
    const page=document.body.dataset.page||'';
    // init modules safely (they no-op on other pages)
    initVocab();
    initCompFlashcards();
    initComprehensionModes();
    initListening();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();



// ======================================================================
// Dashboard, Goals, Phrases, Speaking, Calendar, Data — Quick Wins
// ======================================================================
(function(){
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const $=(s,r=document)=>r.querySelector(s);
  const today=()=>new Date().toISOString().slice(0,10);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

  // Keys (extend existing K if present)
  const K2 = (typeof K!=='undefined') ? K : {};
  K2.speakProg = K2.speakProg || 'fj_speak_prog';
  K2.phrDone   = K2.phrDone   || 'fj_phr_done';

  // Safe store wrapper (use existing store if defined)
  const store2 = (typeof store!=='undefined') ? store : {
    get:(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}},
    set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
  };

  // Helpers to read existing maps
  const xpMap = ()=> store2.get(K2.xp,{});
  const awMap = ()=> store2.get(K2.aw,{});
  const goalXP= ()=> Number(store2.get(K2.goal,30));
  const setGoalXP=v=> store2.set(K2.goal, Number(v)||30);
  const b2Date = ()=> store2.get(K2.b2, new Date(new Date().getFullYear(),11,31).toISOString().slice(0,10));

  // Compute last N day series
  function lastNDays(n){
    const out=[]; const m=xpMap();
    for(let i=n-1;i>=0;i--){
      const d=new Date(); d.setDate(d.getDate()-i);
      const key=d.toISOString().slice(0,10);
      out.push({d:key, xp: m[key]||0});
    }
    return out;
  }

  // Compute streak based on meeting goalXP
  function calcStreak(){
    const g=goalXP();
    let streak=0;
    for(let i=0;i<365;i++){
      const d=new Date(); d.setDate(d.getDate()-i);
      const key=d.toISOString().slice(0,10);
      const v=xpMap()[key]||0;
      if(v>=g) streak++; else break;
    }
    return streak;
  }

  // Map tags to coarse skill buckets
  const TAG2SKILL = {
    vocab: ['vocab','vocabSession'],
    comp:  ['comp','mcq','cloze','sa','tf'],
    listen:['listen','listenTask'],
    speak: ['speak','speak60'],
    phr:   ['phrases','phrSet']
  };

  // Derive skill xp for today (with caps for UI %)
  function skillBreakdown(){
    const caps = {vocab:10, comp:10, speak:15, listen:15, phr:5};
    const perTagXP = {}; // accumulate by tag via awards * 5 (default amount)
    const a = awMap()[today()] || {};
    // NOTE: award() in app.js uses +amount (default 5). We approximate with +5 here.
    const TAG_AMOUNT = 5;
    for(const [tag,count] of Object.entries(a)){
      perTagXP[tag] = (perTagXP[tag]||0) + (Number(count)||0)*TAG_AMOUNT;
    }
    const skills = {};
    for(const [skill,tags] of Object.entries(TAG2SKILL)){
      const raw = tags.reduce((s,t)=>s+(perTagXP[t]||0),0);
      const cap = caps[skill];
      skills[skill] = {raw, cap, pct: clamp(Math.round(100* Math.min(raw,cap)/cap), 0, 100)};
    }
    return skills;
  }

  // Draw a simple ring on canvas
  function drawRing(canvas, pct){
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx=W/2, cy=H/2, r=Math.min(W,H)/2 - 8;
    ctx.clearRect(0,0,W,H);
    // bg
    ctx.lineWidth=12; ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--ringbg')||'#0d1830';
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
    // fg
    ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--ring')||'#72b0ff';
    const a = Math.PI*1.5, span = Math.PI*2*(pct/100);
    ctx.beginPath(); ctx.arc(cx,cy,r,a,a+span); ctx.stroke();
  }

  // Mini bar chart for last 14 days
  function drawChart14(canvas, series){
    if(!canvas) return;
    const ctx=canvas.getContext('2d');
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);
    const pad=16, n=series.length;
    const barW=(W-2*pad)/n - 4;
    const max=Math.max(1, ...series.map(d=>d.xp));
    series.forEach((d,i)=>{
      const x=pad + i*((W-2*pad)/n);
      const h = Math.round((H-24) * d.xp/max);
      ctx.fillRect(x, H-8-h, barW, h);
    });
  }

  // Dashboard init
  function initDashboard(){
    if((document.body.dataset.page||'')!=='dashboard') return;
    // Save status
    const persistOK = (typeof store!=='undefined') ? store.isPersistent?.() : (()=> {try{localStorage.setItem('__t','1');localStorage.removeItem('__t');return true}catch{return false}})();
    const s=$('#saveStatus'); if(s) s.textContent = persistOK ? 'Local save: OK' : 'Local save: memory-only (backup often)';
    // Streak + countdown
    const streak = calcStreak();
    $('#streakBadge') && ($('#streakBadge').textContent = `🔥 Streak: ${streak}`);
    const target = new Date(b2Date());
    const diffDays = Math.max(0, Math.ceil((target - new Date())/86400000));
    $('#countdownBadge') && ($('#countdownBadge').textContent = `📅 ${diffDays} days to B2`);
    // XP + ring
    const g=goalXP(); const todayXP = xpMap()[today()]||0;
    $('#goalVal') && ($('#goalVal').textContent = g);
    $('#xpLabel') && ($('#xpLabel').textContent = `${todayXP}/${g}`);
    $('#xpBar') && ($('#xpBar').style.width = `${clamp(Math.round(100*Math.min(todayXP,g)/g),0,100)}%`);
    drawRing($('#ring'), clamp(Math.round(100*Math.min(todayXP,g)/g),0,100));
    // Weekly + last 14
    const last7 = lastNDays(7).reduce((s,d)=>s+d.xp,0);
    $('#wkXp') && ($('#wkXp').textContent = last7);
    const series14 = lastNDays(14);
    drawChart14($('#chart14'), series14);
    $('#sum14') && ($('#sum14').textContent = series14.reduce((s,d)=>s+d.xp,0));
    // Checklist
    const skills = skillBreakdown();
    // mark done if skill reached its cap
    const doneVocab = skills.vocab.raw >= skills.vocab.cap;
    const doneComp  = skills.comp.raw  >= skills.comp.cap;
    const doneSpeak = skills.speak.raw >= 10; // 60s target -> ~10xp threshold
    const doneListen= skills.listen.raw>= 10;
    const donePhr   = skills.phr.raw   >= skills.phr.cap;
    $('#chk-vocab') && ($('#chk-vocab').classList.toggle('done',doneVocab));
    $('#chk-comp')  && ($('#chk-comp').classList.toggle('done',doneComp));
    $('#chk-speak') && ($('#chk-speak').classList.toggle('done',doneSpeak));
    $('#chk-listen')&& ($('#chk-listen').classList.toggle('done',doneListen));
    $('#chk-phr')   && ($('#chk-phr').classList.toggle('done',donePhr));
    // Next action heuristic
    const next = (function(){
      if(!doneVocab)  return {href:'vocabulary.html?daily=1', label:'Review 10 vocab (due)'};
      const lp = store2.get(K2.listenProg,{})[today()]||{};
      if((lp.done||0) < 3) return {href:'listening.html?daily=1', label:'Finish 3 listening items'};
      const sp = store2.get(K2.speakProg,{})[today()]||{seconds:0};
      if((sp.seconds||0) < 60) return {href:'speaking.html', label:'Speak for 60 seconds'};
      if(!doneComp)   return {href:'comprehension.html', label:'Do 5–7 comprehension items'};
      if(!donePhr)    return {href:'phrases.html', label:'Daily phrases set'};
      return {href:'goals.html', label:'Stretch goal or rest'};
    })();
    if($('#nextAction')) $('#nextAction').innerHTML = `<a class="btn" href="${next.href}">${next.label}</a>`;
  }

  // Goals page init
  function initGoals(){
    if((document.body.dataset.page||'')!=='goals') return;
    const dailyMinutes = $('#dailyMinutes');
    const weeklyHours  = $('#weeklyHours');
    const dailyXP      = $('#dailyXP');
    const saveDailyXP  = $('#saveDailyXP');
    const b2Target     = $('#b2Target');
    const b2Countdown  = $('#b2Countdown');
    // Defaults
    if(dailyMinutes) dailyMinutes.value = dailyMinutes.value || 45;
    if(weeklyHours)  weeklyHours.value  = weeklyHours.value || 7;
    if(dailyXP)      dailyXP.value      = store2.get(K2.goal,30);
    if(b2Target)     b2Target.value     = b2Date();
    const updateCD = ()=>{
      const diffDays = Math.max(0, Math.ceil((new Date(b2Target.value) - new Date())/86400000));
      if(b2Countdown) b2Countdown.textContent = `${diffDays} days left`;
    };
    updateCD();
    b2Target && b2Target.addEventListener('change',()=>{ store2.set(K2.b2, b2Target.value); updateCD(); });
    saveDailyXP && saveDailyXP.addEventListener('click', ()=>{
      if(dailyXP) { setGoalXP(Number(dailyXP.value||30)); alert('Daily XP saved'); }
    });
  }

  // Phrases page init
  async function initPhrases(){
    if((document.body.dataset.page||'')!=='phrases') return;
    const listEl = $('#phraseList');
    const refresh = $('#refreshPhrases');
    const speakAll = $('#speakAllPhrases');
    const stopAll = $('#stopAllPhrases');
    const resp = await fetch('data/phrases.json').catch(()=>null);
    let phrases = [];
    try{ phrases = await resp.json(); }catch{ phrases = []; }
    if(!Array.isArray(phrases) || phrases.length===0){ phrases = ["Bonjour !","Ça marche.","On y va !","Pas de souci.","À mon avis…","Je suis d’accord.","Par contre…","Cependant…"]; }
    const SET_SIZE = 10;
    function pickToday(){
      const seed = parseInt(today().replace(/-/g,''),10);
      const out=[];
      for(let i=0;i<SET_SIZE;i++){
        const idx = (seed + i*37) % phrases.length;
        out.push(phrases[idx]);
      }
      return out;
    }
    let current = pickToday();
    function render(){
      listEl.innerHTML = current.map((p,i)=>`<div class="row"><span class="pill small">${i+1}</span><span>${p}</span></div>`).join('');
    }
    function awardOnce(){
      // one award per day for phrases
      const a = store2.get(K2.aw,{});
      const d = today();
      a[d] = a[d] || {};
      a[d]['phrSet'] = Math.min(1, (a[d]['phrSet']||0) + 1);
      store2.set(K2.aw,a);
      // also bump xp by 10
      const xm = store2.get(K2.xp,{}); xm[d] = (xm[d]||0) + 10; store2.set(K2.xp,xm);
      alert('Phrases set complete! +10 xp');
    }
    render();
    refresh && refresh.addEventListener('click', ()=>{ current = pickToday(); render(); });
    let playing=false;
    function speakQueue(){
      if(playing) return;
      playing=true;
      let i=0;
      const next=()=>{
        if(i>=current.length){ playing=false; awardOnce(); return; }
        try{
          const u = new SpeechSynthesisUtterance(current[i]); u.lang='fr-FR'; speechSynthesis.speak(u);
          u.onend=()=>{ i++; setTimeout(next, 400); };
        }catch{ i++; setTimeout(next, 200); }
      };
      next();
    }
    function stopQueue(){ try{speechSynthesis.cancel();}catch{} playing=false; }
    speakAll && speakAll.addEventListener('click', speakQueue);
    stopAll && stopAll.addEventListener('click', stopQueue);
  }

  // Speaking page init
  function initSpeaking(){
    if((document.body.dataset.page||'')!=='speaking') return;
    const askBtn = $('#askMic'), startBtn=$('#startRec'), stopBtn=$('#stopRec');
    const micState=$('#micState'), recState=$('#recState'), out=$('#speechOut');
    const promptBtn=$('#speakPrompt');
    let stream=null, rec=null, chunks=[], timer=null, seconds=0;
    function updateMic(s){ if(micState) micState.textContent = `🎙️ Micro: ${s}`; }
    function updateRec(s){ if(recState) recState.textContent = `🗣️ State: ${s}`; }
    function tick(){ seconds++; updateRec(`recording ${seconds}s`); const P=store2.get(K2.speakProg,{}); const d=today(); P[d]=P[d]||{seconds:0}; P[d].seconds=seconds; store2.set(K2.speakProg,P);
      if(seconds===60){ // award once when reaching 60s
        const a=store2.get(K2.aw,{}); a[today()]=a[today()]||{}; a[today()].speak60 = Math.min(1,(a[today()].speak60||0)+1); store2.set(K2.aw,a);
        const xm = store2.get(K2.xp,{}); xm[today()] = (xm[today()]||0) + 10; store2.set(K2.xp,xm);
      }}
    askBtn && askBtn.addEventListener('click', async()=>{
      try{ stream = await navigator.mediaDevices.getUserMedia({audio:true}); updateMic('ready'); }
      catch(e){ updateMic('blocked'); alert('Microphone permission is blocked. Click the camera icon in your address bar to allow.'); }
    });
    startBtn && startBtn.addEventListener('click', ()=>{
      if(!stream){ alert('Click “Ask for mic access” first.'); return; }
      try{
        chunks=[]; rec=new MediaRecorder(stream); rec.ondataavailable=e=>chunks.push(e.data);
        rec.onstop=()=>{ const blob=new Blob(chunks,{type:'audio/webm'}); // we keep in memory only
                         // transcript stub (future ASR): show a note
                         if(out) out.value = (out.value||'') + `\\n[${new Date().toLocaleTimeString()}] Recorded ${seconds}s`;
                       };
        rec.start(); seconds=0; updateRec('recording 0s'); timer=setInterval(tick,1000);
      }catch(e){ updateRec('error'); }
    });
    stopBtn && stopBtn.addEventListener('click', ()=>{
      try{ rec?.stop(); }catch{}; try{ stream.getTracks().forEach(t=>t.stop()); }catch{}; clearInterval(timer); updateRec('stopped');
    });
    promptBtn && promptBtn.addEventListener('click', ()=>{
      const text = ($('#promptBox')?.textContent||'Parlez pendant 60 secondes sur votre journée.');
      try{ const u=new SpeechSynthesisUtterance(text); u.lang='fr-FR'; speechSynthesis.speak(u);}catch{}
    });
    $('#markSpeakXP') && $('#markSpeakXP').addEventListener('click', ()=>{
      const a=store2.get(K2.aw,{}); const d=today(); a[d]=a[d]||{}; a[d].speak = (a[d].speak||0)+1; store2.set(K2.aw,a);
      const xm=store2.get(K2.xp,{}); xm[d]=(xm[d]||0)+5; store2.set(K2.xp,xm);
      alert('+5 xp');
    });
  }

  // Calendar page init
  function initCalendar(){
    if((document.body.dataset.page||'')!=='calendar') return;
    const cont = $('#calendarContainer'); if(!cont) return;
    cont.innerHTML='';
    const now=new Date(); const y=now.getFullYear(), m=now.getMonth();
    function renderMonth(year, month){
      const first=new Date(year,month,1); const startDay=(first.getDay()+6)%7; // Monday=0
      const days=new Date(year,month+1,0).getDate();
      const g=goalXP(); const xp=xpMap();
      const wrap=document.createElement('div');
      wrap.innerHTML = `<div class="calMonth">${first.toLocaleString(undefined,{month:'long', year:'numeric'})}</div>`;
      const grid=document.createElement('div'); grid.className='calGrid';
      // week headers
      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>{ const h=document.createElement('div'); h.className='calCell small muted'; h.textContent=d; grid.appendChild(h);});
      for(let i=0;i<startDay;i++){ const e=document.createElement('div'); e.className='calCell future'; e.textContent=''; grid.appendChild(e); }
      for(let d=1; d<=days; d++){
        const key=new Date(year,month,d).toISOString().slice(0,10);
        const e=document.createElement('div'); e.className='calCell'; e.textContent=String(d);
        const val = xp[key]||0;
        if(new Date(key).toDateString() === new Date().toDateString()) e.classList.add('today');
        if(val>=g) e.classList.add('done');
        grid.appendChild(e);
      }
      wrap.appendChild(grid); cont.appendChild(wrap);
    }
    renderMonth(y,m);
  }

  // Data page — nothing extra here; backup banner handled on dashboard

  // Wire auto-start parameters
  function installParamHooks(){
    const url = new URL(location.href);
    const daily = url.searchParams.get('daily')==='1';
    const page = document.body.dataset.page||'';
    if(page==='vocab' && daily){
      // auto-click start review if present
      document.querySelector('#startQuiz')?.click?.();
    }
    if(page==='listening' && daily){
      // ensure Daily tab visible (pane-daily exists)
      document.querySelector('[data-t="daily"]')?.click?.();
      // renderDaily runs on load already
    }
  }

  // Boot for this add-on
  function boot2(){
    initDashboard();
    initGoals();
    initPhrases();
    initSpeaking();
    initCalendar();
    installParamHooks();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot2); else boot2();
})();
