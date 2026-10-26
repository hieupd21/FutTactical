#!/usr/bin/env python3
"""Download FC27 player-profile attributes from FIFACM through an existing Orca browser tab.

The tab must already be on any fifacm.com page (its cookies pass the site's bot check).
Each profile is fetched from inside that tab, parsed in the page, validated against
data/fifacm/players.json (id, overall, potential, skill moves, weak foot, snapshot) and cached
as one JSON file per player, so an interrupted run resumes where it stopped.

Two steps:
  fetch (default): fill the cache.        --limit N downloads only N missing players (pilot run).
  --apply:         merge the cache into players.json and update manifest.json and README.md.

Only values displayed on the profile are stored; nothing is estimated from other sources.
"""

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
from crawl_fifacm import write_json, write_players  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/fifacm'
EXPECTED_SNAPSHOT = '6th of Oct 2026'
ATTRIBUTE_COUNT = 34

# Profile label -> field name stored in players.json (outfield attributes first, then goalkeeper).
ATTRIBUTE_KEYS = {
    'Crossing': 'crossing', 'Finishing': 'finishing', 'Heading Acc.': 'headingAccuracy',
    'Short Pass': 'shortPassing', 'Volleys': 'volleys',
    'Dribbling': 'dribbling', 'Curve': 'curve', 'FK Acc.': 'freeKickAccuracy',
    'Long Pass': 'longPassing', 'Ball Control': 'ballControl',
    'Shot Power': 'shotPower', 'Jumping': 'jumping', 'Stamina': 'stamina',
    'Strength': 'strength', 'Long Shots': 'longShots',
    'Acceleration': 'acceleration', 'Sprint Speed': 'sprintSpeed', 'Agility': 'agility',
    'Reactions': 'reactions', 'Balance': 'balance',
    'Aggression': 'aggression', 'Interceptions': 'interceptions',
    'Att. Position': 'attackingPosition', 'Vision': 'vision', 'Penalties': 'penalties',
    'Composure': 'composure',
    'Def. Awareness': 'defensiveAwareness', 'Stand Tackle': 'standingTackle',
    'Slide Tackle': 'slidingTackle',
    'GK Diving': 'goalkeeperDiving', 'GK Handling': 'goalkeeperHandling',
    'GK Kicking': 'goalkeeperKicking', 'GK Positioning': 'goalkeeperPositioning',
    'GK Reflexes': 'goalkeeperReflexes',
}

