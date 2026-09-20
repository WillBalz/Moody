// A small, inspectable rules engine. No models, embeddings, dependencies or network calls.
export function normalize(text) {
  return String(text).toLowerCase().normalize('NFKC')
    .replace(/[’‘]/g, "'")
    .replace(/\b(can't|cant|cannot)\b/g, 'can not')
    .replace(/\b(won't|wont)\b/g, 'will not')
    .replace(/\b(don't|dont)\b/g, 'do not')
    .replace(/\b(doesn't|doesnt)\b/g, 'does not')
    .replace(/\b(didn't|didnt)\b/g, 'did not')
    .replace(/\b(isn't|isnt)\b/g, 'is not')
    .replace(/\b(aren't|arent)\b/g, 'are not')
    .replace(/\b(wasn't|wasnt)\b/g, 'was not')
    .replace(/\b(weren't|werent)\b/g, 'were not')
    .replace(/\b(haven't|havent)\b/g, 'have not')
    .replace(/\b(hadn't|hadnt)\b/g, 'had not')
    .replace(/\b(shouldn't|shouldnt)\b/g, 'should not')
    .replace(/\b(couldn't|couldnt)\b/g, 'could not')
    .replace(/\b(i'm|im)\b/g, 'i am').replace(/\bit's\b/g, 'it is')
    .replace(/\b(that's|thats)\b/g, 'that is').replace(/[-–—]/g, ' ')
    .replace(/\b(ok|okay)\b/g, 'okay')
    .replace(/[😊😃😄😁🥳]/gu,' happy ').replace(/[😢😭💔]/gu,' sad ')
    .replace(/[😡🤬]/gu,' angry ').replace(/[😰😨]/gu,' anxious ')
    .replace(/[😂🤣]/gu,' amused ').replace(/[😴🥱]/gu,' tired ')
    .replace(/[❤️♥]/gu,' love ').replace(/\s+/g, ' ').trim();
}

const wordsOf = text => normalize(text).match(/[a-z]+(?:'[a-z]+)?/g) || [];
const NEGATORS = new Set(['not','never','no','hardly','barely','without','neither','nor']);
const INTENSITY = {very:1.3,really:1.2,extremely:1.6,incredibly:1.5,so:1.25,totally:1.4,slightly:.65,somewhat:.7,kinda:.7,almost:.7};
const GENTLE = new Set(['grief_sadness','loneliness','guilt_regret','insecurity']);

export function createMatcher(moods) {
  const vocabulary = [];
  for (const [mood, data] of Object.entries(moods)) {
    for (const phrase of data.words) vocabulary.push({mood,phrase,tokens:wordsOf(phrase)});
  }
  vocabulary.sort((a,b) => b.tokens.length-a.tokens.length);
  const starts = new Map();
  for (const entry of vocabulary) {
    const first = entry.tokens[0];
    if (!starts.has(first)) starts.set(first, []);
    starts.get(first).push(entry);
  }

  function analyze(input) {
    const text = normalize(String(input).slice(0,2000));
    const scores = {}, excluded = new Set(), evidence = [], affirmed = new Set();
    const add = (tag, value) => { scores[tag] = (scores[tag] || 0) + value; };
    // Clause boundaries stop "not" leaking into a new thought. A contrast gives
    // modest extra emphasis to what follows; it does not erase the first feeling.
    const pieces = text.split(/\b(but|however|yet|although|though|and)\b|[.!?;,\n]+/);
    let clauseWeight = 1;
    for (const piece of pieces) {
      if (!piece?.trim()) continue;
      if (/^(but|however|yet)$/.test(piece)) { clauseWeight = 1.3; continue; }
      if (/^(although|though)$/.test(piece)) { clauseWeight = .8; continue; }
      if (piece === 'and') { clauseWeight = 1; continue; }
      const tokens = wordsOf(piece);
      let negationAt = -100, negationCount = 0, subjectWeight = 1;
      const seen = new Set();
      for (let i=0; i<tokens.length; i++) {
        const token = tokens[i];
        // Other people's moods and past moods are context, not the strongest evidence.
        if (['he','she','they','friend','mom','dad','partner','everyone'].includes(token)) subjectWeight = .45;
        if (token === 'i') subjectWeight = 1;
        if (['was','were','yesterday','previously'].includes(token) || (token==='used' && tokens[i+1]==='to')) subjectWeight *= .4;
        if (token === 'now' || token === 'today') subjectWeight = 1;
        // "not only happy" is emphasis, not denial.
        if (token === 'not' && ['only','just','simply'].includes(tokens[i+1])) { i++; continue; }
        if (token === 'just' && evidence.length) { negationAt=-100; negationCount=0; }
        const entry = (starts.get(token)||[]).find(e => e.tokens.every((w,j)=>tokens[i+j]===w));
        if (entry) {
          const priorNegation = i-negationAt <= 5 && negationCount%2 === 1;
          const uncertain = ['want','wish','trying','try'].some(w=>tokens.slice(Math.max(0,i-4),i).includes(w));
          const multiplier = INTENSITY[tokens[i-1]] || 1;
          const value = (entry.tokens.length>1 ? 3.2 : 2) * clauseWeight * subjectWeight * multiplier * (uncertain?.35:1);
          const key = entry.mood + ':' + priorNegation;
          if (!seen.has(key)) {
            seen.add(key);
            if (priorNegation) {
              excluded.add(entry.mood);
              const opposite = moods[entry.mood].negatedTo;
              if (opposite) add(opposite, value*.65);
            } else {
              add(entry.mood,value);
              affirmed.add(entry.mood);
            }
            evidence.push({phrase:entry.phrase,mood:entry.mood,negated:priorNegation,weight:+value.toFixed(2)});
          }
          i += entry.tokens.length-1;
          continue;
        }
        if (NEGATORS.has(token)) {
          if (i-negationAt>5) negationCount=0;
          // "neither happy nor sad" coordinates two denials, not a double negative.
          negationCount = token==='nor' ? 1 : negationCount+1;
          negationAt=i;
        }
      }
      clauseWeight = 1;
    }
    const rules = [];
    if (/\b(alone|by myself|on my own)\b/.test(text) && !scores.calm_peace && !scores.social_fatigue) {
      if (excluded.has('loneliness')) { add('calm_peace',2); rules.push('Solitude without loneliness'); }
      else if (!scores.loneliness) add('loneliness',.7);
    }
    if (/\b(anymore|any more|no longer)\b/.test(text) && ['anxiety_fear','grief_sadness'].some(m=>excluded.has(m)) && !scores.anxiety_fear && !scores.grief_sadness) {
      add('relief',2); rules.push('A difficult feeling has eased');
    }
    // A fixed compound mood, inferred from independent evidence on either side
    // of "and/but". This intentionally handles more than one memorized sentence.
    if (scores.acceptance && (excluded.has('joy_gratitude') || scores.disappointment || scores.grief_sadness || scores.ennui)) {
      add('ennui', Math.max(...Object.values(scores))+2);
      rules.push('Low spirits with acceptance → ennui');
    }
    // Requests for a tone are intentional directions, even when the user is sad.
    const request = /\b(make me laugh|need (?:a |to )?laugh|cheer me up|(?:want|need|give me|show me|could use)(?: something| a)? (?:funny|silly|a joke)|lighten the mood)\b/;
    const humorWanted = request.test(text) && !/\b(?:not|never)\s+(?:want|need|give|show|make|cheer)|\bno\s+(?:jokes|humou?r)\b/.test(text);
    if (humorWanted) { add('amusement', Math.max(0,...Object.values(scores))+4); rules.push('A laugh was requested'); }
    // Wanting happiness is not the same as reporting it.
    if (/\b(?:want|wish|trying)\b.{0,24}\b(?:happy|happier)\b/.test(text) && !affirmed.has('grief_sadness')) add('disappointment',1.5);
    const ranked = Object.entries(scores).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]));
    const primary = ranked[0]?.[0] || null;
    // Retain credible secondary feelings rather than picking arbitrarily on ties.
    const active = ranked.filter(([,v])=>v >= ranked[0][1]*.45).slice(0,3);
    const total = active.reduce((sum,[,v])=>sum+v,0);
    const quoteScores = {};
    for (const [mood,value] of active) for (const [tag,weight] of Object.entries(moods[mood].quoteTags)) {
      quoteScores[tag]=(quoteScores[tag]||0)+weight*value/total;
    }
    // Do not resurrect a denied feeling via a related tag's mapping.
    for (const mood of excluded) if (!affirmed.has(mood)) {
      if (mood==='amusement') quoteScores.funny=0;
      else if (Object.hasOwn(quoteScores,mood)) quoteScores[mood]=0;
    }
    if (/\bno (?:jokes|humou?r)\b/.test(text)) quoteScores.funny=0;
    return {primary,secondary:active.slice(1).map(([m])=>m),scores:Object.fromEntries(ranked),quoteScores,
      excluded:[...excluded].filter(m=>!affirmed.has(m)),evidence,rules,humorWanted,
      confidence:!primary?'unrecognized':ranked.length>1&&ranked[1][1]>=ranked[0][1]*.7?'mixed':'directional'};
  }

  function rankQuotes(analysis, quotes) {
    return quotes.map(quote => {
      const fits = quote.tags.map(tag=>analysis.quoteScores[tag]||0).sort((a,b)=>b-a);
      let score = analysis.primary ? (fits[0]||0) + .15*(fits[1]||0) : 1;
      const blocked = analysis.excluded.some(m=>quote.tags.includes(m==='amusement'?'funny':m));
      if (blocked) score *= .05;
      if (analysis.humorWanted && !quote.tags.includes('funny')) score *= .05;
      if (analysis.quoteScores.funny===0 && quote.tags.includes('funny')) score=0;
      // Dark satire can mirror anger, but is usually a poor companion to grief.
      if (GENTLE.has(analysis.primary) && !analysis.humorWanted && quote.tags.some(t=>['funny','anger_frustration','pride'].includes(t))) score*=.12;
      return {quote,score:score*(quote.weight??1)};
    }).sort((a,b)=>b.score-a.score || a.quote.id.localeCompare(b.quote.id));
  }

  function pickQuote(analysis, quotes, recent=[], random=Math.random) {
    if (!quotes.length) return null;
    const ranked=rankQuotes(analysis,quotes);
    const best=ranked[0].score;
    // Keep a broad group of reasonably close matches, not a random unrelated tag.
    let pool=ranked.filter(item=>item.score>0 && item.score>=best*.55);
    if (!pool.length) pool=ranked;
    const canonical=q=>q.text.toLowerCase().replace(/[^a-z0-9]/g,'');
    const lastText=quotes.find(q=>q.id===recent.at(-1));
    const unseen=pool.filter(({quote})=>!recent.includes(quote.id) && (!lastText||canonical(quote)!==canonical(lastText)));
    if (unseen.length) pool=unseen;
    else {
      const withoutLast=pool.filter(({quote})=>quote.id!==recent.at(-1) && (!lastText||canonical(quote)!==canonical(lastText)));
      if (withoutLast.length) pool=withoutLast;
    }
    const total=pool.reduce((n,item)=>n+item.score,0);
    let roll=Math.max(0,Math.min(.999999999,random()))*(total||pool.length);
    for (const item of pool) { roll-=total?item.score:1; if(roll<0) return item.quote; }
    return pool.at(-1).quote;
  }
  return {analyze,rankQuotes,pickQuote};
}
