#!/usr/bin/env python3
"""Write data/fifacm/pitch-positions.json: where FIFACM draws each startingXI position on a team page pitch.

The Orca tab must be on any https://www.fifacm.com/<season>/team/<id>/<slug> page. FIFACM's stylesheet gives every
`clubs[].startingXI[].sourcePositionId` a rule `.site-teams-page .pht<id>{left:..%;bottom:..%}`. The position name of
each id comes from clubs.json itself (the same id always carries the same name there); ids no club uses are skipped.
"""

import argparse
import collections
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from crawl_fifacm import write_json  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/fifacm'
STYLESHEET_URL = 'https://cdn.fifacm.com/static/dist/css/site.min.css'
READ_RULES = r"""(async () => {
  const link = [...document.querySelectorAll('link[rel=stylesheet]')].find(element => element.href.includes('site.min.css'));
  const css = await (await fetch(link.href)).text();
  return JSON.stringify([...css.matchAll(/\.site-teams-page \.pht(\d+)\{([^}]*)\}/g)].map(match => [Number(match[1]), match[2]]));
})()"""


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--page-id', required=True)
    parser.add_argument('--orca-cli', default='orca')
    arguments = parser.parse_args()
    process = subprocess.run([arguments.orca_cli, 'eval', '--page', arguments.page_id, '--expression', READ_RULES, '--json'],
                             capture_output=True, text=True, timeout=120)
    response = json.loads(process.stdout)
    if not response.get('ok'):
        raise SystemExit(str(response)[:500])
    rules = {}
    for position_id, body in json.loads(response['result']['result']):
        properties = dict(item.split(':') for item in body.split(';') if item)
        if set(properties) != {'left', 'bottom'} or position_id in rules:
            raise SystemExit(f'Unexpected rule for pht{position_id}: {body}')
        rules[position_id] = {key: float(re.fullmatch(r'([\d.]+)%', value).group(1)) for key, value in properties.items()}

    names = collections.defaultdict(collections.Counter)
    for club in json.loads((DATA / 'clubs.json').read_text()):
        for slot in club['startingXI']:
            names[slot['sourcePositionId']][slot['position']] += 1
    positions = []
    for position_id in sorted(names):
        if len(names[position_id]) != 1 or position_id not in rules:
            raise SystemExit(f'Position id {position_id} is ambiguous or has no coordinates: {dict(names[position_id])}')
        positions.append({'sourcePositionId': position_id, 'position': next(iter(names[position_id])),
                          'leftPercent': rules[position_id]['left'], 'bottomPercent': rules[position_id]['bottom']})
    path = DATA / 'pitch-positions.json'
    path.write_text('[\n' + ',\n'.join('  ' + json.dumps(item, separators=(', ', ': ')) for item in positions) + '\n]\n')

    manifest_path = DATA / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['datasets']['pitchPositions'] = {
        'file': 'pitch-positions.json', 'sourceUrl': STYLESHEET_URL, 'count': len(positions),
        'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'note': 'clubs[].startingXI[].sourcePositionId -> pitchPositions[].sourcePositionId; left is the card edge, bottom is measured from the pitch bottom (team page pitch).',
    }
    manifest['sha256']['pitch-positions.json'] = hashlib.sha256(path.read_bytes()).hexdigest()
    write_json(manifest_path, manifest)
    print(f'Wrote {len(positions)} pitch positions')


if __name__ == '__main__':
    main()
