"""Recreate the historical import for reference, never overwrite the live JSON."""
import json
from pathlib import Path
from collections import Counter
root = Path(__file__).resolve().parent.parent
quotes = json.loads((root/'sources/parsed-quotes.json').read_text())
assignments = {}
for line in (root/'sources/quote-tags.tsv').read_text().splitlines():
    if line and not line.startswith('#'):
        ident, *tags = line.split()
        assert ident not in assignments, ident
        assignments[ident] = tags
assert set(assignments) == {q['id'] for q in quotes}
labels = {k:v['label'] for k,v in json.loads((root/'dist/synonyms.json').read_text()).items()}
labels.update(funny='Funny', ennui='Ennui', reflection='Reflection')
# Editorial notes following quotations belong in metadata, not the displayed passage.
notes = {'pp-081': ' (Mr. Bennet, on Collins)', 'pp-083': ' (re: Wickham, but pure Jane-and-Collins-adjacent softness)', 'pp-164': ' — Jane Bennet', 'pp-168': " (Mr. Collins's letter of condolence)"}
# These short contextual snippets remain available but get less weight than stand-alone passages.
fragments = {'cd-014','cd-016','cd-019','cd-020','cd-022','cd-066','cd-077','cd-094','cd-110','cd-113','cd-136','cd-137','pp-006','pp-010','pp-068','pp-085','pp-113','pp-147','pp-155','pp-162','pp-163','pp-164','pp-165','pp-166','pp-168','pp-169','pp-178'}
for q in quotes:
    q['tags'] = assignments[q['id']]
    assert q['tags'] and all(t in labels for t in q['tags'])
    if q['id'] in notes:
        note = notes[q['id']]
        assert q['text'].endswith(note)
        q['text'] = q['text'][:-len(note)]
        q['sourceNote'] = note.strip()
    q['weight'] = .25 if q['id'] in fragments else 1
(root/'sources/tagged-original-quotes.json').write_text(json.dumps(quotes, ensure_ascii=False, indent=2)+'\n')
print('Historical import written to sources/tagged-original-quotes.json; dist/quotes.json is unchanged.')
print(f'{len(quotes)} individually tagged passages; {len(labels)} quote tags')
print(dict(Counter(t for q in quotes for t in q['tags'])))
