import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createMatcher} from '../dist/matcher.js';

const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url)));
const moods=read('../dist/moods.json'), quotes=read('../dist/quotes.json');
const engine=createMatcher(moods);

const cases = [
  ['I am happy','joy_gratitude'],
  ["I'm not happy and I'm ok with that.",'ennui'],
  ['I am miserable but I have made my peace with it','ennui'],
  ['Disappointed, but it is what it is','ennui'],
  ['I’m not really very happy, and I’m okay with it','ennui'],
  ['I am not happy','disappointment'],
  ['I am not unhappy',null],
  ['I am not sad',null],
  ['I am not anxious anymore','relief'],
  ["I don't feel happy or excited",'disappointment'],
  ['Neither happy nor sad', 'disappointment'],
  ['Not angry, just disappointed','disappointment'],
  ['Not angry just disappointed','disappointment'],
  ['I am not calm or peaceful','anxiety_fear'],
  ['I am not only happy but grateful','joy_gratitude'],
  ['I am not just happy, I am ecstatic','joy_gratitude'],
  ['I am not not happy','joy_gratitude'],
  ['I wish I were happy','disappointment'],
  ['I used to be happy but now I am miserable','grief_sadness'],
  ['Yesterday I was happy; today I am miserable','grief_sadness'],
  ['My friend is happy but I am lonely','loneliness'],
  ["I'm alone but not lonely",'calm_peace'],
  ["I'm not lonely, I like being alone",'calm_peace'],
  ['I enjoy my alone time','calm_peace'],
  ["I can't stop worrying",'anxiety_fear'],
  ['I have a knot in my stomach','anxiety_fear'],
  ['Everything is getting on my nerves','anger_frustration'],
  ['I am tired of this nonsense','anger_frustration'],
  ['I am tired','exhaustion_burnout'],
  ['I need a break','exhaustion_burnout'],
  ["I'm not tired of life, just tired",'exhaustion_burnout'],
  ['I miss my friends','loneliness'],
  ['I miss her','love_longing'],
  ['I miss home','nostalgia'],
  ['I miss the old days','nostalgia'],
  ['I miss the bus',null],
  ['I have a deadline','anxiety_fear'],
  ['I do not know what to do','confusion'],
  ['I feel numb','ennui'],
  ['Just going through the motions','ennui'],
  ['I want to stand up for myself','courage_resolve'],
  ['I will not give up','courage_resolve'],
  ['I am not giving up','courage_resolve'],
  ['I am proud of myself','pride'],
  ['I feel worthless','insecurity'],
  ['I am beating myself up','guilt_regret'],
  ['I need to be alone','social_fatigue'],
  ['I am sick of people','social_fatigue'],
  ['I feel relieved','relief'],
  ['Not too bad','relief'],
  ['I am okay','calm_peace'],
  ['I am fine','calm_peace'],
  ['I am cautiously hopeful','hope'],
  ['I am fascinated','wonder'],
  ['I am pondering life','reflection'],
  ['I am restless','restlessness'],
  ['I am grieving','grief_sadness'],
  ['I am sad, give me something funny','amusement'],
  ['I am grieving but I could use a laugh','amusement'],
  ['I am furious but I want a funny quote','amusement'],
  ['Make me laugh','amusement'],
  ['The sky is blue',null],
  ['The honorary president',null],
  ['I bought a wonderful blue hat',null],
  ['😢','grief_sadness'],
  ['😂','amusement'],
  ['',null],
  ['   ',null],
  ['glorp zzzxyz',null]
];
for (const [input,expected] of cases) test(`mood: ${input || '(empty)'}`,()=>{
  assert.equal(engine.analyze(input).primary,expected);
});

test('mixed emotions survive rather than being randomly collapsed',()=>{
  const a=engine.analyze('I am sad but grateful for my friends');
  assert.equal(a.primary,'joy_gratitude');
  assert.ok(a.secondary.includes('grief_sadness'));
  assert.equal(a.confidence,'mixed');
});
test('denied happiness never returns through a secondary mapping',()=>{
  const a=engine.analyze("I'm not happy and I'm okay with that");
  assert.equal(a.quoteScores.joy_gratitude || 0,0);
  for(let i=0;i<100;i++) assert.ok(!engine.pickQuote(a,quotes,[],()=>i/100).tags.includes('joy_gratitude'));
});
test('requests for humor work even during sadness',()=>{
  const a=engine.analyze('I am sad and want something funny');
  for(let i=0;i<100;i++) assert.ok(engine.pickQuote(a,quotes,[],()=>i/100).tags.includes('funny'));
});
test('declined humor is respected',()=>{
  for(const input of ['I do not want something funny','No jokes, I am grieving','I do not need a laugh']) {
    const a=engine.analyze(input);
    assert.ok(!a.humorWanted);
    for(let i=0;i<50;i++) assert.ok(!engine.pickQuote(a,quotes,[],()=>i/50).tags.includes('funny'));
  }
});
test('unknown words produce an honest fallback, not an invented mood',()=>{
  const a=engine.analyze('glorp zzzxyz');
  assert.equal(a.confidence,'unrecognized');
  assert.ok(quotes.includes(engine.pickQuote(a,quotes)));
});
test('matching is deterministic but quote selection varies',()=>{
  const a=engine.analyze('I feel happy');
  assert.deepEqual(a,engine.analyze('I feel happy'));
  const ids=new Set(Array.from({length:100},(_,i)=>engine.pickQuote(a,quotes,[],()=>i/100).id));
  assert.ok(ids.size>3);
});
test('each fixed mood can select a real passage',()=>{
  for(const [key,mood] of Object.entries(moods)) {
    const a={primary:key,excluded:[],quoteScores:mood.quoteTags};
    assert.ok(engine.pickQuote(a,quotes)?.id);
  }
});
test('recent passages are skipped where the matching pool has alternatives',()=>{
  const a=engine.analyze('happy');
  const history=[];
  for(let i=0;i<8;i++) {
    const q=engine.pickQuote(a,quotes,history,()=>0);
    assert.ok(!history.includes(q.id));history.push(q.id);
  }
});
test('pool exhaustion still avoids immediate repetition',()=>{
  const bank=quotes.slice(0,3),a=engine.analyze('something funny');
  const recent=bank.map(q=>q.id);
  assert.notEqual(engine.pickQuote(a,bank,recent,()=>.999).id,recent.at(-1));
});
test('empty and singleton quote banks are safe',()=>{
  const a=engine.analyze('happy');
  assert.equal(engine.pickQuote(a,[]),null);
  assert.equal(engine.pickQuote(a,[quotes[0]],[quotes[0].id]).id,quotes[0].id);
});
test('repeating one keyword does not swamp a distinct feeling',()=>{
  assert.deepEqual(engine.analyze('sad sad sad but hopeful').scores,engine.analyze('sad but hopeful').scores);
});
test('historical manual assignments cover the original sources',()=>{
  const originals=read('../sources/parsed-quotes.json');
  const labels=read('../dist/quote-tags.json');
  const ids=fs.readFileSync(new URL('../sources/quote-tags.tsv',import.meta.url),'utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split(' ')[0]);
  assert.equal(originals.length,328);
  assert.deepEqual(new Set(ids),new Set(originals.map(q=>q.id)));
  for(const mood of Object.values(moods)) assert.ok(Object.keys(mood.quoteTags).every(t=>Object.hasOwn(labels,t)));
});