PROFILE_PARSER = r"""
function parseProfile(doc, expectedId, sourceUrl) {
  const ATTRIBUTE_KEYS = ATTRIBUTE_KEYS_JSON;
  const text = node => node?.textContent.replace(/\s+/g, ' ').trim() || '';
  const integer = (value, label) => {
    if (!/^\d{1,3}$/.test(value)) throw new Error('Invalid ' + label + ': ' + value + ' (' + expectedId + ')');
    return Number(value);
  };
  if (!/EA FC 27/.test(doc.title)) throw new Error('Unexpected title: ' + doc.title);
  const body = text(doc.body);
  // The toggle shows the active snapshot; its dropdown only lists older ones.
  const snapshot = [...doc.querySelectorAll('.menu-dd .dropdown-toggle')].map(text)
    .find(label => /^\d+(?:st|nd|rd|th) of \w+ 20\d\d$/.test(label));
  if (!snapshot) throw new Error('Missing snapshot date for ' + expectedId);
  const overallRating = integer(body.match(/\bOVR (\d+)/i)?.[1] || '', 'overall');
  const potential = integer(body.match(/\bPotential (\d+)/i)?.[1] || '', 'potential');

  const attributes = {};
  doc.querySelectorAll('.player-stats .sub-stat').forEach(row => {
    const label = text(row.querySelector('.sub-stat-text-row .col-md-8'));
    const key = ATTRIBUTE_KEYS[label];
    if (!key) throw new Error('Unknown attribute "' + label + '" for ' + expectedId);
    if (key in attributes) throw new Error('Duplicate attribute ' + label + ' for ' + expectedId);
    attributes[key] = integer(text(row.querySelector('.sub-stat-rating')), label);
  });

  const positionRatings = {};
  doc.querySelectorAll('.rpp_field_pos').forEach(cell => {
    const position = text(cell.querySelector('.rpp_position'));
    if (!position || position in positionRatings) throw new Error('Bad position rating for ' + expectedId);
    positionRatings[position] = integer(text(cell.querySelector('.rpp_rating')), 'position rating');
  });

  const stars = selector => doc.querySelectorAll(selector + ' .swad-star').length;
  const holders = [...doc.querySelectorAll('.traits-holder')];
  const holderByTitle = title => holders.find(holder => text(holder.firstElementChild) === title);

  const roles = [];
  const rolesHolder = holderByTitle('Roles:');
  if (rolesHolder) {
    rolesHolder.querySelectorAll('.row > div.col-6').forEach(column => {
      const [position, ...names] = [...column.children].map(text);
      if (position && names.length) roles.push({position, roles: names});
    });
  }

  const playStyles = [];
  const playStylesHolder = holderByTitle('PlayStyles:');
  if (playStylesHolder) {
    playStylesHolder.querySelectorAll('.tands-holder img').forEach(image => {
      const name = image.getAttribute('alt');
      if (!name) throw new Error('Unnamed PlayStyle for ' + expectedId);
      playStyles.push({name, isPlus: /\/playstyles\/plus\//.test(image.getAttribute('src') || '')});
    });
  }

  const specialities = [...doc.querySelectorAll('.traits-specialities .tands-holder .d-inline')]
    .map(item => text(item).replace(/,$/, '')).filter(Boolean);

  return {
    id: expectedId, sourceUrl, snapshot, overallRating, potential,
    skillMoves: stars('.swad-skills'), weakFootAbility: stars('.swad-wf'),
    attributes, positionRatings, roles, playStyles, specialities,
  };
}
"""

FETCH_EXPRESSION = r"""
(async () => {
  const queue = JOBS, results = [];
  const workers = Array.from({length: WORKERS}, async () => {
    while (queue.length) {
      const job = queue.shift();
      let html;
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetch(job.url, {signal: AbortSignal.timeout(10000)}).catch(() => null);
        if (response && response.ok) { html = await response.text(); break; }
        if (response && [401, 403, 429].includes(response.status)) throw new Error('BLOCKED HTTP ' + response.status + ' on ' + job.id);
        if (response && response.status === 404) throw new Error('HTTP 404 on ' + job.id);
        await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
      }
      if (html === undefined) throw new Error('Failed after retries: ' + job.id);
      results.push(parseProfile(new DOMParser().parseFromString(html, 'text/html'), job.id, job.url));
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  });
  await Promise.all(workers);
  return JSON.stringify(results);
})()
"""


def browser_eval(cli, page_id, expression):
    process = subprocess.run(
        [cli, 'eval', '--page', page_id, '--expression', expression, '--json'],
        capture_output=True, text=True, timeout=120,
    )
    if process.returncode:
        raise RuntimeError(process.stderr[:500] or process.stdout[:500])
    response = json.loads(process.stdout)
    if not response.get('ok'):
        raise RuntimeError(str(response)[:1000])
    return json.loads(response['result']['result'])


def load_players():
    return json.loads((DATA / 'players.json').read_text())


def cache_path(cache, player_id):
    return cache / f'player-{player_id}.json'


def validate(record, player):
    """Cross-check a parsed profile against the listing row it must belong to."""
    problems = []
    if record['id'] != player['id']:
        problems.append('id')
    if record['snapshot'] != EXPECTED_SNAPSHOT:
        problems.append(f'snapshot {record["snapshot"]}')
    if record['overallRating'] != player['overallRating']:
        problems.append(f'overall {record["overallRating"]} != {player["overallRating"]}')
    if record['potential'] != player['potential']:
        problems.append(f'potential {record["potential"]} != {player["potential"]}')
    if player.get('skillMoves') is not None and record['skillMoves'] != player['skillMoves']:
        problems.append(f'skillMoves {record["skillMoves"]} != {player["skillMoves"]}')
    if player.get('weakFootAbility') is not None and record['weakFootAbility'] != player['weakFootAbility']:
        problems.append(f'weakFoot {record["weakFootAbility"]} != {player["weakFootAbility"]}')
    if len(record['attributes']) != ATTRIBUTE_COUNT:
        problems.append(f'{len(record["attributes"])} attributes')
    if not all(0 <= value <= 99 for value in record['attributes'].values()):
        problems.append('attribute out of range')
    if not record['positionRatings']:
        problems.append('no position ratings')
    if problems:
        raise ValueError(f'Player {player["id"]} ({player["name"]}): ' + '; '.join(problems))


