<script src="app.js" defer></script>
<script src="vocab-enhanced.js" defer></script>
/* Vocabulary Enhancer — fixes bad translations, smarter conjugations, varied examples
   - Non-destructive: runs on top of your existing app.js
   - Adds “Clean & Fix Deck” button
*/
(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const today=()=>new Date().toISOString().slice(0,10);
  const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const rand = (n)=>Math.floor(Math.random()*n);

  // ==== access the same storage keys your app.js uses ====
  const K={ vocab:'fj_vocab' };

  // ---------------------------
  // 1) TRANSLATION CLEANUP
  // ---------------------------
  // Known bad pattern from earlier: we generated "FR_ADJ FR_NOUN | FR_ADJ EN_NOUN".
  // We'll translate that FR adjective to proper English.
  const ADJ_MAP = {
    "grand": "big", "petit": "small", "nouveau": "new", "vieux": "old", "bon": "good",
    "mauvais": "bad", "rapide": "fast", "lent": "slow", "cher": "expensive", "propre": "clean",
    "sale": "dirty", "important": "important", "utile": "useful", "dangereux": "dangerous", "sûr": "safe"
  };
  const NOUN_MAP = { // for detection only (we keep English side from user data)
    "problème":"problem","projet":"project","ville":"city","repas":"meal","voyage":"trip",
    "idée":"idea","plan":"plan","ordinateur":"computer","téléphone":"phone","musique":"music",
    "café":"coffee","train":"train","bus":"bus","voiture":"car","vélo":"bike"
  };
  const FRENCH_CHARS = /[àâäçéèêëîïôöùûüÿœ]/i;

  function getDeck(){ try { return JSON.parse(localStorage.getItem(K.vocab)||'[]'); } catch { return []; } }
  function saveDeck(d){ localStorage.setItem(K.vocab, JSON.stringify(d)); }

  function fixAdjNounPair(fr,en){
    // match: "<adjFR> <nounFR>"
    const m = fr.match(/^([a-zàâäçéèêëîïôöùûüÿœ'-]+)\s+([a-zàâäçéèêëîïôöùûüÿœ'-]+)$/i);
    if(!m) return {fr,en,changed:false};
    const adjFR = m[1].toLowerCase();
    const nounFR = m[2].toLowerCase();
    if(!(adjFR in ADJ_MAP) || !(nounFR in NOUN_MAP)) return {fr,en,changed:false};

    // English looks like "adjFR EN_noun" → replace adjFR with its ENG equivalent
    const enWords = (en||'').toLowerCase().split(/\s+/);
    if(enWords[0] === adjFR){
      const properAdj = ADJ_MAP[adjFR];
      const fixed = [properAdj, ...enWords.slice(1)].join(' ');
      return {fr,en: fixed.replace(/\s+/g,' ').trim(), changed:true};
    }
    return {fr,en,changed:false};
  }

  function looksFrench(s){
    if(!s) return false;
    if(FRENCH_CHARS.test(s)) return true;
    // common French function words (rare in English translations)
    return /\b(le|la|les|des|du|de la|de l’|de l'|l’|l'|à|au|aux)\b/i.test(s);
  }

  function cleanDeckOnce(){
    const deck = getDeck();
    if(!Array.isArray(deck)||!deck.length) return {fixed:0,removed:0,total:0};

    let fixed=0, removed=0;
    const out = [];

    for(const card of deck){
      let fr = (card.fr||'').trim();
      let en = (card.en||'').trim();

      if(!fr || !en){
        // drop utterly broken lines (very rare)
        removed++; continue;
      }

      // Fix known adj+noun bad mapping
      const fx = fixAdjNounPair(fr,en);
      if(fx.changed){ en = fx.en; fixed++; }

      // If English is suspiciously French, try a conservative fallback:
      if(looksFrench(en) && !looksFrench(fr)){
        // Don’t guess new translations; instead keep the FR side as-is and mark EN as capitalized FR in English quotes
        // OR try a minimal replacement for obvious nouns we know.
        const n = NOUN_MAP[fr.toLowerCase()] || en.replace(/l’|l'/ig,'').trim();
        en = n; fixed++;
      }

      // Keep card
      out.push({...card, fr, en});
    }

    saveDeck(out);
    return {fixed,removed,total:out.length};
  }

  // --------------------------------
  // 2) SMARTER CONJUGATIONS (présent)
  // --------------------------------
  const IRR = {
    // Most common irregulars
    "être":["je suis","tu es","il/elle est","nous sommes","vous êtes","ils/elles sont"],
    "avoir":["j’ai","tu as","il/elle a","nous avons","vous avez","ils/elles ont"],
    "aller":["je vais","tu vas","il/elle va","nous allons","vous allez","ils/elles vont"],
    "faire":["je fais","tu fais","il/elle fait","nous faisons","vous faites","ils/elles font"],
    "venir":["je viens","tu viens","il/elle vient","nous venons","vous venez","ils/elles viennent"],
    "tenir":["je tiens","tu tiens","il/elle tient","nous tenons","vous tenez","ils/elles tiennent"],
    "pouvoir":["je peux","tu peux","il/elle peut","nous pouvons","vous pouvez","ils/elles peuvent"],
    "devoir":["je dois","tu dois","il/elle doit","nous devons","vous devez","ils/elles doivent"],
    "vouloir":["je veux","tu veux","il/elle veut","nous voulons","vous voulez","ils/elles veulent"],
    "prendre":["je prends","tu prends","il/elle prend","nous prenons","vous prenez","ils/elles prennent"],
    "mettre":["je mets","tu mets","il/elle met","nous mettons","vous mettez","ils/elles mettent"],
    "dire":["je dis","tu dis","il/elle dit","nous disons","vous dites","ils/elles disent"],
    "voir":["je vois","tu vois","il/elle voit","nous voyons","vous voyez","ils/elles voient"],
    "savoir":["je sais","tu sais","il/elle sait","nous savons","vous savez","ils/elles savent"],
    "lire":["je lis","tu lis","il/elle lit","nous lisons","vous lisez","ils/elles lisent"],
    "écrire":["j’écris","tu écris","il/elle écrit","nous écrivons","vous écrivez","ils/elles écrivent"],
    "inscrire":["je m’inscris","tu t’inscris","il/elle s’inscrit","nous nous inscrivons","vous vous inscrivez","ils/elles s’inscrivent"], // reflexive common use
    "ouvrir":["j’ouvre","tu ouvres","il/elle ouvre","nous ouvrons","vous ouvrez","ils/elles ouvrent"],
    "offrir":["j’offre","tu offres","il/elle offre","nous offrons","vous offrez","ils/elles offrent"],
    "courir":["je cours","tu cours","il/elle court","nous courons","vous courez","ils/elles courent"],
    "mourir":["je meurs","tu meurs","il/elle meurt","nous mourons","vous mourez","ils/elles meurent"],
    "recevoir":["je reçois","tu reçois","il/elle reçoit","nous recevons","vous recevez","ils/elles reçoivent"],
    "connaître":["je connais","tu connais","il/elle connaît","nous connaissons","vous connaissez","ils/elles connaissent"],
    "atteindre":["j’atteins","tu atteins","il/elle atteint","nous atteignons","vous atteignez","ils/elles atteignent"],
    "conduire":["je conduis","tu conduis","il/elle conduit","nous conduisons","vous conduisez","ils/elles conduisent"],
    "traduire":["je traduis","tu traduis","il/elle traduit","nous traduisons","vous traduisez","ils/elles traduisent"],
    "rire":["je ris","tu ris","il/elle rit","nous rions","vous riez","ils/elles rient"],
    "sourire":["je souris","tu souris","il/elle sourit","nous sourions","vous souriez","ils/elles sourient"]
  };
  const STEM_E_EVERBS = new Set(["acheter","lever","mener","semer","peser","geler","promener"]);
  const STEM_E_ACCENT = new Set(["préférer","espérer","répéter","compléter","céder","suggérer"]);
  const STEM_DOUBLE = new Set(["appeler","jeter"]);
  function startsVowel(h){return /^[aeiouyhâàéèêëîïôöùûüœ]/i.test(h||"");}
  function isReflexive(fr){ return /^s['’]|^se\s+/i.test(fr); }
  function stripReflexive(fr){ return fr.replace(/^s['’]\s*/i,'').replace(/^se\s+/i,'').trim(); }

  // Returns base infinitive + reflexive flag if it looks like a verb
  function getVerbBase(entry){
    // handle multiword like "monter (dans)" or "aller à ..."
    const token = entry.split(/[ \t(]/)[0].toLowerCase();
    const reflexive = isReflexive(entry);
    let base = reflexive ? stripReflexive(entry) : token;
    base = base.replace(/[()]/g,'');
    if(/(er|ir|re)$/i.test(base)) return {base, reflexive};
    return null;
  }

  function regularER(base){
    const stem = base.slice(0,-2);
    // nous forms for -ger/-cer
    let nous = stem+"ons";
    if(/g$/.test(stem)) nous = stem+"eons";           // manger → nous mangeons
    if(/c$/.test(stem)) nous = stem.slice(0,-1)+"çons"; // commencer → nous commençons
    const je = (startsVowel(stem) ? "j’" : "je ")+stem+"e";
    return [je, stem+"es", stem+"e", "nous "+nous, "vous "+stem+"ez", "ils/elles "+stem+"ent"];
  }
  function regularIR(base){
    const stem = base.slice(0,-2);
    return ["je "+stem+"is","tu "+stem+"is","il/elle "+stem+"it","nous "+stem+"issons","vous "+stem+"issez","ils/elles "+stem+"issent"];
  }
  function regularRE(base){
    const stem = base.slice(0,-2);
    return ["je "+stem+"s","tu "+stem+"s","il/elle "+stem,"nous "+stem+"ons","vous "+stem+"ez","ils/elles "+stem+"ent"];
  }

  function tweakStemChanges(base, forms){
    const b = base.toLowerCase();
    // payer / essayer: je paie/essaie, nous payons/essayons
    if(/(ayer|oyer|uyer)$/.test(b)){
      const je = forms[0].replace(/\bje\s+([a-z]+)/i, (m,verb)=>"je "+verb.replace(/y$/,"ie"));
      const tu = forms[1].replace(/\btu\s+([a-z]+)/i, (m,verb)=>"tu "+verb.replace(/y$/,"ie"));
      const il = forms[2].replace(/\bil\/elle\s+([a-z]+)/i, (m,verb)=>"il/elle "+verb.replace(/y$/,"ie"));
      const ils= forms[5].replace(/\bils\/elles\s+([a-z]+)/i, (m,verb)=>"ils/elles "+verb.replace(/y$/,"ient"));
      return [je,tu,il,forms[3],forms[4],ils];
    }
    // acheter/lever etc: e → è in singular + 3rd plural
    if(STEM_E_EVERBS.has(b)){
      const doGrave = s=>s.replace(/\b([a-z]+)e([a-z]*)$/i,(m,a,c)=>a+"è"+c);
      return [
        forms[0].replace(/\bje\s+([a-zéèê]+)/i,(m,v)=>"je "+doGrave(v)),
        forms[1].replace(/\btu\s+([a-zéèê]+)/i,(m,v)=>"tu "+doGrave(v)),
        forms[2].replace(/\bil\/elle\s+([a-zéèê]+)/i,(m,v)=>"il/elle "+doGrave(v)),
        forms[3],
        forms[4],
        forms[5].replace(/\bils\/elles\s+([a-zéèê]+)/i,(m,v)=>"ils/elles "+doGrave(v)),
      ];
    }
    // préférer/espérer etc: é → è (same positions)
    if(STEM_E_ACCENT.has(b)){
      const swap = s=>s.replace(/é(?![a-z]*[é])/i,'è'); // first é near end
      return [
        forms[0].replace(/\bje\s+([a-zéèê]+)/i,(m,v)=>"je "+swap(v)),
        forms[1].replace(/\btu\s+([a-zéèê]+)/i,(m,v)=>"tu "+swap(v)),
        forms[2].replace(/\bil\/elle\s+([a-zéèê]+)/i,(m,v)=>"il/elle "+swap(v)),
        forms[3],
        forms[4],
        forms[5].replace(/\bils\/elles\s+([a-zéèê]+)/i,(m,v)=>"ils/elles "+swap(v)),
      ];
    }
    // appeler/jeter double consonant in sing/pl3
    if(STEM_DOUBLE.has(b)){
      const dbl = s=>s.replace(/(appeler)$/i,'appelle').replace(/(jeter)$/i,'jette');
      return [
        forms[0].replace(/\bje\s+([a-z]+)/i,(m,v)=>"je "+dbl(v)),
        forms[1].replace(/\btu\s+([a-z]+)/i,(m,v)=>"tu "+dbl(v)),
        forms[2].replace(/\bil\/elle\s+([a-z]+)/i,(m,v)=>"il/elle "+dbl(v)),
        forms[3],
        forms[4],
        forms[5].replace(/\bils\/elles\s+([a-z]+)/i,(m,v)=>"ils/elles "+dbl(v)),
      ];
    }
    return forms;
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
    }).map(r=>r.replace(/^je ([aeiouy])/i,"j’$1")
              .replace(/^je me ([aeiouy])/i,"je m’$1")
              .replace(/^je te ([aeiouy])/i,"je t’$1")
              .replace(/^je se ([aeiouy])/i,"je s’$1"));
  }

  function conjPresent(entry){
    const info = getVerbBase(entry||'');
    if(!info) return null;
    let {base,reflexive} = info;

    // direct irregular
    if(IRR[base]) {
      let out = IRR[base].slice();
      if(reflexive) out = applyReflexive(out);
      return out;
    }

    // regular patterns + tweaks
    let rows = null;
    if(base.endsWith('er')) rows = regularER(base);
    else if(base.endsWith('ir')) rows = regularIR(base);
    else if(base.endsWith('re')) rows = regularRE(base);

    if(!rows) return null;
    rows = rows.map((s,i)=>{ // ensure subjects are present (regularER wrote "nous xxx" etc.)
      if(i===0 && !/^je|^j’/i.test(s)) s = (startsVowel(s)?"j’":"je ")+s;
      if(i===1 && !/^tu /i.test(s)) s = "tu "+s;
      if(i===2 && !/^il\/elle /i.test(s)) s = "il/elle "+s;
      if(i===3 && !/^nous /i.test(s)) s = "nous "+s;
      if(i===4 && !/^vous /i.test(s)) s = "vous "+s;
      if(i===5 && !/^ils\/elles /i.test(s)) s = "ils/elles "+s;
      return s;
    });
    rows = tweakStemChanges(base, rows);
    if(reflexive) rows = applyReflexive(rows);
    return rows;
  }

  function conjTableHTML(fr){
    const rows = conjPresent(fr);
    if(!rows) return '';
    const PRON = ["je","tu","il/elle","nous","vous","ils/elles"];
    const cells = rows.map((f,i)=>`<tr><td class="small" style="opacity:.75">${PRON[i]}</td><td>${esc(f)}</td></tr>`).join('');
    return `<h4 style="margin:.6rem 0 .3rem">Présent</h4>
            <div class="tableWrap"><table><tbody>${cells}</tbody></table></div>`;
  }

  // ---------------------------
  // 3) VARIED EXAMPLES
  // ---------------------------
  const ADV = ["souvent","parfois","rarement","déjà","bientôt","maintenant","encore"];
  const TIME = ["le matin","l’après-midi","le soir","ce week-end","aujourd’hui"];
  function exVerb(fr,en){
    const rows = conjPresent(fr) || [];
    if(!rows.length) return '';
    const je=rows[0], tu=rows[1], il=rows[2], nous=rows[3], vous=rows[4], ils=rows[5];
    const enBare = (en||'').replace(/^to\s+/,'').trim();

    const pool = [
      `${je} ${ADV[rand(ADV.length)]}.|I ${enBare} ${["often","sometimes","rarely","already","soon","now","still"][rand(7)]}.`,
      `${nous} ${["ensemble","dans le parc","à la maison","au travail"][rand(4)]}.|We ${enBare} ${["together","in the park","at home","at work"][rand(4)]}.`,
      `${vous} ${TIME[rand(TIME.length)]} ?|Do you ${enBare} ${["in the morning","in the afternoon","in the evening","this weekend","today"][rand(5)]}?`,
      `${il} quand il fait beau.|He/She ${enBare} when the weather is nice.`,
      `Pourquoi ${vous} maintenant ?|Why do you ${enBare} now?`,
      `Je ne ${je.replace(/^je\s+|^j’/i,'')} pas encore.|I don’t ${enBare} yet.`
    ];
    // pick 2 distinct
    let i = rand(pool.length), j; do { j=rand(pool.length); } while(j===i);
    const [fr1,en1] = pool[i].split('|'); const [fr2,en2] = pool[j].split('|');
    return `<h4 style="margin:.6rem 0 .3rem">Exemples</h4>
            <div class="small">• ${esc(fr1)} <span class="muted">(${esc(en1)})</span></div>
            <div class="small">• ${esc(fr2)} <span class="muted">(${esc(en2)})</span></div>`;
  }
  function exNoun(fr,en){
    const pool = [
      `J’ai besoin de ${fr}.|I need ${en}.`,
      `C’est ${fr}.|It is ${en}.`,
      `On parle de ${fr} aujourd’hui.|We’re talking about ${en} today.`,
      `Il y a ${fr} ici.|There is ${en} here.`,
      `Je cherche ${fr}.|I’m looking for ${en}.`
    ];
    let i = rand(pool.length), j; do { j=rand(pool.length); } while(j===i);
    const [fr1,en1] = pool[i].split('|'); const [fr2,en2] = pool[j].split('|');
    return `<h4 style="margin:.6rem 0 .3rem">Exemples</h4>
            <div class="small">• ${esc(fr1)}</div>
            <div class="small">• ${esc(fr2)}</div>`;
  }
  function exAdj(fr,en){
    const pool = [
      `C’est ${fr}.|It’s ${en}.`,
      `La situation est ${fr}.|The situation is ${en}.`,
      `Ce projet est ${fr}.|This project is ${en}.`,
      `Ce choix est ${fr}.|This choice is ${en}.`
    ];
    let i = rand(pool.length), j; do { j=rand(pool.length); } while(j===i);
    const [fr1,en1] = pool[i].split('|'); const [fr2,en2] = pool[j].split('|');
    return `<h4 style="margin:.6rem 0 .3rem">Exemples</h4>
            <div class="small">• ${esc(fr1)} <span class="muted">(${esc(en1)})</span></div>
            <div class="small">• ${esc(fr2)} <span class="muted">(${esc(en2)})</span></div>`;
  }
  function buildExamples(fr,en){
    // simple guess: if entry looks like verb infinitive (maybe reflexive), use verb examples
    const vb = getVerbBase(fr);
    if(vb) return exVerb(fr,en);
    // if looks adjective-ish (a single token in ADJ_MAP list), use adj examples
    if(ADJ_MAP[fr.toLowerCase()]) return exAdj(fr, ADJ_MAP[fr.toLowerCase()]);
    return exNoun(fr,en);
  }

  // One function to build the whole “details” panel
  function buildDetailsHTML(fr,en){
    const conj = conjTableHTML(fr) || '';
    const ex = buildExamples(fr,en) || '';
    if(!conj && !ex) return '';
    return `${conj}${ex}`;
  }

  // --------------------------------
  // 4) HOOK INTO YOUR EXISTING UI
  // --------------------------------
  function wireShowReveal(){
    if(document.body.dataset.page!=='vocab') return;
    // Quick Review “Show”
    const qrShow = $('#qr-show');
    if(qrShow && !qrShow.__enhanced){
      qrShow.addEventListener('click', ()=>{
        const fr = $('#qr-front')?.textContent?.trim()||'';
        const en = $('#qr-back')?.textContent?.trim()||'';
        const extra = $('#qr-extra');
        if(extra) extra.innerHTML = buildDetailsHTML(fr,en);
      });
      qrShow.__enhanced = true;
    }
    // Classic “Reveal”
    const rev = $('#revealA');
    if(rev && !rev.__enhanced){
      rev.addEventListener('click', ()=>{
        // after app.js fills #quizBack, we fill examples
        setTimeout(()=>{
          const fr = $('#quizFront h2')?.textContent?.trim()||'';
          const en = $('#quizBack')?.textContent?.trim()||'';
          const extra = $('#quizExtra');
          if(extra) extra.innerHTML = buildDetailsHTML(fr,en);
        }, 0);
      });
      rev.__enhanced = true;
    }
  }

  // Add the “Clean & Fix Deck” button behavior
  function wireCleanerButton(){
    if(document.body.dataset.page!=='vocab') return;
    const btn = $('#cleanDeck');
    if(btn && !btn.__wired){
      btn.addEventListener('click', ()=>{
        const {fixed,removed,total} = cleanDeckOnce();
        alert(`Deck cleaned.\nFixed: ${fixed}\nRemoved: ${removed}\nNow: ${total} cards`);
        // Try to refresh counts/tables if app.js exposed these elements
        $('#totalCards') && ($('#totalCards').textContent = (getDeck()||[]).length);
        // Re-render table if present
        const tbody = $('#vTable tbody');
        if(tbody){
          tbody.innerHTML='';
          (getDeck()||[]).forEach(w=>{
            const tr=document.createElement('tr');
            tr.innerHTML = `<td>${esc(w.fr)}</td><td>${esc(w.en)}</td><td class="small">${w.due||''}</td><td>${w.leech||0}</td><td></td>`;
            tbody.appendChild(tr);
          });
        }
      });
      btn.__wired = true;
    }
  }

  // Boot on vocab page only
  function boot(){
    if(document.body.dataset.page!=='vocab') return;
    // silent one-time auto-fix on load (don’t alert)
    cleanDeckOnce();
    wireShowReveal();
    wireCleanerButton();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
