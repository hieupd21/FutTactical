#!/usr/bin/env python3
"""Write data/fifacm/playstyles.json: the FIFACM icon of every PlayStyle (normal and Plus) used in players.json.

The Orca tab must be on any fifacm.com page. For each distinct (name, isPlus) pair in players.json one player who has
it is opened from inside the tab and the `<img alt="<name>">` icon under `playstyles/<plus|normal>/` is read.
Only the icon address shown by FIFACM is stored; the image itself is loaded from FIFACM's CDN like player photos.
"""

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from crawl_fifacm import write_json  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/fifacm'
CDN = 'https://cdn.fifacm.com'
BATCH_SIZE = 12
READ_ICONS = r"""(async () => {
  const wanted = WANTED;
  const result = [];
  for (const item of wanted) {
    const html = await (await fetch('/player/' + item.playerId)).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const kind = item.isPlus ? 'plus' : 'normal';
    const image = [...doc.querySelectorAll('img')].find(element =>
      element.getAttribute('alt') === item.name && element.getAttribute('src').includes('/playstyles/' + kind + '/'));
    if (!image) throw new Error('No icon for ' + item.name + ' ' + kind + ' on player ' + item.playerId);
    result.push({name: item.name, isPlus: item.isPlus, path: image.getAttribute('src')});
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return JSON.stringify(result);
})()"""


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--page-id', required=True)
    parser.add_argument('--orca-cli', default='orca')
    arguments = parser.parse_args()
    representatives = {}
    for player in json.loads((DATA / 'players.json').read_text()):
        for play_style in player.get('playStyles', []):
            representatives.setdefault((play_style['name'], play_style['isPlus']), player['id'])
    wanted = [{'name': name, 'isPlus': is_plus, 'playerId': player_id}
              for (name, is_plus), player_id in sorted(representatives.items())]
    icons = []
    for start in range(0, len(wanted), BATCH_SIZE):
        expression = READ_ICONS.replace('WANTED', json.dumps(wanted[start:start + BATCH_SIZE]))
        process = subprocess.run([arguments.orca_cli, 'eval', '--page', arguments.page_id, '--expression', expression, '--json'],
                                 capture_output=True, text=True, timeout=120)
        response = json.loads(process.stdout)
        if not response.get('ok'):
            raise SystemExit(str(response)[:800])
        icons += json.loads(response['result']['result'])
    path = DATA / 'playstyles.json'
    path.write_text('[\n' + ',\n'.join('  ' + json.dumps({'name': icon['name'], 'isPlus': icon['isPlus'], 'imageUrl': CDN + icon['path']},
                                                         ensure_ascii=False, separators=(', ', ': ')) for icon in icons) + '\n]\n')

    manifest_path = DATA / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['datasets']['playStyleIcons'] = {
        'file': 'playstyles.json', 'sourceUrl': 'https://www.fifacm.com/player/<id>', 'count': len(icons),
        'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'note': 'players[].playStyles[] (name, isPlus) -> playstyles[] (name, isPlus).imageUrl; icon address as shown on the player profile, loaded from the FIFACM CDN.',
    }
    manifest['sha256']['playstyles.json'] = hashlib.sha256(path.read_bytes()).hexdigest()
    write_json(manifest_path, manifest)
    print(f'Wrote {len(icons)} PlayStyle icons')


if __name__ == '__main__':
    main()
