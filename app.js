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
 function srsRate(card, grade){
  // SM-2 style + leech tracking
  if(grade < 3){
    card.reps = 0;
    card.interval = 1;
    card.ease = Math.max(1.3, (card.ease||2.5) - 0.2);
    card.leech = (card.leech||0) + 1;
  } else {
    card.reps = (card.reps||0) + 1;
    if(card.reps === 1) card.interval = 1;
    else if(card.reps === 2) card.interval = 3;
    else card.interval = Math.round((card.interval||3) * (card.ease||2.5));
    card.ease = Math.min(3.2, (card.ease||2.5) + (grade===4?0.15:0));
    card.leech = Math.max(0, (card.leech||0) - 1);
  }
  // Leech threshold: flag and cap interval to keep it visible
  if((card.leech||0) >= 8){
    card.tag = "leech";
    card.interval = Math.min(card.interval||1, 2);
  }
  card.due = fmt(addDays(new Date(), card.interval||1));
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
// Dashboard, Goals, Phrases, Speaking, Calendar, Data — Quick Wins (SAFE)
// ======================================================================
(function () {
  // ---------- tiny utils ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.from((r || document).querySelectorAll(s)); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // ---------- storage + keys ----------
  var K2 = (typeof K !== 'undefined') ? K : {};
  K2.xp = K2.xp || 'fj_xp_by_day';
  K2.aw = K2.aw || 'fj_awards_by_day';
  K2.goal = K2.goal || 'fj_goal_xp';
  K2.b2 = K2.b2 || 'fj_b2_target';
  K2.listenProg = K2.listenProg || 'fj_listen_prog';
  K2.speakProg = K2.speakProg || 'fj_speak_prog';

  var store2 = (typeof store !== 'undefined') ? store : {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  function xpMap() { return store2.get(K2.xp, {}); }
  function awMap() { return store2.get(K2.aw, {}); }
  function goalXP() { return Number(store2.get(K2.goal, 30)); }
  function setGoalXP(v) { store2.set(K2.goal, Number(v) || 30); }
  function b2Date() { return store2.get(K2.b2, new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10)); }

  // ---------- helpers ----------
  function lastNDays(n) {
    var out = [], m = xpMap(), i, d, key;
    for (i = n - 1; i >= 0; i--) {
      d = new Date(); d.setDate(d.getDate() - i);
      key = d.toISOString().slice(0, 10);
      out.push({ d: key, xp: m[key] || 0 });
    }
    return out;
  }
  function calcStreak() {
    var g = goalXP(), i, d, key, v, streak = 0;
    for (i = 0; i < 365; i++) {
      d = new Date(); d.setDate(d.getDate() - i);
      key = d.toISOString().slice(0, 10);
      v = xpMap()[key] || 0;
      if (v >= g) streak++; else break;
    }
    return streak;
  }
  var TAG2SKILL = {
    vocab: ['vocab', 'vocabSession'],
    comp: ['comp', 'mcq', 'cloze', 'sa', 'tf'],
    listen: ['listen', 'listenTask'],
    speak: ['speak', 'speak60'],
    phr: ['phrases', 'phrSet']
  };
  function skillBreakdown() {
    var caps = { vocab: 10, comp: 10, speak: 15, listen: 15, phr: 5 };
    var perTagXP = {}, a = awMap()[today()] || {}, tag, count;
    var TAG_AMOUNT = 5; // awards default to +5 xp each in app core
    for (tag in a) {
      count = Number(a[tag]) || 0;
      perTagXP[tag] = (perTagXP[tag] || 0) + count * TAG_AMOUNT;
    }
    var skills = {}, skill, tags, i, raw, cap;
    for (skill in TAG2SKILL) {
      tags = TAG2SKILL[skill]; raw = 0;
      for (i = 0; i < tags.length; i++) raw += (perTagXP[tags[i]] || 0);
      cap = caps[skill];
      skills[skill] = { raw: raw, cap: cap, pct: clamp(Math.round(100 * Math.min(raw, cap) / cap), 0, 100) };
    }
    return skills;
  }

  // ---------- tiny canvas charts ----------
  function drawRing(canvas, pct) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 8;
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 12;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ringbg') || '#0d1830';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ring') || '#72b0ff';
    var a = Math.PI * 1.5, span = Math.PI * 2 * (pct / 100);
    ctx.beginPath(); ctx.arc(cx, cy, r, a, a + span); ctx.stroke();
  }
  function drawChart14(canvas, series) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    var pad = 16, n = series.length, barW = (W - 2 * pad) / n - 4;
    var i, d, x, h, max = 1;
    for (i = 0; i < n; i++) if (series[i].xp > max) max = series[i].xp;
    for (i = 0; i < n; i++) {
      d = series[i]; x = pad + i * ((W - 2 * pad) / n);
      h = Math.round((H - 24) * d.xp / max);
      ctx.fillRect(x, H - 8 - h, barW, h);
    }
  }

  // ---------- Dashboard ----------
  function initDashboard() {
    if ((document.body.dataset.page || '') !== 'dashboard') return;

    // Save status
    var persistOK = (typeof store !== 'undefined' && typeof store.isPersistent === 'function')
      ? store.isPersistent() : (function () { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; } catch (e) { return false; } })();
    var s = $('#saveStatus');
    if (s) s.textContent = persistOK ? 'Local save: OK' : 'Local save: memory-only (backup often)';

    // Streak + countdown
    var streak = calcStreak();
    var sb = $('#streakBadge'); if (sb) sb.textContent = ' Streak: ' + streak;
    var target = new Date(b2Date());
    var diffDays = Math.max(0, Math.ceil((target - new Date()) / 86400000));
    var cb = $('#countdownBadge'); if (cb) cb.textContent = ' ' + diffDays + ' days to B2';

    // XP + ring
    var g = goalXP(), todayXP = xpMap()[today()] || 0, pct = clamp(Math.round(100 * Math.min(todayXP, g) / g), 0, 100);
    var gv = $('#goalVal'); if (gv) gv.textContent = g;
    var xl = $('#xpLabel'); if (xl) xl.textContent = todayXP + '/' + g;
    var xb = $('#xpBar'); if (xb) xb.style.width = pct + '%';
    drawRing($('#ring'), pct);

    // Weekly + last 14
    var last7 = lastNDays(7).reduce(function (s, d) { return s + d.xp; }, 0);
    var wk = $('#wkXp'); if (wk) wk.textContent = last7;
    var s14 = lastNDays(14);
    drawChart14($('#chart14'), s14);
    var sum14 = $('#sum14'); if (sum14) sum14.textContent = s14.reduce(function (s, d) { return s + d.xp; }, 0);

    // Checklist (done/not done)
    var skills = skillBreakdown();
    var doneVocab = skills.vocab.raw >= skills.vocab.cap;
    var doneComp = skills.comp.raw >= skills.comp.cap;
    var doneSpeak = skills.speak.raw >= 10;     // ~60s target
    var doneListen = skills.listen.raw >= 10;   // ~10 xp threshold
    var donePhr = skills.phr.raw >= skills.phr.cap;
    var el;
    el = $('#chk-vocab'); if (el) el.classList.toggle('done', doneVocab);
    el = $('#chk-comp'); if (el) el.classList.toggle('done', doneComp);
    el = $('#chk-speak'); if (el) el.classList.toggle('done', doneSpeak);
    el = $('#chk-listen'); if (el) el.classList.toggle('done', doneListen);
    el = $('#chk-phr'); if (el) el.classList.toggle('done', donePhr);

    // Next action
    var next;
    if (!doneVocab) next = { href: 'vocabulary.html?daily=1', label: 'Review 10 vocab (due)' };
    else {
      var lp = store2.get(K2.listenProg, {})[today()] || {};
      if ((lp.done || 0) < 3) next = { href: 'listening.html?daily=1', label: 'Finish 3 listening items' };
      else {
        var sp = store2.get(K2.speakProg, {})[today()] || { seconds: 0 };
        if ((sp.seconds || 0) < 60) next = { href: 'speaking.html', label: 'Speak for 60 seconds' };
        else if (!doneComp) next = { href: 'comprehension.html', label: 'Do 5–7 comprehension items' };
        else if (!donePhr) next = { href: 'phrases.html', label: 'Daily phrases set' };
        else next = { href: 'goals.html', label: 'Stretch goal or rest' };
      }
    }
    var na = $('#nextAction');
    if (na) na.innerHTML = '<a class="btn" href="' + next.href + '">' + next.label + '</a>';
  }

  // ---------- Goals ----------
  function initGoals() {
    if ((document.body.dataset.page || '') !== 'goals') return;
    var dailyMinutes = $('#dailyMinutes');
    var weeklyHours = $('#weeklyHours');
    var dailyXP = $('#dailyXP');
    var saveDailyXP = $('#saveDailyXP');
    var b2Target = $('#b2Target');
    var b2Countdown = $('#b2Countdown');

    if (dailyMinutes) dailyMinutes.value = dailyMinutes.value || 45;
    if (weeklyHours) weeklyHours.value = weeklyHours.value || 7;
    if (dailyXP) dailyXP.value = store2.get(K2.goal, 30);
    if (b2Target) b2Target.value = b2Date();
    function updateCD() {
      var diffDays = Math.max(0, Math.ceil((new Date(b2Target.value) - new Date()) / 86400000));
      if (b2Countdown) b2Countdown.textContent = diffDays + ' days left';
    }
    updateCD();
    if (b2Target) b2Target.addEventListener('change', function () { store2.set(K2.b2, b2Target.value); updateCD(); });
    if (saveDailyXP) saveDailyXP.addEventListener('click', function () {
      if (dailyXP) { setGoalXP(Number(dailyXP.value || 30)); alert('Daily XP saved'); }
    });
  }

  // ---------- Phrases (safe, no template strings) ----------
  function initPhrases() {
    if ((document.body.dataset.page || '') !== 'phrases') return;

    var listEl = $('#phraseList');
    var refresh = $('#refreshPhrases');
    var speakAll = $('#speakAllPhrases');
    var stopAll = $('#stopAllPhrases');

    var phrases = [];
    fetch('data/phrases.json').then(function (r) { return r.json(); })
      .then(function (j) { phrases = Array.isArray(j) ? j : []; })
      .catch(function () { phrases = []; })
      .finally(function () {
        if (phrases.length === 0) {
          phrases = ['Bonjour !', 'Ça marche.', 'On y va !', 'Pas de souci.', 'À mon avis…', 'Je suis d’accord.', 'Par contre…', 'Cependant…'];
        }
        bootSet();
      });

    var current = [];
    function pickToday() {
      var seed = parseInt(today().replace(/-/g, ''), 10) || 1;
      var i, out = [], n = phrases.length, idx;
      if (n === 0) return [];
      for (i = 0; i < 10; i++) {
        idx = (seed + i * 37) % n;
        out.push(phrases[idx]);
      }
      return out;
    }
    function render() {
      if (!listEl) return;
      var html = '', i;
      for (i = 0; i < current.length; i++) {
        html += '<div class="row"><span class="pill small">' + (i + 1) + '</span><span>' + current[i] + '</span></div>';
      }
      listEl.innerHTML = html;
    }
    function awardOnce() {
      var a = store2.get(K2.aw, {}), d = today();
      a[d] = a[d] || {};
      a[d]['phrSet'] = Math.min(1, (a[d]['phrSet'] || 0) + 1);
      store2.set(K2.aw, a);
      var xm = store2.get(K2.xp, {}); xm[d] = (xm[d] || 0) + 10; store2.set(K2.xp, xm);
      alert('Phrases set complete! +10 xp');
    }

    var playing = false, speakTimer = 0;
    function speakQueue() {
      if (playing) return;
      playing = true;
      var i = 0;
      function next() {
        if (i >= current.length) { playing = false; awardOnce(); return; }
        try {
          var u = new SpeechSynthesisUtterance(current[i]);
          u.lang = 'fr-FR';
          speechSynthesis.speak(u);
          u.onend = function () { i++; speakTimer = setTimeout(next, 400); };
        } catch (e) { i++; speakTimer = setTimeout(next, 200); }
      }
      next();
    }
    function stopQueue() {
      try { speechSynthesis.cancel(); } catch (e) {}
      playing = false;
      if (speakTimer) clearTimeout(speakTimer);
    }

    function bootSet() {
      current = pickToday();
      render();
      if (refresh) refresh.addEventListener('click', function () { current = pickToday(); render(); });
      if (speakAll) speakAll.addEventListener('click', speakQueue);
      if (stopAll) stopAll.addEventListener('click', stopQueue);
    }
  }

  // ---------- Speaking ----------
  function initSpeaking() {
    if ((document.body.dataset.page || '') !== 'speaking') return;

    var askBtn = $('#askMic'), startBtn = $('#startRec'), stopBtn = $('#stopRec');
    var micState = $('#micState'), recState = $('#recState'), out = $('#speechOut');
    var promptBtn = $('#speakPrompt');

    var stream = null, rec = null, chunks = [], timer = 0, seconds = 0;

    function updateMic(s) { if (micState) micState.textContent = '️ Micro: ' + s; }
    function updateRec(s) { if (recState) recState.textContent = '️ State: ' + s; }

    function tick() {
      seconds++;
      updateRec('recording ' + seconds + 's');
      var P = store2.get(K2.speakProg, {}), d = today();
      P[d] = P[d] || { seconds: 0 };
      P[d].seconds = seconds; store2.set(K2.speakProg, P);
      if (seconds === 60) {
        var a = store2.get(K2.aw, {}); a[d] = a[d] || {}; a[d].speak60 = Math.min(1, (a[d].speak60 || 0) + 1);
        store2.set(K2.aw, a);
        var xm = store2.get(K2.xp, {}); xm[d] = (xm[d] || 0) + 10; store2.set(K2.xp, xm);
      }
    }

    if (askBtn) askBtn.addEventListener('click', function () {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
        stream = st; updateMic('ready');
      }).catch(function () { updateMic('blocked'); alert('Microphone permission is blocked.\nClick the camera icon in your address bar to allow.'); });
    });

    if (startBtn) startBtn.addEventListener('click', function () {
      if (!stream) { alert('Click "Ask for mic access" first.'); return; }
      try {
        chunks = []; rec = new MediaRecorder(stream);
        rec.ondataavailable = function (e) { chunks.push(e.data); };
        rec.onstop = function () {
          try { var blob = new Blob(chunks, { type: 'audio/webm' }); void blob; } catch (e) {}
          if (out) out.value = (out.value || '') + '\n[' + new Date().toLocaleTimeString() + '] Recorded ' + seconds + 's';
        };
        rec.start(); seconds = 0; updateRec('recording 0s'); timer = setInterval(tick, 1000);
      } catch (e) { updateRec('error'); }
    });

    if (stopBtn) stopBtn.addEventListener('click', function () {
      try { rec && rec.stop(); } catch (e) {}
      try { stream && stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      clearInterval(timer); updateRec('stopped');
    });

    if (promptBtn) promptBtn.addEventListener('click', function () {
      var text = ($('#promptBox') ? $('#promptBox').textContent : 'Parlez pendant 60 secondes sur votre journée.');
      try { var u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; speechSynthesis.speak(u); } catch (e) {}
    });
  }

  // ---------- Calendar (simple month with goal shading) ----------
  function initCalendar() {
    if ((document.body.dataset.page || '') !== 'calendar') return;
    var cont = $('#calendarContainer'); if (!cont) return;
    cont.innerHTML = '';

    var now = new Date(), y = now.getFullYear(), m = now.getMonth();

    function renderMonth(year, month) {
      var first = new Date(year, month, 1);
      var startDay = (first.getDay() + 6) % 7; // Monday=0
      var days = new Date(year, month + 1, 0).getDate();
      var g = goalXP();
      var xp = xpMap();

      var wrap = document.createElement('div');

      var h2 = document.createElement('h2');
      h2.textContent = first.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      wrap.appendChild(h2);

      var grid = document.createElement('div');
      grid.className = 'calGrid';

      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (d) {
        var hd = document.createElement('div');
        hd.className = 'calCell small muted';
        hd.textContent = d;
        grid.appendChild(hd);
      });

      var i, e, d;
      for (i = 0; i < startDay; i++) { e = document.createElement('div'); e.className = 'calCell muted'; e.textContent = ''; grid.appendChild(e); }
      for (i = 1; i <= days; i++) {
        d = new Date(year, month, i).toISOString().slice(0, 10);
        e = document.createElement('div');
        e.className = 'calCell';
        e.textContent = String(i);
        if ((xp[d] || 0) >= g) e.classList.add('done');
        grid.appendChild(e);
      }

      wrap.appendChild(grid);
      cont.appendChild(wrap);
    }

    renderMonth(y, m);
  }

  // ---------- small URL hooks ----------
  function installParamHooks() {
    var url = new URL(location.href);
    var daily = url.searchParams.get('daily') === '1';
    var page = document.body.dataset.page || '';
    if (page === 'vocab' && daily) { var b = document.querySelector('#startQuiz'); if (b && b.click) b.click(); }
    if (page === 'listening' && daily) { var t = document.querySelector('[data-t="daily"]'); if (t && t.click) t.click(); }
  }

  // ---------- boot ----------
  function boot2() {
    initDashboard();
    initGoals();
    initPhrases();
    initSpeaking();
    initCalendar();
    installParamHooks();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot2);
  else boot2();
})();

