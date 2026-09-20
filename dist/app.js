import { createMatcher } from './matcher.js';
import { validateQuoteBank, createBankRefresher } from './quote-bank.js';

const el = id => document.getElementById(id);
let engine, quotes, moods, labels, analysis;
let recent = [], history = [], count = 0;

function bankStatus() {
  const books = new Set(quotes.map(quote=>quote.book)).size;
  el('load-status').textContent=`${quotes.length} lines from ${books} ${books===1?'book':'books'}. Your words stay on this device.`;
}
const refreshBank = createBankRefresher({
  load: async()=>{
    const response=await fetch('./quotes.json',{cache:'no-store'});
    if(!response.ok) throw new Error('Quote bank unavailable');
    return response.json();
  },
  validate: bank=>validateQuoteBank(bank,labels),
  apply: bank=>{ quotes=bank; bankStatus(); }
});
function refreshWhenReady() {
  if(engine && document.visibilityState==='visible') refreshBank().catch(()=>{});
}

function showScreen(name) {
  for (const screen of ['home','card','history']) el(`screen-${screen}`).hidden = name !== screen;
  const focus = name === 'home' ? el('mood-input') : name === 'card' ? el('card-quote-text') : el('history-title');
  focus.focus({preventScroll:true});
  window.scrollTo(0,0);
}

function displayQuote() {
  const quote = engine.pickQuote(analysis, quotes, recent);
  if (!quote) { el('load-status').textContent = 'No lines are available. Please reload to try again.'; return; }
  recent = [...recent,quote.id].slice(-8);
  history.unshift({quote,input:el('mood-input').value.trim(),label:analysis.primary ? moods[analysis.primary].label : 'A chance encounter'});
  history = history.slice(0,50);
  el('card-accession').textContent = 'No. '+String(++count).padStart(3,'0');
  el('card-quote-text').textContent = quote.text;
  el('card-book').textContent = quote.book;
  el('card-author').textContent = quote.author + (quote.author === 'Walker Percy' ? ' · Foreword' : '');
  const moodLabel = analysis.primary ? moods[analysis.primary].label.toLowerCase() : 'a chance encounter';
  el('card-tag').textContent = moodLabel;
  el('match-explanation').textContent = analysis.primary
    ? `Your words suggest ${[analysis.primary,...analysis.secondary].map(m=>moods[m].label.toLowerCase()).join(' / ')}. This line carries ${quote.tags.map(t=>labels[t].toLowerCase()).join(' / ')}.`
    : 'I could not place those words, so this is a chance encounter with the collection. Try a feeling, a short sentence, or ask for something funny.';
  el('match-detail').open=false;
  showScreen('card');
}

function renderHistory() {
  el('history-list').replaceChildren();
  el('history-empty').hidden=history.length>0;
  for (const item of history) {
    const article=document.createElement('article'); article.className='history-item';
    for (const [className,text] of [['date',item.label],['input',item.input],['quote',item.quote.text],['source',`${item.quote.book} — ${item.quote.author}`]]) {
      const p=document.createElement('p');p.className='history-item__'+className;p.textContent=text;article.append(p);
    }
    el('history-list').append(article);
  }
}

async function init() {
  try {
    [quotes,moods,labels] = await Promise.all(['quotes.json','moods.json','quote-tags.json'].map(async path=>{
      const response=await fetch(path,{cache:path==='quotes.json'?'no-store':'default'});
      if(!response.ok) throw new Error(`${path}: ${response.status}`);
      return response.json();
    }));
    validateQuoteBank(quotes,labels);
    engine=createMatcher(moods);
    el('btn-pull').disabled=false;
    bankStatus();
  } catch(error) {
    console.error(error);
    el('load-status').textContent='The collection could not load. Check your connection and reload to try again.';
    el('btn-retry').hidden=false;
  }
}

el('mood-form').addEventListener('submit',event=>{
  event.preventDefault();
  if(!engine) return;
  const input=el('mood-input').value.trim();
  if(!input){el('mood-input').focus();return;}
  analysis=engine.analyze(input);displayQuote();
});
el('mood-input').addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();el('mood-form').requestSubmit();}
});
el('btn-another').addEventListener('click',displayQuote);
el('btn-done').addEventListener('click',()=>showScreen('home'));
el('btn-history').addEventListener('click',()=>{renderHistory();showScreen('history');});
el('btn-back-from-history').addEventListener('click',()=>showScreen('home'));
el('btn-retry').addEventListener('click',()=>{el('btn-retry').hidden=true;el('load-status').textContent='Opening the collection…';init();});
init();
document.addEventListener('visibilitychange',refreshWhenReady);
window.addEventListener('pageshow',refreshWhenReady);
window.addEventListener('online',refreshWhenReady);
// Cache only the app's public files. Inputs and history are never persisted.
if('serviceWorker' in navigator && !['localhost','127.0.0.1','[::1]'].includes(location.hostname)) {
  navigator.serviceWorker.register('./sw.js',{type:'module',updateViaCache:'none'}).catch(()=>{});
}
