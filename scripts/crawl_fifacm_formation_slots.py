#!/usr/bin/env python3
"""Add the Squad Builder pitch coordinates of every formation variant to data/fifacm/formations.json.

The Orca tab must be on https://www.fifacm.com/squad-builder. For each variant code the script sets the
page's own `formation-holder f<code>` class, so FIFACM's stylesheet (including its per-variant overrides)
decides the position, then reads the rendered left/top of slots ph1..ph11 as a percentage of the pitch.
`variants[].slotCoordinates[i]` belongs to `variants[].positions[i]`. Nothing is estimated.
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
SLOT_COUNT = 11
SOURCE_URL = 'https://www.fifacm.com/squad-builder'

READ_COORDINATES = r"""(() => {
  const style = document.createElement('style');
  style.textContent = '*{transition:none!important;animation:none!important}';
  document.head.appendChild(style);
  const holder = document.getElementById('formation-holder');
  const original = holder.className;
  const result = {};
  for (const code of CODES) {
    holder.className = 'formation-holder f' + code;
    void holder.offsetHeight;
    const box = holder.getBoundingClientRect();
    result[code] = Array.from({length: SLOT_COUNT}, (_, index) => {
      const computed = getComputedStyle(document.getElementById('ph' + (index + 1)));
      const percent = value => Math.round(parseFloat(value) / box.width * 1000) / 10;
      return {leftPercent: percent(computed.left), topPercent: Math.round(parseFloat(computed.top) / box.height * 1000) / 10};
    });
  }
  holder.className = original;
  style.remove();
  return JSON.stringify(result);
})()"""


def read_coordinates(cli, page_id, codes):
    expression = READ_COORDINATES.replace('CODES', json.dumps(codes)).replace('SLOT_COUNT', str(SLOT_COUNT))
    process = subprocess.run([cli, 'eval', '--page', page_id, '--expression', expression, '--json'],
                             capture_output=True, text=True, timeout=120)
    response = json.loads(process.stdout)
    if not response.get('ok'):
        raise RuntimeError(str(response)[:500])
    return json.loads(response['result']['result'])


def format_formations(formations):
    """Same layout as before: one line for lines/positions/slot coordinates, indented objects otherwise."""
    lines = ['[']
    for index, formation in enumerate(formations):
        lines += ['  {', f'    "id": {json.dumps(formation["id"])},', f'    "label": {json.dumps(formation["label"])},',
                  f'    "lines": {json.dumps(formation["lines"])},', '    "variants": [']
        for variant_index, variant in enumerate(formation['variants']):
            lines += ['      {', f'        "code": {json.dumps(variant["code"])},', f'        "label": {json.dumps(variant["label"])},',
                      f'        "positions": {json.dumps(variant["positions"])},', '        "slotCoordinates": [']
            slots = [f'          {json.dumps(slot, separators=(", ", ": "))}' for slot in variant['slotCoordinates']]
            lines += [',\n'.join(slots), '        ]', '      }' + (',' if variant_index + 1 < len(formation['variants']) else '')]
        lines += ['    ]', '  }' + (',' if index + 1 < len(formations) else '')]
    lines.append(']')
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--page-id', required=True)
    parser.add_argument('--orca-cli', default='orca')
    arguments = parser.parse_args()
    path = DATA / 'formations.json'
    formations = json.loads(path.read_text())
    codes = [variant['code'] for formation in formations for variant in formation['variants']]
    coordinates = read_coordinates(arguments.orca_cli, arguments.page_id, codes)
    for formation in formations:
        for variant in formation['variants']:
            slots = coordinates[variant['code']]
            if len(slots) != len(variant['positions']) or any(slot['leftPercent'] != slot['leftPercent'] for slot in slots):
                raise SystemExit('Bad coordinates for ' + variant['code'])
            variant['slotCoordinates'] = slots
    path.write_text(format_formations(formations))

    manifest_path = DATA / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['datasets']['formations'].update({
        'schemaVersion': 3,
        'slotCoordinatesSourceUrl': SOURCE_URL,
        'slotCoordinatesRetrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'slotCoordinatesNote': 'variants[].slotCoordinates[i] is the left/top of ph<i+1> as a percentage of the Squad Builder pitch, for variants[].positions[i]; left is the card edge.',
    })
    manifest['sha256']['formations.json'] = hashlib.sha256(path.read_bytes()).hexdigest()
    write_json(manifest_path, manifest)
    print(f'Wrote slot coordinates for {len(codes)} variants')


if __name__ == '__main__':
    main()
