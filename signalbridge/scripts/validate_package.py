"""Validate generated copy blocks and a public source package; no network calls."""
import html
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
guide = (root / 'Install-Guide.html').read_text()
names = ['Code.gs', 'Core.gs', 'Seed.gs', 'Review.html', 'appsscript.json']
blocks = re.findall(r'<textarea\b[^>]*>([\s\S]*?)</textarea>', guide)
assert len(blocks) == len(names), 'Expected five source copy blocks'
for name, block in zip(names, blocks):
    assert html.unescape(block) == (root / 'apps-script' / name).read_text(), name
seed = json.loads((root / 'data/seed.json').read_text())
assert not seed['credentials']
assert not seed['config']['credential_root_folder_id']
assert not seed['config']['digest_to']
assert not seed['config']['digest_enabled']
assert not seed['config']['news_enabled']
assert all(a['brand'].startswith('Demo ') and a['customer_type'] == 'UNKNOWN'
           and not a['contact_email'] for a in seed['accounts'])
json.loads((root / 'apps-script/appsscript.json').read_text())
review = (root / 'apps-script/Review.html').read_text()
core = (root / 'apps-script/Core.gs').read_text()
assert '/* CORE_START */\n' + core + '\n/* CORE_END */' in review
assert 'SIGNALBRIDGE' in review
for folder in ['apps-script', 'data', 'scripts', 'docs']:
    for p in (root / folder).rglob('*'):
        if not p.is_file() or '__pycache__' in p.parts:
            continue
        text = p.read_text()
        assert ('/' + 'workspace/') not in text, str(p)
        assert not re.search(r'AIza[\w-]{30,}', text), str(p)
        assert not re.search(r'(ghp_|github_pat_)[A-Za-z0-9_]{20,}', text), str(p)
print('PASS package: five exact copy blocks, synchronized engine, public seed, portable paths and no token patterns')