def fetch(args, cli):
    cache = args.cache.resolve()
    cache.mkdir(parents=True, exist_ok=True)
    players = load_players()
    by_id = {player['id']: player for player in players}
    missing = [player for player in players if not cache_path(cache, player['id']).exists()]
    print(f'{len(players) - len(missing)} cached, {len(missing)} missing', flush=True)
    if args.limit:
        missing = missing[:args.limit]
    parser = PROFILE_PARSER.replace('ATTRIBUTE_KEYS_JSON', json.dumps(ATTRIBUTE_KEYS))
    started = time.time()
    done = 0
    for start in range(0, len(missing), args.batch):
        batch = missing[start:start + args.batch]
        jobs = [{'id': player['id'], 'url': player['sourceUrl']} for player in batch]
        expression = parser + FETCH_EXPRESSION.replace('JOBS', json.dumps(jobs)).replace(
            'WORKERS', str(args.workers)).replace('DELAY_MS', str(args.delay_ms))
        records = None
        for attempt in range(6):
            try:
                records = browser_eval(cli, args.page_id, expression)
                break
            except (RuntimeError, subprocess.TimeoutExpired) as error:
                # A blocked site must stop the run; a busy or briefly unreachable Orca runtime is retried.
                if 'BLOCKED' in str(error) or attempt == 5:
                    raise
                print(f'Retry {attempt + 1} after: {str(error)[:120]!r}', flush=True)
                time.sleep(30 * (attempt + 1))
        assert sorted(record['id'] for record in records) == sorted(job['id'] for job in jobs), 'Batch mismatch'
        for record in records:
            validate(record, by_id[record['id']])
        for record in records:
            write_json(cache_path(cache, record['id']), record)
        done += len(records)
        elapsed = time.time() - started
        remaining = (len(missing) - done) * elapsed / done
        print(f'{done}/{len(missing)} fetched; ~{remaining / 60:.0f} min left', flush=True)


