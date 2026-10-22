#!/usr/bin/env python3
"""Refresh avatar URLs from male FC27 listing HTML without changing player attributes."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path

from crawl_fifacm import ROOT, browser_eval, write_json, write_players

EXPRESSION = r"""
(async () => {
  if (!/(?:^|; )gender=0(?:;|$)/.test(document.cookie)) throw new Error('Select male database first');
  const pending = PAGES, results = [];
  await Promise.all(Array.from({length: 2}, async () => {
    while (pending.length) {
      const page = pending.shift();
      const sourceUrl = new URL('/players?page=' + page, location.origin).href;
      const response = await fetch(sourceUrl, {signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('HTTP ' + response.status + ' page ' + page);
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (!/EA FC 27/.test(doc.title) || !doc.body.textContent.includes('6th of Oct 2026'))
        throw new Error('Unexpected version/snapshot on page ' + page);
      const players = [...doc.querySelectorAll('tr.player-row')].map(row => {
        const href = row.querySelector('.player-name a')?.getAttribute('href');
        const id = Number(href?.match(/^\/player\/(\d+)\//)?.[1]);
        const image = row.querySelector('.player-img-info');
        const path = image?.getAttribute('data-lazy-src') || image?.getAttribute('src');
        if (!id || !path) throw new Error('Missing player ID/image on page ' + page);
        const avatarUrl = new URL(path, sourceUrl).href;
        if (!avatarUrl.includes('/players/p' + id + '.png'))
          throw new Error('Image/player mismatch: ' + id);
        return {id, avatarUrl};
      });
      if (players.length !== (page === 626 ? 13 : 30)) throw new Error('Unexpected page size: ' + page);
      results.push({page, sourceUrl, players});
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }));
  return JSON.stringify(results);
})()
"""


def run(args):
    cli = os.environ.get('ORCA_CLI_COMMAND') or 'orca'
    players_path = ROOT / 'data/fifacm/players.json'
    original = json.loads(players_path.read_text())
    args.cache.mkdir(parents=True, exist_ok=True)
    pages = list(range(1, 627))
    pending = [page for page in pages if not (args.cache / f'page-{page}.json').exists()]
    for offset in range(0, len(pending), 20):
        batch = pending[offset:offset + 20]
        for attempt in range(3):
            try:
                results = browser_eval(cli, args.page_id, EXPRESSION.replace('PAGES', json.dumps(batch)))
                if sorted(result['page'] for result in results) != batch:
                    raise ValueError('Incomplete page batch')
                for result in results:
                    write_json(args.cache / f'page-{result["page"]}.json', result)
                break
            except Exception:
                if attempt == 2:
                    raise
        print(f'Pages verified: {626 - len(pending) + min(offset + 20, len(pending))}/626', flush=True)
    verified = {}
    for page in pages:
        result = json.loads((args.cache / f'page-{page}.json').read_text())
        assert result['page'] == page
        for player in result['players']:
            assert player['id'] not in verified, 'Duplicate source player'
            verified[player['id']] = player['avatarUrl']
    assert set(verified) == {player['id'] for player in original}, 'Source roster changed'
    updated = [{**player, 'avatarUrl': verified[player['id']]} for player in original]
    for before, after in zip(original, updated):
        assert {key: value for key, value in before.items() if key != 'avatarUrl'} == {
            key: value for key, value in after.items() if key != 'avatarUrl'
        }
    # Refuse to overwrite concurrent edits made during the crawl.
    assert json.loads(players_path.read_text()) == original
    missing_before = sum(not player.get('avatarUrl') for player in original)
    changed = sum(before.get('avatarUrl') != after['avatarUrl'] for before, after in zip(original, updated))
    write_players(players_path, updated)
    manifest_path = ROOT / 'data/fifacm/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['avatarRecheck'] = {
        'verifiedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'snapshotDate': '2026-10-06',
        'source': 'Male FC27 listing HTML: .player-img-info data-lazy-src or src, joined by player ID.',
        'pageCount': 626,
        'playerCount': len(updated),
        'missingBefore': missing_before,
        'updatedCount': changed,
        'missingAfter': 0,
        'scope': 'Source-declared image URLs; CDN availability and unique real portraits are not guaranteed.',
    }
    manifest['limitations'] = [limitation for limitation in manifest.get('limitations', [])
                               if 'lazy-loaded image' not in limitation]
    write_json(manifest_path, manifest)
    print(json.dumps(manifest['avatarRecheck'], indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--page-id', required=True)
    parser.add_argument('--cache', type=Path, required=True)
    run(parser.parse_args())