/* =========================
   Deeper Improvements Module
   (append-only; no breaking changes)
   ========================= */
(() => {
  "use strict";

  // ---------- tiny utils ----------
  function $(s, r=document){ return r.querySelector(s); }
  function $$(s, r=document){ return Array.from(r.querySelectorAll(s)); }
  function today(){ return new Date().toISOString().slice(0,10); }
  function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function fmt(d){ return new Date(d).toISOString().slice(0,10); }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function normalizeText(s, relaxed){
    s = (s||"").toLowerCase().trim();
    // Remove punctuation always for scoring
    s = s.replace(/[.,!?;:'"()\-–—]/g, " ");
    if(relaxed){
      // Remove accents/diacritics (NFD)
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
    }
    return s.replace(/\s+/g, " ");
  }
  function loadJSON(url, fallback){
    return fetch(url).then(r=>r.json()).catch(()=>fallback);
  }

  // ---------- storage facade ----------
  const store2 = (typeof store!=="undefined") ? store : {
    get: (k,d)=>{ try{const v=localStorage.getItem(k); return v==null?d:JSON.parse(v);}catch{return d} },
    set: (k,v)=>{ try{localStorage.setItem(k,JSON.stringify(v));}catch{} }
  };
  const K2 = (typeof K!=="undefined") ? K : {};
  // existing keys (from app) we reuse when present:
  K2.xp       = K2.xp       || 'fj_xp_by_day';
  K2.aw       = K2.aw       || 'fj_awards_by_day';
  K2.goal     = K2.goal     || 'fj_goal_xp';
  K2.b2       = K2.b2       || 'fj_b2_target';
  K2.listenProg = K2.listenProg || 'fj_listen_prog';
  K2.vocabProg  = K2.vocabProg  || 'fj_vocab_prog';
  // new keys:
  K2.speakProg  = K2.speakProg  || 'fj_speak_prog';    // seconds spoken per day (was added in quick-wins)
  K2.canDo      = 'fj_can_do';                         // per-day descriptor hits
  K2.weekTask   = 'fj_week_task';                      // weekly B1/B2 mock task
  K2.sprint     = 'fj_sprint';                         // one-week sprint theme
  K2.notify     = 'fj_notify_enabled';                 // notifications on/off

  function xpMap(){ return store2.get(K2.xp, {}); }
  function awMap(){ return store2.get(K2.aw, {}); }

  // ---------- CEFR can-do mapping (lightweight) ----------
  // We log descriptors when we detect completion of certain activities.
  // You can expand this later by editing data/can_do.json.
  const CAN_DO_DEFAULTS = {
    "listening:main_points": "Comprendre les points essentiels de messages oraux clairs et d’une certaine longueur.",
    "speaking:monologue": "Faire une présentation simple et articuler une argumentation claire pendant ~1–2 minutes.",
    "reading:short_texts": "Comprendre des textes factuels sur des sujets courants.",
    "interaction:opinions": "Exprimer son opinion, accorder/désaccorder avec nuances.",
    "mediation:summary": "Résumer des informations de différentes sources."
  };
  function logCanDo(id){
    const d=today();
    const m = store2.get(K2.canDo,{});
    m[d] = m[d] || {};
    m[d][id] = (m[d][id]||0) + 1;
    store2.set(K2.canDo, m);
  }
  function lastNDaysSeries(n, getter){
    const out=[];
    for(let i=n-1;i>=0;i--){
      const dt=new Date(); dt.setDate(dt.getDate()-i);
      const key=fmt(dt);
      out.push({d:key, v:getter(key)});
    }
    return out;
  }

  // ---------- Dashboard: inject Analytics + Can-Do coverage ----------
  function injectAnalytics(){
    if((document.body.dataset.page||"")!=="dashboard") return;
    const container = $(".container");
    if(!container || $("#ai-analytics")) return;

    // Build card
    const card = document.createElement("section");
    card.className = "card";
    card.id = "ai-analytics";
    card.innerHTML = `
      <h2>Analytics</h2>
      <div class="row wrap small">
        <span class="pill" id="anaSpeak">Spoken today: 0 min</span>
        <span class="pill" id="anaListen">Listening avg (7d): 0%</span>
        <span class="pill" id="anaVocab">Vocab retention (7d): —</span>
      </div>
      <div class="muted small">Tips: keep spoken ≥ 7 min/day and listening accuracy ≥ 80% weekly.</div>
    `;
    container.insertBefore(card, container.children[1] || null);

    // Compute metrics
    const speak = store2.get(K2.speakProg,{});
    const sToday = Math.round((speak[today()]?.seconds||0)/60);
    $("#anaSpeak").textContent = `Spoken today: ${sToday} min`;

    const L = store2.get(K2.listenProg,{});
    const acc7 = lastNDaysSeries(7, d => (L[d]?.avg||0)).map(x=>x.v);
    const listenAvg = Math.round(acc7.filter(x=>x>0).reduce((s,x)=>s+x,0) / Math.max(1, acc7.filter(x=>x>0).length));
    $("#anaListen").textContent = `Listening avg (7d): ${isFinite(listenAvg)?listenAvg:0}%`;

    const V = store2.get(K2.vocabProg,{});
    const days = lastNDaysSeries(7, d => V[d]||{reviews:0, know:0, dk:0});
    let totR=0, totKnow=0, totDk=0;
    days.forEach(x=>{ totR+=x.v.reviews||0; totKnow+=x.v.know||0; totDk+=x.v.dk||0; });
    const retention = totR? Math.round(100 * totKnow/Math.max(1, totR)) : 0;
    $("#anaVocab").textContent = `Vocab retention (7d): ${retention}%`;
  }

  async function injectCanDoPanel(){
    if((document.body.dataset.page||"")!=="dashboard") return;
    const container = $(".container");
    if(!container || $("#canDoPanel")) return;

    const data = await loadJSON("data/can_do.json", CAN_DO_DEFAULTS);
    const dmap = (typeof data==="object" && !Array.isArray(data)) ? data : CAN_DO_DEFAULTS;

    const m = store2.get(K2.canDo,{});
    const todayHits = m[today()]||{};
    const weekHits = lastNDaysSeries(7, d => m[d]||{}).map(x=>x.v);

    function descLine(id, text){
      const todayC = todayHits[id]||0;
      const weeklyC = weekHits.reduce((s,o)=>s+(o[id]||0),0);
      const cls = weeklyC>0 ? "tag ok" : "tag";
      return `<div class="${cls}">${text} <small>(${weeklyC}× wk)</small>${todayC?` <small>• today</small>`:''}</div>`;
    }

    const card = document.createElement("section");
    card.className = "card";
    card.id = "canDoPanel";
    card.innerHTML = `
      <h2>Can-Do Coverage</h2>
      <div id="canDoList" class="tags"></div>
      <p class="muted small">These auto-tick when you do Listening 3×, speak ≥60s, complete phrase set, or finish comprehension today.</p>
    `;
    container.insertBefore(card, container.children[2] || null);

    $("#canDoList").innerHTML = Object.entries(dmap)
      .map(([id,txt]) => descLine(id, txt)).join("");

    // Heuristics to auto-log can-dos from your existing progress maps
    const A = awMap()[today()]||{};
    if((store2.get(K2.listenProg,{})[today()]?.done||0) >= 3) logCanDo("listening:main_points");
    if((store2.get(K2.speakProg,{})[today()]?.seconds||0) >= 60) logCanDo("speaking:monologue");
    if(A.phrSet>=1) logCanDo("interaction:opinions");
  }

  // ---------- Weekly mock task (B1/B2 mini) ----------
  function weekStart(d=new Date()){
    const day=(d.getDay()+6)%7; // Monday=0
    const s=new Date(d); s.setHours(0,0,0,0); s.setDate(s.getDate()-day);
    return fmt(s);
  }
  async function ensureWeeklyTask(){
    const wt = store2.get(K2.weekTask,{});
    const wk = weekStart(new Date());
    if(wt[wk]) return wt[wk];

    const themes = await loadJSON("data/sprint_themes.json", {themes:["Daily","Travel","Work","News","Opinions"]});
    // If a sprint is set, prefer it; else pick "News"
    const sprint = store2.get(K2.sprint, "News");
    const theme = themes.themes.includes(sprint) ? sprint : "News";

    // Use your prompts.json to pick a speaking prompt
    const prompts = await loadJSON("data/prompts.json", {daily:["Parle de ta journée."]});
    const bank = prompts[theme.toLowerCase()] || prompts.daily || ["Parle de ta journée."];

    const idx = (parseInt(weekStart().replace(/-/g,''),10) % bank.length);
    const prompt = bank[idx];

    wt[wk] = {
      week: wk,
      theme,
      prompt,
      status: "pending",
      seconds: 0,
      notes: ""
    };
    store2.set(K2.weekTask, wt);
    return wt[wk];
  }

  function injectWeeklyTask(){
    if((document.body.dataset.page||"")!=="speaking") return;
    const main = $(".container");
    if(!main || $("#weeklyTask")) return;

    const card = document.createElement("section");
    card.className = "card";
    card.id = "weeklyTask";
    card.innerHTML = `
      <h2>Weekly Mock Task (B1/B2)</h2>
      <div class="muted small">Goal: speak ≥ 90s, then summarise in 2–3 phrases.</div>
      <div id="wtBody">Loading…</div>
    `;
    main.appendChild(card);

    ensureWeeklyTask().then(task=>{
      $("#wtBody").innerHTML = `
        <div class="row wrap">
          <span class="pill">Theme: <b>${task.theme}</b></span>
          <span class="pill" id="wtStatus">Status: ${task.status}</span>
        </div>
        <div class="block">
          <div class="small muted">Prompt</div>
          <div class="well" id="wtPrompt">${task.prompt}</div>
        </div>
        <div class="row">
          <button id="wtSpeak" class="btn">🔊 Read prompt</button>
          <button id="wtRec" class="btn">⏺️ Record (target 90s)</button>
          <button id="wtStop" class="btn bad">⏹ Stop</button>
        </div>
        <div class="row small"><span class="pill" id="wtTimer">0s</span></div>
        <textarea id="wtNotes" class="mono" rows="4" placeholder="Write 2–3 phrases summarising your point de vue…"></textarea>
        <div class="row">
          <button id="wtSave" class="btn good">✅ Mark complete (+10xp)</button>
        </div>
      `;

      let rec=null, stream=null, timer=null, seconds=0;
      function setStatus(s){ $("#wtStatus").textContent = `Status: ${s}`; }
      function tick(){ seconds++; $("#wtTimer").textContent = seconds+"s"; }

      $("#wtSpeak").onclick = ()=>{ try{ const u=new SpeechSynthesisUtterance($("#wtPrompt").textContent); u.lang='fr-FR'; speechSynthesis.speak(u);}catch{} };
      $("#wtRec").onclick = async()=>{
        try{ stream = await navigator.mediaDevices.getUserMedia({audio:true}); }
        catch{ alert("Microphone blocked. Allow mic access in the address bar."); return; }
        try{
          rec = new MediaRecorder(stream);
          seconds=0; $("#wtTimer").textContent="0s";
          rec.start(); timer=setInterval(tick,1000);
          setStatus("recording");
        }catch{ setStatus("error"); }
      };
      $("#wtStop").onclick = ()=>{
        try{ rec?.stop(); }catch{}
        try{ stream?.getTracks().forEach(t=>t.stop()); }catch{}
        clearInterval(timer);
        setStatus("recorded");
      };
      $("#wtSave").onclick = ()=>{
        const wk = weekStart();
        const m = store2.get(K2.weekTask,{});
        m[wk] = m[wk] || {};
        m[wk].status="completed";
        m[wk].seconds=seconds;
        m[wk].notes=$("#wtNotes").value||"";
        store2.set(K2.weekTask,m);

        // XP + can-do logging
        const X=xpMap(); X[today()] = (X[today()]||0) + 10; store2.set(K2.xp,X);
        const A=awMap(); A[today()] = A[today()]||{}; A[today()].comp = (A[today()].comp||0)+1; store2.set(K2.aw,A);
        logCanDo("mediation:summary"); logCanDo("interaction:opinions");

        alert("Task completed! (+10 xp)");
        setStatus("completed");
      };
    });
  }

  // ---------- Shadowing (Speaking) ----------
  async function injectShadowing(){
    if((document.body.dataset.page||"")!=="speaking") return;
    const main=$(".container");
    if(!main || $("#shadowingCard")) return;

    const card=document.createElement("section");
    card.className="card";
    card.id="shadowingCard";
    card.innerHTML = `
      <h2>Shadowing</h2>
      <div class="row wrap small">
        <label>Source&nbsp;
          <select id="shSource" class="input">
            <option value="phrases">Phrases du jour</option>
            <option value="news">Brèves d'actualité</option>
          </select>
        </label>
        <button id="shStart" class="btn">▶️ Start</button>
        <button id="shStop" class="btn bad">⏹ Stop</button>
      </div>
      <div class="small muted">We play a sentence; you overlap and imitate rhythm/pronunciation while we record.</div>
      <div class="row small"><span class="pill" id="shTimer">0s</span></div>
    `;
    main.appendChild(card);

    // load sources
    const P = await loadJSON("data/phrases.json", ["Bonjour !","Ça marche.","On y va !"]);
    const N = await loadJSON("data/news_summaries.json", {france:["Actualité du jour."]});
    function pickNews(){ const all=[...Object.values(N).flat()]; return all.slice(0, 8); }

    let stream=null, rec=null, chunks=[], idx=0, list=[], timer=null, seconds=0, playing=false;

    function speak(text){ try{ const u=new SpeechSynthesisUtterance(text); u.lang='fr-FR'; speechSynthesis.speak(u); }catch{} }
    function nextUtterance(){
      if(idx>=list.length){ stopAll(); return; }
      const t=list[idx++];
      speak(t);
      setTimeout(()=>{ if(playing) nextUtterance(); }, Math.max(1200, 400 + t.length*25));
    }
    function stopAll(){
      playing=false;
      try{ rec?.stop(); }catch{}; try{ stream?.getTracks().forEach(t=>t.stop()); }catch{}
      clearInterval(timer);
    }

    $("#shStart").onclick = async()=>{
      const src = $("#shSource").value;
      list = (src==="phrases") ? (P.slice(0,10)) : pickNews();
      idx=0; seconds=0; $("#shTimer").textContent="0s";
      try{ stream = await navigator.mediaDevices.getUserMedia({audio:true}); }catch{ alert("Mic blocked."); return; }
      try{
        rec=new MediaRecorder(stream); rec.ondataavailable=e=>chunks.push(e.data);
        rec.start(); timer=setInterval(()=>{ seconds++; $("#shTimer").textContent=seconds+"s"; },1000);
        playing=true; nextUtterance();
      }catch{ alert("Recording error."); }
    };
    $("#shStop").onclick = stopAll;
  }

  // ---------- Dictée+ (Listening) ----------
  async function injectDicteePlus(){
    if((document.body.dataset.page||"")!=="listening") return;
    const main=$(".container");
    if(!main || $("#dicteePlus")) return;

    const data = await loadJSON("data/dictation.json", [{text:"Je suis content d'apprendre le français.", hint:"Phrase simple"}]);
    const pick = ()=> data[(parseInt(today().replace(/-/g,''),10) % data.length)];

    const card=document.createElement("section");
    card.className="card";
    card.id="dicteePlus";
    card.innerHTML = `
      <h2>Dictée+ (strict/relaxed)</h2>
      <div class="row wrap small">
        <label>Niveau
          <select id="dpMode" class="input">
            <option value="strict">Strict (accents comptent)</option>
            <option value="relaxed" selected>Relaxed (ignorer accents)</option>
          </select>
        </label>
        <button id="dpPlay" class="btn">🔊 Play</button>
        <button id="dpCheck" class="btn">✅ Check</button>
      </div>
      <div class="row small"><span class="pill" id="dpHint">—</span></div>
      <textarea id="dpInput" class="mono" rows="3" placeholder="Tapez ce que vous entendez…"></textarea>
      <div class="row small"><span class="pill" id="dpScore">Score: 0%</span></div>
    `;
    main.appendChild(card);

    const itm = pick();
    $("#dpHint").textContent = itm.hint || "—";

    $("#dpPlay").onclick = ()=>{ try{ const u=new SpeechSynthesisUtterance(itm.text); u.lang='fr-FR'; speechSynthesis.speak(u);}catch{} };
    $("#dpCheck").onclick = ()=>{
      const relaxed = $("#dpMode").value === "relaxed";
      const ref = normalizeText(itm.text, relaxed).split(" ");
      const ans = normalizeText($("#dpInput").value, relaxed).split(" ");
      const correct = ans.filter(w=> ref.includes(w)).length;
      const score = Math.round(100 * correct / Math.max(1, ref.length));
      $("#dpScore").textContent = `Score: ${score}%`;
      if(score>=60){ 
        // award listening task xp and can-do
        const A=awMap(); const d=today(); A[d]=A[d]||{}; A[d].listenTask=(A[d].listenTask||0)+1; store2.set(K2.aw,A);
        const X=xpMap(); X[d]=(X[d]||0)+5; store2.set(K2.xp,X);
        logCanDo("listening:main_points");
        alert("Bien ! (+5 xp)");
      }
    };
  }

  // ---------- Sprint picker (Goals page) ----------
  async function injectSprintPicker(){
    if((document.body.dataset.page||"")!=="goals") return;
    const main=$(".container");
    if(!main || $("#sprintCard")) return;

    const themes = await loadJSON("data/sprint_themes.json", {themes:["Daily","Travel","Work","News","Opinions"]});

    const card=document.createElement("section");
    card.className="card";
    card.id="sprintCard";
    card.innerHTML = `
      <h2>One-Week Sprint</h2>
      <div class="row wrap">
        <label>Theme
          <select id="sprintTheme" class="input">
            ${themes.themes.map(t=>`<option>${t}</option>`).join("")}
          </select>
        </label>
        <button id="sprintSave" class="btn">Save</button>
        <span id="sprintNow" class="pill">—</span>
      </div>
      <p class="muted small">This adjusts your weekly mock task & shadowing source. You can change anytime.</p>
    `;
    main.appendChild(card);

    $("#sprintTheme").value = store2.get(K2.sprint, themes.themes[0]);
    $("#sprintNow").textContent = `Current: ${$("#sprintTheme").value}`;
    $("#sprintSave").onclick = ()=>{
      store2.set(K2.sprint, $("#sprintTheme").value);
      $("#sprintNow").textContent = `Current: ${$("#sprintTheme").value}`;
      alert("Sprint theme saved.");
    };
  }

  // ---------- Keyboard shortcuts (accessibility) ----------
  function installShortcuts(){
    const page = document.body.dataset.page||"";
    document.addEventListener("keydown", (e)=>{
      if(page==="vocab"){
        if(e.key==="1") $("#rateAgain")?.click();
        if(e.key==="2") $("#rateHard")?.click();
        if(e.key==="3") $("#rateGood")?.click();
        if(e.key==="4") $("#rateEasy")?.click();
        if(/^j$/i.test(e.key)) $("#nextCard")?.click();
      }
    });
  }

  // ---------- PWA + Reminders ----------
  function registerPWA(){
    try{
      if(!document.querySelector('link[rel="manifest"]')){
        const link=document.createElement("link");
        link.rel="manifest"; link.href="manifest.webmanifest";
        document.head.appendChild(link);
      }
      if('serviceWorker' in navigator){
        navigator.serviceWorker.register('service-worker.js');
      }
    }catch{}
  }
  function injectReminders(){
    if((document.body.dataset.page||"")!=="dashboard") return;
    const card = document.createElement("section");
    card.className="card";
    card.innerHTML = `
      <h2>Reminders</h2>
      <div class="row wrap">
        <button id="rqNotify" class="btn">🔔 Enable daily reminder (browser)</button>
        <span id="notifState" class="pill">—</span>
      </div>
      <p class="muted small">Reminders fire only while this site is open. For push while closed, you’d need a server (can add later).</p>
    `;
    $(".container").appendChild(card);

    function update(){ $("#notifState").textContent = store2.get(K2.notify,false) ? "On" : "Off"; }
    update();

    $("#rqNotify").onclick = async()=>{
      try{
        const perm = await Notification.requestPermission();
        if(perm!=="granted"){ alert("Notifications blocked."); return; }
        store2.set(K2.notify, true); update();
        // Test notification + simple "next 9:00" reminder while page is open
        new Notification("Ravi de vous voir 👋", { body:"Je vous rappellerai chaque matin à 9h (tant que la page est ouverte)." });
        const now=new Date(); const target=new Date(); target.setHours(9,0,0,0);
        if(target<now) target.setDate(target.getDate()+1);
        const ms = target-now;
        setTimeout(()=>{ new Notification("⏰ Prêt pour la séance du jour ?", { body:"Vocab + Listening + Speaking (45 min)" }); }, ms);
      }catch{ alert("Notification error."); }
    };
  }

  // ---------- Boot ----------
  function bootDeep(){
    registerPWA();
    installShortcuts();
    injectAnalytics();
    injectCanDoPanel();
    injectWeeklyTask();
    injectShadowing();
    injectDicteePlus();
    injectSprintPicker();
    injectReminders();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bootDeep);
  else bootDeep();
})();
/* =========================
   Comprehension — Daily Mix (SAFE, no template strings)
   Provides a 5–7 item mixed exercise (MCQ, Cloze, TF, Short Answer)
   Awards +10xp once when the set is completed.
   ========================= */
(function () {
  "use strict";

  // ---- small utils ----
  function $(s, r) { return (r || document).querySelector(s); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function shuffle(arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function norm(s) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // storage facades (reuse existing if present)
  var store2 = (typeof store !== "undefined") ? store : {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var K2 = (typeof K !== "undefined") ? K : {};
  K2.xp    = K2.xp    || "fj_xp_by_day";
  K2.aw    = K2.aw    || "fj_awards_by_day";
  K2.canDo = K2.canDo || "fj_can_do";

  function bumpXP(amount) {
    var d = today(); var m = store2.get(K2.xp, {}); m[d] = (m[d] || 0) + (amount || 0); store2.set(K2.xp, m);
  }
  function bumpAward(tag, inc) {
    inc = inc || 1; var d = today(); var a = store2.get(K2.aw, {}); a[d] = a[d] || {}; a[d][tag] = (a[d][tag] || 0) + inc; store2.set(K2.aw, a);
  }
  function logCanDo(id) {
    var d = today(); var m = store2.get(K2.canDo, {}); m[d] = m[d] || {}; m[d][id] = (m[d][id] || 0) + 1; store2.set(K2.canDo, m);
  }

  function loadPairs() {
    return fetch("data/sentences.json")
      .then(function (r) { return r.json(); })
      .then(function (js) {
        var raw = Array.isArray(js && js.pairs) ? js.pairs : (Array.isArray(js) ? js : []);
        return raw.map(function (s) {
          var ix = s.indexOf("|");
          return (ix > 0) ? { fr: s.slice(0, ix).trim(), en: s.slice(ix + 1).trim() } : { fr: s.trim(), en: "" };
        }).filter(function (x) { return x.fr && x.en; });
      })
      .catch(function () {
        return [
          { fr: "Je travaille à Sierre et j'apprends le français.", en: "I work in Sierre and I am learning French." },
          { fr: "Nous aimons faire des randonnées le week-end.", en: "We like to go hiking on the weekend." },
          { fr: "Il fait très chaud aujourd’hui en Valais.", en: "It is very hot today in Valais." },
          { fr: "Demain, je dois écrire un email formel.", en: "Tomorrow, I need to write a formal email." }
        ];
      });
  }

  // ---- UI injection ----
  function injectDailyUI() {
    if ((document.body.dataset.page || "") !== "comprehension") return null;
    if ($("#compDaily")) return $("#compDaily");
    var container = $(".container");
    if (!container) return null;

    var card = document.createElement("section");
    card.className = "card";
    card.id = "compDaily";
    card.innerHTML =
      '<h2>Daily Mix (5–7)</h2>' +
      '<div class="row wrap">' +
      '<button id="cddStart" class="btn">▶️ Start</button>' +
      '<button id="cddNext" class="btn" disabled>Next</button>' +
      '<span id="cddProg" class="pill">0/0</span>' +
      '<span id="cddMsg" class="pill">—</span>' +
      '</div>' +
      '<div id="cddBody" class="block"></div>';
    container.insertBefore(card, container.firstChild);
    return card;
  }

  function mcqView(item, bank) {
    var correct = item.en;
    var distract = shuffle(bank.filter(function (x) { return x.en !== correct; }).map(function (x) { return x.en; })).slice(0, 3);
    var opts = shuffle([correct].concat(distract));
    var div = document.createElement("div");
    var listHTML = "", i;
    for (i = 0; i < opts.length; i++) {
      listHTML += '<label style="display:block;margin:.35rem 0"><input type="radio" name="mcq" value="' + i + '"> ' + opts[i] + '</label>';
    }
    div.innerHTML =
      '<div class="small muted">MCQ — Choose the correct English translation</div>' +
      '<div class="well"><b>' + item.fr + '</b></div>' +
      '<div class="list">' + listHTML + '</div>' +
      '<button class="btn" id="mcqCheck">Check</button>' +
      '<span class="pill" id="mcqRes">—</span>';
    var ok = false, done = false;
    div.querySelector("#mcqCheck").onclick = function () {
      if (done) return;
      var sel = div.querySelector('input[name="mcq"]:checked');
      if (!sel) { div.querySelector("#mcqRes").textContent = "Pick an answer."; return; }
      var chosen = opts[Number(sel.value)] || "";
      ok = norm(chosen) === norm(correct);
      div.querySelector("#mcqRes").textContent = ok ? "✅ Correct" : "❌ \"" + correct + "\"";
      done = true;
    };
    return { el: div, isCorrect: function () { return ok; }, isDone: function () { return done; } };
  }

  function clozeView(item) {
    var ws = item.fr.split(/\s+/).filter(function (w) { return w.length > 0; });
    var cand = ws.filter(function (w) { return w.length >= 4; });
    var hole = cand[Math.floor(Math.random() * cand.length)] || ws[Math.floor(ws.length / 2)] || "";
    var masked = item.fr.replace(hole, "____");
    var div = document.createElement("div");
    div.innerHTML =
      '<div class="small muted">Cloze — Type the missing word</div>' +
      '<div class="well"><b>' + masked + '</b></div>' +
      '<input id="clozeIn" class="input" placeholder="missing word">' +
      '<button class="btn" id="clozeCheck">Check</button>' +
      '<span class="pill" id="clozeRes">—</span>';
    var ok = false, done = false;
    div.querySelector("#clozeCheck").onclick = function () {
      if (done) return;
      var val = norm(div.querySelector("#clozeIn").value);
      ok = !!val && (val === norm(hole));
      div.querySelector("#clozeRes").textContent = ok ? "✅ Correct" : "❌ \"" + hole + "\"";
      done = true;
    };
    return { el: div, isCorrect: function () { return ok; }, isDone: function () { return done; } };
  }

  function tfView(item, bank) {
    var useTrue = Math.random() < 0.5;
    var distract = shuffle(bank.filter(function (x) { return x.en !== item.en; }).map(function (x) { return x.en; }))[0] || item.en;
    var shown = useTrue ? item.en : distract;
    var div = document.createElement("div");
    div.innerHTML =
      '<div class="small muted">True/False — Does this match?</div>' +
      '<div class="well"><b>' + item.fr + '</b><br><i>' + shown + '</i></div>' +
      '<div class="row wrap">' +
      '<button class="btn" id="tfTrue">True</button>' +
      '<button class="btn bad" id="tfFalse">False</button>' +
      '<span class="pill" id="tfRes">—</span>' +
      '</div>';
    var ok = false, done = false;
    function mark(ansTrue) {
      if (done) return;
      ok = (useTrue && ansTrue) || (!useTrue && !ansTrue);
      div.querySelector("#tfRes").textContent = ok ? "✅ Correct" : (useTrue ? "❌ It was True" : "❌ It was False");
      done = true;
    }
    div.querySelector("#tfTrue").onclick = function () { mark(true); };
    div.querySelector("#tfFalse").onclick = function () { mark(false); };
    return { el: div, isCorrect: function () { return ok; }, isDone: function () { return done; } };
  }

  function saView(item) {
    var target = norm(item.en);
    var div = document.createElement("div");
    div.innerHTML =
      '<div class="small muted">Short Answer — Translate to English</div>' +
      '<div class="well"><b>' + item.fr + '</b></div>' +
      '<textarea id="saIn" class="mono" rows="3" placeholder="Type your translation…"></textarea>' +
      '<div class="row"><button class="btn" id="saCheck">Check</button><span class="pill" id="saRes">—</span></div>';
    var ok = false, done = false;
    div.querySelector("#saCheck").onclick = function () {
      if (done) return;
      var ans = norm(div.querySelector("#saIn").value);
      var tksT = target.split(" ");
      var tksA = ans.split(" ");
      var inter = 0, i;
      for (i = 0; i < tksA.length; i++) { if (tksT.indexOf(tksA[i]) > -1) inter++; }
      var score = Math.round(100 * inter / Math.max(1, tksT.length));
      ok = score >= 60;
      div.querySelector("#saRes").textContent = ok ? "✅ ~" + score + "% overlap" : "❌ ~" + score + "% (≥60% to pass)";
      done = true;
    };
    return { el: div, isCorrect: function () { return ok; }, isDone: function () { return done; } };
  }

  function pickTypes(n) {
    var types = ["mcq", "cloze", "tf", "sa"], out = [], i;
    for (i = 0; i < n; i++) out.push(types[i % types.length]);
    return shuffle(out);
  }

  function bootDaily() {
    if ((document.body.dataset.page || "") !== "comprehension") return;
    var ui = injectDailyUI(); if (!ui) return;
    var body = $("#cddBody"), prog = $("#cddProg"), msg = $("#cddMsg");
    var btnStart = $("#cddStart"), btnNext = $("#cddNext");

    loadPairs().then(function (BANK) {
      var PLAN = [], ITEMS = [], cur = 0, correct = 0;

      function renderItem() {
        if (cur >= ITEMS.length) {
          body.innerHTML = '<div class="small">Done! Score: ' + correct + '/' + ITEMS.length + '</div>';
          btnNext.disabled = true;
          msg.textContent = "✅ +10 xp";
          bumpXP(10); bumpAward("comp", 1);
          logCanDo("reading:short_texts");
          return;
        }
        var it = ITEMS[cur];
        prog.textContent = (cur + 1) + "/" + ITEMS.length;
        msg.textContent = "Type: " + it.type.toUpperCase();
        body.innerHTML = "";
        body.appendChild(it.view.el);
        btnNext.disabled = false;
      }

      btnStart.onclick = function () {
        var n = 6 + Math.floor(Math.random() * 2); // 6–7 items
        PLAN = pickTypes(n);
        var seedIndex = parseInt(today().replace(/-/g, ""), 10) % BANK.length;
        var pool = [], i;
        for (i = 0; i < n; i++) { pool.push(BANK[(seedIndex + i * 37) % BANK.length]); }
        ITEMS = PLAN.map(function (t, i) {
          var item = pool[i];
          if (t === "mcq") return { type: t, view: mcqView(item, BANK) };
          if (t === "cloze") return { type: t, view: clozeView(item) };
          if (t === "tf") return { type: t, view: tfView(item, BANK) };
          return { type: "sa", view: saView(item) };
        });
        cur = 0; correct = 0; renderItem();
      };

      btnNext.onclick = function () {
        var v = ITEMS[cur] && ITEMS[cur].view;
        if (!v) return;
        if (!v.isDone || !v.isDone()) { msg.textContent = "Answer first."; return; }
        if (v.isCorrect && v.isCorrect()) correct++;
        cur++; renderItem();
      };
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootDaily);
  } else {
    bootDaily();
  }
})();
​
 /* =========================
   Acceptance Criteria + UI Tweaks + Content Packs
   (SAFE version: no template strings)
   ========================= */
(function(){
  "use strict";

  // ---------- utils ----------
  function $(s,r){ return (r||document).querySelector(s); }
  function $$(s,r){ return Array.from((r||document).querySelectorAll(s)); }
  function today(){ return new Date().toISOString().slice(0,10); }
  function fmt(d){ return new Date(d).toISOString().slice(0,10); }
  function words(t){ return (t||"").trim().split(/\s+/).filter(Boolean); }
  function shuffle(a){ var x=a.slice(), i, j, t; for(i=x.length-1;i>0;i--){ j=Math.floor(Math.random()*(i+1)); t=x[i]; x[i]=x[j]; x[j]=t; } return x; }

  // ---------- storage & keys ----------
  var store2 = (typeof store!=="undefined") ? store : {
    get:function(k,d){ try{var v=localStorage.getItem(k); return v==null?d:JSON.parse(v);}catch(e){return d;} },
    set:function(k,v){ try{localStorage.setItem(k, JSON.stringify(v));}catch(e){} }
  };
  var K2 = (typeof K!=="undefined") ? K : {};
  K2.goal       = K2.goal       || "fj_goal_xp";
  K2.xp         = K2.xp         || "fj_xp_by_day";
  K2.aw         = K2.aw         || "fj_awards_by_day";
  K2.vocab      = K2.vocab      || "fj_vocab";
  K2.vocabProg  = K2.vocabProg  || "fj_vocab_prog";
  K2.listenProg = K2.listenProg || "fj_listen_prog";
  K2.speakProg  = K2.speakProg  || "fj_speak_prog";
  K2.weekTask   = K2.weekTask   || "fj_week_task";
  K2.canDo      = K2.canDo      || "fj_can_do";
  // new
  K2.session    = "fj_daily_session";
  K2.wpmLast    = "fj_wpm_last";
  K2.weekOpin   = "fj_week_opinions2";
  K2.phrOverride= "fj_phr_override";

  function xpMap(){ return store2.get(K2.xp,{}); }
  function awMap(){ return store2.get(K2.aw,{}); }

  function weekStart(d){
    d = d || new Date();
    var day = (d.getDay()+6)%7; // Mon=0
    var s = new Date(d); s.setHours(0,0,0,0); s.setDate(s.getDate()-day);
    return fmt(s);
  }
  function lastNDays(n, getter){
    var out=[], i; 
    for(i=n-1;i>=0;i--){ var dt=new Date(); dt.setDate(dt.getDate()-i); var k=fmt(dt); out.push(getter(k)); }
    return out;
  }

  // ---------- acceptance calculation ----------
  function computeAcceptance(){
    var d=today();
    var V = store2.get(K2.vocabProg,{}); var vToday=V[d]||{reviews:0, know:0, dk:0};
    var L = store2.get(K2.listenProg,{}); var lToday=L[d]||{done:0, avg:0};
    var S = store2.get(K2.speakProg,{}); var sToday=S[d]||{seconds:0};
    var A = awMap()[d]||{};

    var daily = {
      vocab10 : (vToday.reviews||0) >= 10,
      compSet : (A.comp||0) >= 1,
      speak60 : (sToday.seconds||0) >= 60 || (A.speak60||0) >= 1,
      listen3 : (lToday.done||0) >= 3
    };

    var wk = weekStart();
    var WTask = (store2.get(K2.weekTask,{}))[wk] || {status:"pending", seconds:0};
    var opinions2 = !!(store2.get(K2.weekOpin,{}))[wk];

    var s7 = lastNDays(7, function(k){ return (S[k]&&S[k].seconds)||0; });
    var speakAvg7 = Math.round( (s7.reduce(function(a,b){return a+b;},0)/7) / 60 );

    var lsDays = lastNDays(7, function(k){ return L[k]||{done:0,avg:0}; });
    var tot=0, cnt=0; 
    lsDays.forEach(function(x){ if(x.done>0){ tot += (x.avg||0)*x.done; cnt += x.done; } });
    var listenAvgW = Math.round( tot / Math.max(1,cnt) );

    var deck = store2.get(K2.vocab,[]);
    var dueCount = deck.filter(function(c){ return c.due ? (fmt(c.due) <= d) : true; }).length;
    var leeches  = deck.filter(function(c){ return c.tag==="leech"; }).length;
    var leechPct = Math.round(100 * (leeches/Math.max(1, deck.length)));

    var wpm = Number(store2.get(K2.wpmLast,0));

    var weekly = {
      mock15   : (WTask.status==="completed" && WTask.seconds>=900),
      speakAvg : speakAvg7 >= 7,
      wpmRange : (wpm>=110 && wpm<=150),
      opinions : opinions2,
      listen80 : listenAvgW >= 80,
      listenFullToday : daily.listen3,
      vocabDueOk : dueCount < 150,
      leechOk    : leechPct < 5
    };
    return {daily:daily, weekly:weekly, values:{speakAvg7:speakAvg7, listenAvgW:listenAvgW, dueCount:dueCount, leechPct:leechPct, wpm:wpm, wkStatus:WTask.status, wkSecs:WTask.seconds}};
  }

  // ---------- B2 Readiness (Dashboard) ----------
  function injectReadiness(){
    if((document.body.dataset.page||"")!=="dashboard") return;
    if($("#b2Ready")) return;
    var container = $(".container"); if(!container) return;

    var card=document.createElement("section");
    card.className="card";
    card.id="b2Ready";
    card.innerHTML = '<h2>B2 Readiness — Acceptance Criteria</h2><div id="b2Daily"></div><div id="b2Weekly" style="margin-top:.75rem"></div>';
    container.insertBefore(card, container.children[2]||null);

    function row(ok,label,detail){
      return '<div class="row wrap small">'
        + '<span class="pill ' + (ok?'ok':'') + '">' + (ok?'✅ Met':'⏳ Not yet') + '</span>'
        + '<span class="muted">' + label + (detail?(' — <b>'+detail+'</b>'):'') + '</span>'
        + '</div>';
    }

    function render(){
      var C=computeAcceptance(), d=C.daily, w=C.weekly, v=C.values;
      $('#b2Daily').innerHTML =
        '<h3>Today</h3>'
        + row(d.vocab10, 'Vocab: >=10 reviews')
        + row(d.compSet, 'Comprehension: 5–7 item set complete')
        + row(d.speak60, 'Speaking: >= 60s')
        + row(d.listen3, 'Listening: 3 items complete');

      $('#b2Weekly').innerHTML =
        '<h3>This week</h3>'
        + row(w.mock15, 'Mock conversation: >=15 min', 'current ' + ((v.wkSecs/60)|0) + ' min • ' + v.wkStatus)
        + row(w.speakAvg, '7-day speaking average >= 7 min/day', String(v.speakAvg7) + ' min/day')
        + row(w.wpmRange, 'Read-aloud WPM in 110–150', String(v.wpm||0) + ' wpm')
        + row(w.opinions, 'Recorded >=2 opinion phrases in weekly task')
        + row(w.listen80, 'Listening accuracy >= 80% (7d avg)', String(v.listenAvgW) + '%')
        + row(w.listenFullToday, 'Today’s Listening: 3/3')
        + row(w.vocabDueOk, 'Vocabulary due count < 150', String(v.dueCount))
        + row(w.leechOk, 'Leeches < 5%', String(v.leechPct) + '%');
    }
    render();
    setInterval(render, 2000);
  }

  // ---------- Daily Session (Dashboard -> chain pages) ----------
  function injectDailySessionButton(){
    if((document.body.dataset.page||"")!=="dashboard") return;
    if($("#startChain")) return;
    var container = $(".container"); if(!container) return;
    var card = document.createElement("section");
    card.className="card";
    card.innerHTML =
      '<h2>Daily Session</h2>'
      + '<div class="row wrap"><button class="btn" id="startChain">▶️ Start Daily Session</button><span id="chainState" class="pill">—</span></div>'
      + '<p class="muted small">Runs Vocab -> Comprehension -> Speaking -> Listening -> Phrases automatically. You may need to allow mic.</p>';
    container.insertBefore(card, container.firstChild);
    $("#startChain").onclick = function(){
      var sess = {active:true, idx:0, steps:['vocab','comprehension','speaking','listening','phrases'], created:Date.now()};
      store2.set(K2.session, sess);
      $("#chainState").textContent = "Running…";
      location.href = 'vocabulary.html?daily=1';
    };
  }

  function chainOverlay(step){
    var bar=document.createElement('div');
    bar.id='chainBar';
    bar.style.cssText='position:fixed;bottom:10px;left:10px;right:10px;background:#0e1730;border:1px solid #25325a;border-radius:10px;padding:.5rem;display:flex;gap:.5rem;align-items:center;z-index:9999';
    bar.innerHTML = '<span class="pill">Daily Session</span><span>Step: <b>'+step+'</b></span><span id="chainInfo" class="small muted">working…</span>';
    document.body.appendChild(bar);
    return {
      setInfo:function(t){ var n=$("#chainInfo"); if(n) n.textContent=t; },
      done:function(){ try{document.body.removeChild(bar);}catch(e){} }
    };
  }

  function runChainIfNeeded(){
    var sess = store2.get(K2.session,null);
    if(!sess || !sess.active) return;
    var page=document.body.dataset.page||'';
    var steps=sess.steps||[];
    var step=steps[sess.idx]||'';
    if(page!==step) return;

    var overlay = chainOverlay(step);

    function next(){
      sess.idx++; store2.set(K2.session, sess);
      var nextStep = steps[sess.idx];
      if(!nextStep){
        store2.set(K2.session, {active:false});
        overlay.setInfo('All done! 🎉');
        setTimeout(function(){ overlay.done(); location.href='index.html'; }, 900);
        return;
      }
      var map = {vocab:'vocabulary.html', comprehension:'comprehension.html', speaking:'speaking.html', listening:'listening.html', phrases:'phrases.html'};
      var extra = (nextStep==='vocab') ? '?daily=1' : (nextStep==='listening' ? '?daily=1' : '');
      location.href = map[nextStep] + extra;
    }

    if(step==='vocab'){
      var btn = $('#startQuiz'); if(btn && btn.click) btn.click();
      overlay.setInfo('Do 10 reviews…');
      var iv1=setInterval(function(){
        var prog = store2.get(K2.vocabProg,{});
        var v=prog[today()]||{reviews:0};
        if((v.reviews||0)>=10){ clearInterval(iv1); next(); }
      }, 1500);
    }
    else if(step==='comprehension'){
      overlay.setInfo('Complete Daily Mix (6–7 items)…');
      setTimeout(function(){ var x=$('#cddStart'); if(x && x.click) x.click(); }, 500);
      var base = (awMap()[today()]||{}).comp||0;
      var iv2=setInterval(function(){
        var now = (awMap()[today()]||{}).comp||0;
        if(now>=base+1){ clearInterval(iv2); next(); }
      }, 1500);
    }
    else if(step==='speaking'){
      overlay.setInfo('Speak >=60 seconds (allow mic)…');
      var baseS = (store2.get(K2.speakProg,{}))[today()] && (store2.get(K2.speakProg,{}))[today()].seconds || 0;
      var iv3=setInterval(function(){
        var v=(store2.get(K2.speakProg,{}))[today()]; v = v ? v.seconds||0 : 0;
        if(v-baseS>=60){ clearInterval(iv3); next(); }
      }, 1500);
    }
    else if(step==='listening'){
      overlay.setInfo('Finish 3 daily listening items…');
      var tab=document.querySelector('[data-t="daily"]'); if(tab && tab.click) tab.click();
      var iv4=setInterval(function(){
        var v=(store2.get(K2.listenProg,{}))[today()]; v = v ? v.done||0 : 0;
        if(v>=3){ clearInterval(iv4); next(); }
      }, 1500);
    }
    else if(step==='phrases'){
      overlay.setInfo('Play today’s phrase set…');
      setTimeout(function(){ var x=$('#speakAllPhrases'); if(x && x.click) x.click(); }, 600);
      var baseP=(awMap()[today()]||{}).phrSet||0;
      var iv5=setInterval(function(){
        var now=(awMap()[today()]||{}).phrSet||0;
        if(now>=baseP+1){ clearInterval(iv5); next(); }
      }, 1500);
    }
  }

  // ---------- Phrases: Content Packs ----------
  function injectPacks(){
    if((document.body.dataset.page||"")!=='phrases') return;
    if($('#packCard')) return;
    var main=$('.container'); if(!main) return;

    function load(url, cb){
      fetch(url).then(function(r){ return r.json(); }).then(function(js){ cb(js); })
      .catch(function(){ cb([]); });
    }

    var connectors=[], opinions=[], hedging=[], funcs=[];
    load('data/pack_connectors.json', function(x){ connectors=x||[]; });
    load('data/pack_opinions.json',  function(x){ opinions=x||[];   });
    load('data/pack_hedging.json',   function(x){ hedging=x||[];    });
    load('data/pack_functions.json', function(x){ funcs=x||[];      });

    var card=document.createElement('section');
    card.className='card';
    card.id='packCard';
    card.innerHTML =
      '<h2>Content Packs</h2>'
      + '<div class="row wrap small">'
      +   '<label><input type="checkbox" id="pkConn"> Connectors</label>'
      +   '<label><input type="checkbox" id="pkOpin"> Opinions</label>'
      +   '<label><input type="checkbox" id="pkHedge"> Hedging</label>'
      +   '<label><input type="checkbox" id="pkFunc"> Functional</label>'
      + '</div>'
      + '<div class="row"><button id="pkMake" class="btn">Use these packs today</button><button id="pkSpeak" class="btn">🔊 Speak All (packs)</button></div>'
      + '<div class="small muted">Pack phrases are additional to your daily set. Speaking them awards +10 xp once.</div>'
      + '<div id="pkList"></div>';
    main.appendChild(card);

    function chosen(){
      var out=[];
      if($('#pkConn').checked) out=out.concat(connectors);
      if($('#pkOpin').checked) out=out.concat(opinions);
      if($('#pkHedge').checked) out=out.concat(hedging);
      if($('#pkFunc').checked) out=out.concat(funcs);
      return shuffle(out).slice(0,12);
    }

    $('#pkMake').onclick = function(){
      var arr = chosen();
      store2.set(K2.phrOverride, {d:today(), list:arr});
      $('#pkList').innerHTML = arr.map(function(p,i){ return '<div class="row"><span class="pill small">'+(i+1)+'</span><span>'+p+'</span></div>'; }).join('');
      alert('Pack loaded for today.');
    };

    $('#pkSpeak').onclick = function(){
      var ov = store2.get(K2.phrOverride,{});
      var list = (ov.d===today() && Array.isArray(ov.list) && ov.list.length) ? ov.list : chosen();
      $('#pkList').innerHTML = list.map(function(p,i){ return '<div class="row"><span class="pill small">'+(i+1)+'</span><span>'+p+'</span></div>'; }).join('');
      var i=0;
      (function step(){
        if(i>=list.length){
          var a=awMap(); var d=today(); a[d]=a[d]||{}; a[d].phrSet = Math.min(2, (a[d].phrSet||0)+1); store2.set(K2.aw,a);
          var x=xpMap(); x[d]=(x[d]||0)+10; store2.set(K2.xp,x);
          alert('Packs complete! (+10 xp)');
          return;
        }
        try{
          var u=new SpeechSynthesisUtterance(list[i]); u.lang='fr-FR'; speechSynthesis.speak(u);
          u.onend=function(){ i++; setTimeout(step,300); };
        }catch(e){ i++; setTimeout(step,200); }
      })();
    };
  }

  // ---------- Speaking tools (WPM + opinions checkbox) ----------
  function injectSpeakingTools(){
    if((document.body.dataset.page||"")!=='speaking') return;
    var main=$('.container'); if(!main) return;
    if($('#wpmCard')) return;

    function load(url, cb, fb){ 
      fetch(url).then(function(r){ return r.json(); }).then(function(js){ cb(js); })
      .catch(function(){ cb(fb||[{fr:"Le français est une belle langue à pratiquer chaque jour."}]); });
    }

    load('data/read_aloud.json', function(texts){
      var card=document.createElement('section');
      card.className='card';
      card.id='wpmCard';
      card.innerHTML =
        '<h2>Read-Aloud Test</h2>'
        + '<div class="row wrap"><select id="wpmPick" class="input"></select><button id="wpmStart" class="btn">Start</button><button id="wpmStop" class="btn bad">Stop</button><span id="wpmOut" class="pill">—</span></div>'
        + '<div id="wpmText" class="well small"></div>';
      main.appendChild(card);

      var sel=$('#wpmPick'); texts.slice(0,8).forEach(function(t,i){
        var wc=words(t.fr).length; var opt=document.createElement('option');
        opt.value=String(i); opt.textContent='#'+(i+1)+' — '+wc+' words'; sel.appendChild(opt);
      });
      function show(){ var t=texts[Number(sel.value)||0]; $('#wpmText').textContent = t.fr; }
      sel.onchange=show; show();

      var timer=null, started=0;
      $('#wpmStart').onclick=function(){ started=Date.now(); clearInterval(timer);
        timer=setInterval(function(){ var sec=Math.round((Date.now()-started)/1000); $('#wpmOut').textContent = sec+'s'; },250);
      };
      $('#wpmStop').onclick=function(){
        clearInterval(timer); var t=texts[Number(sel.value)||0]; var wc=words(t.fr).length;
        var sec=Math.max(1, Math.round((Date.now()-started)/1000)); var wpm=Math.round(wc/(sec/60));
        store2.set(K2.wpmLast,wpm); $('#wpmOut').textContent = wpm+' wpm'; alert('Estimated '+wpm+' WPM');
      };
    });

    var wk=weekStart();
    var op=document.createElement('section'); op.className='card';
    op.innerHTML='<h2>Weekly Task Checklist</h2><label><input type="checkbox" id="opin2"> I used >=2 opinion phrases (e.g., "à mon avis", "je trouve que").</label>';
    main.appendChild(op);
    $('#opin2').checked = !!(store2.get(K2.weekOpin,{}))[wk];
    $('#opin2').onchange = function(){
      var m=store2.get(K2.weekOpin,{}); m[wk]= !!$('#opin2').checked; store2.set(K2.weekOpin,m);
    };
  }

  // ---------- style hook (for green pill) ----------
  function injectStyle(){
    if(document.getElementById('criteriaStyle')) return;
    var s=document.createElement('style');
    s.id='criteriaStyle';
    s.textContent = '#b2Ready .pill.ok{ background:#163a2f; border-color:#215c4a;} #chainBar .pill{ display:inline-block; padding:.25rem .6rem; border:1px solid #2a3a5a; border-radius:999px; }';
    document.head.appendChild(s);
  }

  // ---------- boot ----------
  function boot(){
    injectStyle();
    injectReadiness();
    injectDailySessionButton();
    runChainIfNeeded();
    injectPacks();
    injectSpeakingTools();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