def apply(args):
    cache = args.cache.resolve()
    players = load_players()
    missing = [player['id'] for player in players if not cache_path(cache, player['id']).exists()]
    if missing and not args.allow_partial:
        raise SystemExit(f'{len(missing)} players are not cached yet (first: {missing[:5]}). Fetch first or use --allow-partial.')
    updated = 0
    for player in players:
        path = cache_path(cache, player['id'])
        if not path.exists():
            continue
        record = json.loads(path.read_text())
        validate(record, player)
        for field in ('attributes', 'positionRatings', 'roles', 'playStyles', 'specialities'):
            player[field] = record[field]
        updated += 1
    write_players(DATA / 'players.json', players)

    manifest_path = DATA / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['datasets']['playerAttributes'] = {
        'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'snapshotLabel': EXPECTED_SNAPSHOT,
        'playerCount': updated,
        'complete': updated == len(players),
        'source': 'https://www.fifacm.com/player/<id>/<slug> (EA FC 27 profile, Category view)',
        'retrievalMethod': 'Orca browser / in-page fetch / HTML profile',
        'fields': ['attributes', 'positionRatings', 'roles', 'playStyles', 'specialities'],
        'validation': 'Each profile matched players.json on id, overallRating, potential, skillMoves, weakFootAbility and snapshot; 34 attributes per player.',
    }
    manifest['limitations'] = [
        text.replace(
            'Individual profile attributes and birthdates are not collected by the player listing crawl; league IDs are stored in clubs.json and leagues.json.',
            'Birthdates are not collected; profile attributes come from the separate profile crawl (datasets.playerAttributes); league IDs are stored in clubs.json and leagues.json.',
        )
        for text in manifest['limitations']
    ]
    manifest['sha256']['players.json'] = hashlib.sha256((DATA / 'players.json').read_bytes()).hexdigest()
    write_json(manifest_path, manifest)

    readme_path = DATA / 'README.md'
    readme = readme_path.read_text()
    readme = readme.replace('Chưa thu thập thuộc tính ẩn của hồ sơ. ', '')
    section = (
        '\n## Thuộc tính chi tiết cầu thủ\n\n'
        f'`players.json` có thêm 5 trường lấy từ hồ sơ từng cầu thủ (chế độ Category, FC27, snapshot {EXPECTED_SNAPSHOT}) cho **{updated}/{len(players)}** cầu thủ:\n\n'
        '- `attributes`: 34 chỉ số gốc 0–99 (crossing, finishing, headingAccuracy, shortPassing, volleys, dribbling, curve, freeKickAccuracy, longPassing, ballControl, shotPower, jumping, stamina, strength, longShots, acceleration, sprintSpeed, agility, reactions, balance, aggression, interceptions, attackingPosition, vision, penalties, composure, defensiveAwareness, standingTackle, slidingTackle và 5 chỉ số thủ môn `goalkeeper*`). Chỉ số thủ môn của cầu thủ ngoài sân vẫn được nguồn công bố.\n'
        '- `positionRatings`: điểm theo vị trí (RPP) hiển thị trên hồ sơ, ví dụ `{"ST": 90, "RW": 90}`.\n'
        '- `roles`: vai trò theo vị trí, ví dụ `[{"position": "ST", "roles": ["Advanced Forward++", "False 9+"]}]`.\n'
        '- `playStyles`: `[{"name", "isPlus"}]`; `isPlus` đúng khi biểu tượng nguồn thuộc nhóm PlayStyle+.\n'
        '- `specialities`: danh sách Specialities của nguồn.\n\n'
        '`skillMoves`, `weakFootAbility`, `preferredFoot` đã có từ trang danh sách và được đối chiếu với hồ sơ. Mỗi hồ sơ được đối chiếu với `players.json` theo ID, overall, potential, skillMoves, weakFootAbility và ngày snapshot trước khi ghi; không ước lượng chỉ số thiếu.\n\n'
        'Tải lại: mở một trang bất kỳ của fifacm.com trong Orca browser, rồi chạy `python3 -B scripts/crawl_fifacm_player_attributes.py --page-id <orca-page-id> --cache <thư-mục-cache>` (có thể ngắt và chạy lại, đã tải sẽ được bỏ qua), sau đó `--apply` để ghi vào `players.json`.\n'
    )
    if '## Thuộc tính chi tiết cầu thủ' in readme:
        readme = readme.split('\n## Thuộc tính chi tiết cầu thủ')[0].rstrip('\n') + '\n'
    readme_path.write_text(readme.rstrip('\n') + '\n' + section)
    print(f'Applied {updated}/{len(players)} players')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--page-id', help='Orca browser page id of a tab on fifacm.com (fetch step)')
    parser.add_argument('--cache', type=Path, required=True, help='Directory with one JSON per player')
    parser.add_argument('--limit', type=int, help='Fetch only this many missing players (pilot run)')
    parser.add_argument('--batch', type=int, default=40, help='Players per browser call')
    parser.add_argument('--workers', type=int, default=3, help='Parallel fetches inside the page')
    parser.add_argument('--delay-ms', type=int, default=400, help='Pause after each fetch per worker')
    parser.add_argument('--apply', action='store_true', help='Merge the cache into players.json')
    parser.add_argument('--allow-partial', action='store_true', help='With --apply: merge even if some players are not cached')
    arguments = parser.parse_args()
    orca = os.environ.get('ORCA_CLI_COMMAND') or ('orca-dev' if os.environ.get('ORCA_DEV_REPO_ROOT') else 'orca')
    if arguments.apply:
        apply(arguments)
    else:
        if not arguments.page_id:
            parser.error('--page-id is required for fetching')
        fetch(arguments, orca)
