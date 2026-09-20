"""Author the fixed input vocabulary and its separate mapping to quote tones."""
import json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
moods = json.loads((root/'dist/synonyms.json').read_text())
# Ambiguous words need phrases; never equate four-letter prefixes.
remove = {'grief_sadness': ['down','blue','low','loss','broken','ache','aching'], 'love_longing': ['miss','loving'], 'loneliness': ['alone','on my own','solitary'], 'calm_peace': ['still','quiet'], 'nostalgia': ['used to'], 'courage_resolve': ['fight','fighting','strong','steady'], 'guilt_regret': ['sorry'], 'joy_gratitude': ['bright','content'], 'wonder': ['wonderful']}
for key, words in remove.items():
    moods[key]['words'] = [w for w in moods[key]['words'] if w not in words]
extra = {
 'grief_sadness': 'unhappy|miserable|melancholy|despondent|depressed|feeling down|feeling low|feeling blue|a loss|lost a loved one|lost my dad|lost my mom|lost my mum|lost my friend|passed away|died|broken heart|in tears|want to cry|want to disappear|everything hurts|breakup|dumped|rejected',
 'anxiety_fear': 'overthinking|apprehension|freaking out|freaked out|terrifying|cannot stop worrying|what if|butterflies in my stomach|knot in my stomach|heart racing|cannot breathe|too much to do|deadline|deadlines|drowning in work',
 'anger_frustration': 'irritating|irritation|infuriating|agitated|hate|hating|sick of|tired of|done with|at my wits end|getting on my nerves|driving me crazy|cannot stand|so unfair|unfair|betrayed',
 'loneliness': 'nobody cares|no one cares|nobody understands|no friends|do not belong|left me out|not invited|nobody to talk to|no one to talk to|missing my friends|miss my friends',
 'hope': 'hopefulness|hope for|things are looking up|getting better|new beginning|fresh start|a chance|excited for the future',
 'joy_gratitude': 'excited|ecstatic|euphoric|overjoyed|thrilled|happier|happiest|feeling good|feeling great|life is good|great day|good day|cannot stop smiling|so much to be thankful for',
 'love_longing': 'missing him|missing her|missing them|miss you|miss my partner|miss my boyfriend|miss my girlfriend|miss my family|miss my mom|miss my dad|loved|cherished|adore|adoring|affectionate|infatuated|falling for|falling in love',
 'confusion': 'cannot decide|do not know|dunno|disoriented|at a crossroads|what am i doing|what to do with my life|nothing makes sense|mixed feelings|conflicting feelings',
 'exhaustion_burnout': 'burnt|knackered|sleep deprived|running on fumes|need a break|need to rest|need a nap|cannot get out of bed|too tired|mentally exhausted|emotionally exhausted|tired all the time',
 'nostalgia': 'homesick|homesickness|missing home|miss home|missing the old days|miss the old days|miss being a kid|remember when|looking back|old times|bittersweet memories',
 'courage_resolve': 'confident|ready to try|keep going|keep trying|will not give up|not going to give up|i can do this|stand up for myself|standing up for myself|setting boundaries|try again|not backing down',
 'calm_peace': 'content|comfortable|okay|fine|sitting quietly|some quiet|need quiet|peace and quiet|comfortable alone|enjoying my own company|like being alone|happy alone|happy being alone|alone time|fine on my own',
 'restlessness': 'bouncing off the walls|need an adventure|need to get out|want to escape|caged|cannot settle|cannot sit still',
 'pride': 'proud of myself|nailed it|i succeeded|i passed|i won|got the job|got promoted|promotion|feeling strong',
 'guilt_regret': 'i messed up|made a mistake|messed things up|let them down|let everyone down|embarrassed|embarrassing|humiliated|wish i could undo|wish i had not|sorry for what i did',
 'wonder': 'intrigued|inspired|inspiration|full of questions|blown away|mind blown|beautiful world'
}
for key, words in extra.items(): moods[key]['words'] += words.split('|')
new = {
 'ennui': ('Ennui', 'ennui|bored|boredom|meh|blah|apathetic|apathy|indifferent|numb|flat|listless|listlessness|resigned|resignation|whatever|going through the motions|same old|nothing matters|cannot be bothered|do not care|nothing in particular|nothing special|just existing|feel nothing|feeling nothing|empty|hollow'),
 'acceptance': ('Acceptance', 'acceptance|accepting|accepted it|okay with that|ok with that|fine with that|at peace with that|okay with it|ok with it|fine with it|made my peace|making peace|it is what it is|letting go|let it go|so be it|that is life|taking it as it comes|not fighting it'),
 'amusement': ('Amusement', 'funny|amused|amusement|silly|playful|goofy|laughing|laughter|laugh|humor|humour|ridiculous|absurd|sarcastic|sarcasm|wry|joke|hilarious|laughable|comical|make me laugh|need a laugh|cheer me up|something funny|something silly|lighten the mood'),
 'reflection': ('Reflection', 'reflective|reflecting|contemplative|contemplating|introspective|introspection|philosophical|pondering|thinking about life|thinking things over|trying to understand myself|put things in perspective'),
 'disappointment': ('Disappointment', 'disappointed|disappointing|disappointment|let down|underwhelmed|not what i hoped|did not work out|not good enough|failed|failure|defeated'),
 'relief': ('Relief', 'relieved|relief|weight off my shoulders|dodged a bullet|finally over|made it through|can breathe again|not bad|not too bad|not so bad|cannot complain'),
 'insecurity': ('Self-doubt', 'insecure|insecurity|self doubt|imposter|impostor|inadequate|worthless|not enough|not worthy|not good at anything|everyone is better than me|not confident|doubting myself'),
 'social_fatigue': ('Social fatigue', 'peopled out|social battery|need some space|need space|leave me alone|need to be alone|want to be alone|do not want to talk|too many people|sick of people|tired of people')
}
for key, (label, words) in new.items(): moods[key] = dict(label=label, words=words.split('|'))
maps = {
 'grief_sadness': {'grief_sadness':1,'love_longing':.25,'reflection':.3},
 'anxiety_fear': {'anxiety_fear':1,'calm_peace':.35,'courage_resolve':.3},
 'anger_frustration': {'anger_frustration':1,'courage_resolve':.45,'funny':.25},
 'loneliness': {'loneliness':1,'love_longing':.6,'grief_sadness':.2},
 'hope': {'hope':1,'courage_resolve':.55,'joy_gratitude':.3},
 'joy_gratitude': {'joy_gratitude':1,'wonder':.3,'love_longing':.2},
 'love_longing': {'love_longing':1,'joy_gratitude':.15},
 'confusion': {'confusion':1,'reflection':.65},
 'exhaustion_burnout': {'exhaustion_burnout':1,'calm_peace':.45,'ennui':.25},
 'nostalgia': {'nostalgia':1,'reflection':.8,'love_longing':.45,'grief_sadness':.2},
 'courage_resolve': {'courage_resolve':1,'hope':.45,'pride':.15},
 'calm_peace': {'calm_peace':1,'reflection':.3},
 'restlessness': {'restlessness':1,'courage_resolve':.4,'wonder':.3},
 'pride': {'pride':1,'courage_resolve':.7,'joy_gratitude':.55},
 'guilt_regret': {'guilt_regret':1,'reflection':.55,'hope':.2},
 'wonder': {'wonder':1,'reflection':.5,'joy_gratitude':.3},
 'ennui': {'ennui':1,'reflection':.65,'calm_peace':.35,'funny':.15},
 'acceptance': {'calm_peace':1,'reflection':.65,'ennui':.55},
 'amusement': {'funny':1},
 'reflection': {'reflection':1,'calm_peace':.35},
 'disappointment': {'ennui':1,'grief_sadness':.6,'reflection':.5},
 'relief': {'calm_peace':1,'joy_gratitude':.55,'hope':.3},
 'insecurity': {'guilt_regret':.65,'reflection':1,'courage_resolve':.55},
 'social_fatigue': {'calm_peace':1,'exhaustion_burnout':.6,'ennui':.3}
}
# Negation is weaker evidence than affirmation. Absence of sadness is not happiness.
negated = {'joy_gratitude':'disappointment','hope':'disappointment','calm_peace':'anxiety_fear','courage_resolve':'insecurity','pride':'insecurity','love_longing':'loneliness','amusement':'ennui'}
for key,mood in moods.items():
    mood['quoteTags'] = maps[key]
    mood['negatedTo'] = negated.get(key)
    mood['words'] = list(dict.fromkeys(mood['words']))
(root/'dist/moods.json').write_text(json.dumps(moods,ensure_ascii=False,indent=2)+'\n')
print(f'{len(moods)} fixed input moods, {sum(len(m["words"]) for m in moods.values())} words and phrases')
