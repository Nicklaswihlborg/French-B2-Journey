/* French B2 Journey — Listening rebuilt (daily exercises + news) + progress memory (vocab & listening) */
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
    const clear=()=>{try{localStorage.clear()}catch{}for(const k in mem)delete mem[k]};
    return {get,set,clear,isPersistent:()=>p};
  })();

  // ---------- keys ----------
  const K={
    goal:'fj_goal_xp', xp:'fj_xp_by_day', aw:'fj_awards_by_day', b2:'fj_b2_target',
    vocab:'fj_vocab', compDeck:'fj_comp_deck',
    listenProg:'fj_listen_prog', vocabProg:'fj_vocab_prog'
  };
  // defaults
  if(store.get(K.goal)==null) store.set(K.goal,30);
  if(store.get(K.xp)==null)   store.set(K.xp,{});
  if(store.get(K.aw)==null)   store.set(K.aw,{});
  if(store.get(K.b2)==null)   store.set(K.b2,new Date(new Date().getFullYear(),11,31).toISOString().slice(0,10));
  if(store.get(K.vocab)==null)store.set(K.vocab,[]);

  // ---------- XP & progress ----------
  const xpMap=()=>store.get(K.xp,{}), awMap=()=>store.get(K.aw,{});
  const getXP=(d=today())=>xpMap()[d]||0;
  const setXP=(v,d=today())=>{const m=xpMap();m[d]=v;store.set(K.xp,m);};
  function award(tag,amount=5,limit=Infinity){const d=today(); const a=awMap(); a[d]=a[d]||{}; a[d][tag]=a[d][tag]||0; if(a[d][tag]>=limit) return; setXP(getXP(d)+amount,d); a[d][tag]+=1; store.set(K.aw,a);}

  function logListen(fn){ const d=today(); const p=store.get(K.listenProg,{}); p[d]=p[d]||{done:0, best:0, avg:0, total:0, news:0, minutes:0}; fn(p[d]); store.set(K.listenProg,p); }
  function logVocab(fn){ const d=today(); const p=store.get(K.vocabProg,{}); p[d]=p[d]||{reviews:0, know:0, dk:0}; fn(p[d]); store.set(K.vocabProg,p); }

  // ---------- TTS queue ----------
  let frVoice=null; try{speechSynthesis.onvoiceschanged=()=>{const vs=speechSynthesis.getVoices(); frVoice=vs.find(v=>/^fr/i.test(v.lang))||null;};}catch{}
  function speakOne(text,rate=1){try{const u=new SpeechSynthesisUtterance(text);u.lang='fr-FR';u.rate=rate;if(frVoice)u.voice=frVoice;speechSynthesis.speak(u);return u;}catch{return null}}
  let q=[], playing=false, stopFlag=false;
  function playQueue(list,rate=1,interval=800,doneCb){ stopQueue(); q=list.slice(); stopFlag=false; function next(){ if(stopFlag||!q.length){ playing=false; doneCb&&doneCb(); return; } const t=q.shift(); const u=speakOne(t,rate); playing=true; if(!u){playing=false;return;} u.onend=()=>{ if(stopFlag){playing=false;return;} setTimeout(next,interval); }; u.onerror=()=>setTimeout(next,interval); } next(); }
  function stopQueue(){try{stopFlag=true; speechSynthesis.cancel();}catch{} playing=false; q.length=0;}

  // ---------- fetch JSON with fallback ----------
  async function fetchJSON(path,fb){try{const r=await fetch(path,{cache:'no-store'}); if(!r.ok) throw 0; return await r.json();}catch{return fb}}

  // ---------- VOCAB (progress hooks kept minimal) ----------
  function deck(){return store.get(K.vocab,[])} function saveDeck(d){store.set(K.vocab,d)}
  function dueCount(){const t=today(); return deck().filter(w=>w.due<=t).length}
  function srsRate(card,grade){
    if(grade<3){card.reps=0; card.interval=1; card.ease=Math.max(1.3,(card.ease||2.5)-0.2); card.leech=(card.leech||0)+1;}
    else{card.reps=(card.reps||0)+1; if(card.reps===1) card.interval=1; else if(card.reps===2) card.interval=3; else card.interval=Math.round((card.interval||1)*(card.ease||2.5)); card.ease=Math.min(3.2,(card.ease||2.5)+(grade===4?0.15:0));}
    card.due=fmt(addDays(new Date(),card.interval||1));
  }

  // Attach small hooks to your existing vocab UI (if present)
  function attachVocabProgress(){
    // Quick Review
    $('#qr-dk') && ($('#qr-dk').onclick = (prev => (e)=>{ prev?.(e); logVocab(s=>{s.reviews++; s.dk++;}); })( $('#qr-dk').onclick ));
    $('#qr-know') && ($('#qr-know').onclick = (prev => (e)=>{ prev?.(e); logVocab(s=>{s.reviews++; s.know++;}); })( $('#qr-know').onclick ));
    // Classic
    $('#rateAgain') && ($('#rateAgain').onclick = (prev => (e)=>{ prev?.(e); logVocab(s=>{s.reviews++; s.dk++;}); })( $('#rateAgain').onclick ));
    $('#rateGood') && ($('#rateGood').onclick = (prev => (e)=>{ prev?.(e); logVocab(s=>{s.reviews++; s.know++;}); })( $('#rateGood').onclick ));
    $('#rateEasy') && ($('#rateEasy').onclick = (prev => (e)=>{ prev?.(e); logVocab(s=>{s.reviews++; s.know++;}); })( $('#rateEasy').onclick ));
  }

  // ---------- LISTENING ----------
  async function initListening(){
    if(document.body.dataset.page!=='listening') return;

    // Tabs
    const tabs=$$('.tabs .tab'); const panes={daily:$('#pane-daily'),news:$('#pane-news'),bank:$('#pane-bank')};
    tabs.forEach(t=>t.onclick=()=>{tabs.forEach(x=>x.classList.remove('active')); t.classList.add('active'); Object.values(panes).forEach(p=>p.style.display='none'); panes[t.dataset.t].style.display='';});

    // Load data
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

    // ---------- Daily Set (3 items, deterministic by date) ----------
    function dailyPick(){
      const seed=parseInt(today().replace(/-/g,''),10);
      const idxs=new Set(); let i=0;
      while(idxs.size<3 && idxs.size<items.length){ idxs.add((Math.abs(Math.sin(seed+i))*10000|0)%items.length); i++; }
      return [...idxs].map(i=>items[i]);
    }
    function renderDaily(){
      const wrap=$('#dailyWrap'); wrap.innerHTML='';
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
        `;
        const play=block.querySelector('.play'), rep=block.querySelector('.replay'), ans=block.querySelector('.ans'), chk=block.querySelector('.check'), sc=block.querySelector('.score');
        let last=null; play.onclick=()=>{ try{speechSynthesis.cancel(); last=speakOne(it.text,.98);}catch{} };
        rep.onclick=()=>{ try{ last ? speechSynthesis.speak(last) : play.onclick(); }catch{} };
        chk.onclick=()=>{ const tgt=(it.text||'').toLowerCase(); const g=(ans.value||'').toLowerCase();
          const A=tgt.replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/), B=g.replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/);
          const set=new Set(A); let m=0; B.forEach(w=>set.has(w)&&m++); const score=A.length?Math.round(m/A.length*100):0; sc.textContent=`Score: ${score}%`;
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
      $('#dailyProgress').textContent = `Completed: ${d.done||0}/3`;
      $('#dailyAvg').textContent = `Avg score: ${d.avg||0}%`;
    }
    $('#dailyRefresh').onclick=()=>{ renderDaily(); };

    // ---------- News Briefing ----------
    function getBriefing(topic){
      const arr=NEWS[topic]||NEWS.france||[];
      const idx=(parseInt(today().replace(/-/g,''),10)+arr.length)%Math.max(1,arr.length);
      const lines = [arr[idx], arr[(idx+1)%arr.length]].filter(Boolean);
      return lines;
    }
    $('#newsPlayAll').onclick=()=>{
      const t=$('#newsTopic').value; const lines=getBriefing(t);
      $('#newsTranscript').value = lines.join('\n\n');
      const minutesEst = Math.max(1, Math.round(words(lines.join(' ')).length/150)); // ~150 wpm estimate
      playQueue(lines,.98,600,()=>{ logListen(p=>{ p.news=1; p.minutes += minutesEst; }); award('listenTask',5,2); });
    };
    $('#newsStop').onclick=()=>stopQueue();

    // ---------- Practice Bank ----------
    let bankIdx=0, bankList=items.slice();
    function filterBank(){
      const lvl=$('#bankLevel').value;
      bankList = lvl==='all'? items.slice() : items.filter(x=>x.level===lvl);
      bankIdx=0; renderBank();
    }
    function renderBank(){
      if(!bankList.length){ $('#bankHint').textContent='No items'; $('#bankInput').value=''; $('#bankScore').textContent='Score: 0%'; return; }
      const it = bankList[bankIdx%bankList.length];
      $('#bankHint').textContent = `Hint: ${it.hint||''} • [${it.level}]`;
      $('#bankInput').value=''; $('#bankScore').textContent='Score: 0%';
      // preload last utterance
    }
    $('#bankLevel').onchange=filterBank;
    $('#bankNext').onclick=()=>{ bankIdx=(bankIdx+1)%Math.max(1,bankList.length); renderBank(); };
    $('#bankPlay').onclick=()=>{ const it=bankList[bankIdx%bankList.length]; speakOne(it.text,.98); };
    $('#bankReplay').onclick=()=>$('#bankPlay').onclick();
    $('#bankCheck').onclick=()=>{
      const it=bankList[bankIdx%bankList.length];
      const tgt=(it.text||'').toLowerCase(); const g=($('#bankInput').value||'').toLowerCase();
      const A=tgt.replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/), B=g.replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/);
      const set=new Set(A); let m=0; B.forEach(w=>set.has(w)&&m++); const score=A.length?Math.round(m/A.length*100):0;
      $('#bankScore').textContent=`Score: ${score}%`;
      logListen(p=>{ p.total += score; p.done = Math.min(3, Math.max(p.done,1)); p.best = Math.max(p.best,score); p.avg = Math.round(p.total/Math.max(1,p.done)); });
      updateDailyBadges();
      if(score>=60) award('listenTask',5,2);
    };

    // Boot page content
    renderDaily();
    filterBank();
  }

  // ---------- Minimal boot for other pages so nothing breaks ----------
  function boot(){
    attachVocabProgress();     // add progress hooks if vocab buttons exist
    initListening();           // build listening page if we are on it
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
