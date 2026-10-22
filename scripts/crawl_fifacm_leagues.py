#!/usr/bin/env python3
"""Collect FIFACM league membership for the existing male club dataset."""

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import tempfile

from crawl_fifacm import browser_eval
from crawl_fifacm_clubs import write_json


ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = r"""
(async () => {
  const response = await fetch('/leagues', {signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  if (!/EA FC 27 Leagues/.test(doc.title)) throw new Error('Wrong edition');
  const leagues = [...doc.querySelectorAll('a[href]')]
    .filter(a => /\/27\/league\/\d+\//.test(a.getAttribute('href')))
    .map(a => {
      const image = a.querySelector('img');
      const path = image?.getAttribute('data-lazy-src') || image?.getAttribute('src');
      return {id: Number(a.getAttribute('href').match(/\/league\/(\d+)\//)[1]),
        label: a.textContent.trim(), imageUrl: path ? new URL(path, response.url).href : null,
        sourceUrl: new URL(a.getAttribute('href'), response.url).href};
    });
  return JSON.stringify({sourceUrl: response.url, leagues});
})()
"""
MEMBERS = r"""
(async () => {
  const response = await fetch(SOURCE_URL, {signal: AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  if (!/EA FC 27/.test(doc.title)) throw new Error('Wrong edition: ' + doc.title);
  const cards = [...doc.querySelectorAll('a.team-col[href]')]
    .filter(a => /\/27\/team\/\d+\//.test(a.getAttribute('href')));
  const teamIds = cards.map(a => Number(a.getAttribute('href').match(/\/team\/(\d+)\//)[1]));
  if (new Set(teamIds).size !== teamIds.length) throw new Error('Duplicate team IDs');
  return JSON.stringify({sourceUrl: response.url, sourceTeamIds: teamIds,
    hasPagination: doc.querySelectorAll('.pagination a').length > 0});
})()
"""
CLUB_LEAGUES = r"""
(async () => {
  const response = await fetch(SOURCE_URL, {signal: AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  if (!/EA FC 27/.test(doc.title)) throw new Error('Wrong edition: ' + doc.title);
  const leagues = [...doc.querySelectorAll('a[href]')]
    .filter(a => /\/27\/league\/\d+\//.test(a.getAttribute('href')))
    .map(a => ({id: Number(a.getAttribute('href').match(/\/league\/(\d+)\//)[1]),
      label: a.textContent.trim(), sourceUrl: new URL(a.getAttribute('href'), response.url).href,
      imageUrl: null}));
  return JSON.stringify({sourceUrl: response.url, leagues});
})()
"""


def run(args):
    directory = ROOT/'data/fifacm'
    player_digest = hashlib.sha256((directory/'players.json').read_bytes()).hexdigest()
    club_path = directory/'clubs.json'
    clubs = json.loads(club_path.read_text())
    original_clubs = json.loads(club_path.read_text())
    club_ids = {club['id'] for club in clubs}
    cli = os.environ.get('ORCA_CLI_COMMAND') or ('orca-dev' if os.environ.get('ORCA_DEV_REPO_ROOT') else 'orca')
    cache = args.cache or Path(tempfile.mkdtemp(prefix='fifacm-leagues-'))
    cache.mkdir(parents=True, exist_ok=True)
    catalogue = browser_eval(cli, args.page_id, CATALOGUE)
    assert catalogue['leagues']
    write_json(cache/'catalogue.json', catalogue)
    definitions = {league['id']: league for league in catalogue['leagues']}
    assert len(definitions) == len(catalogue['leagues'])
    memberships = {}
    print(f'Catalogue {len(definitions)} groups; cache {cache}', flush=True)

    def fetch_members(league):
        cache_path = cache/f'league-{league["id"]}.json'
        if cache_path.exists():
            data = json.loads(cache_path.read_text())
        else:
            data = browser_eval(cli, args.page_id, MEMBERS.replace('SOURCE_URL', json.dumps(league['sourceUrl'])))
            write_json(cache_path, data)
        assert not data['hasPagination'], 'Paginated league membership requires additional pages'
        memberships[league['id']] = data

    for i, league in enumerate(catalogue['leagues'], 1):
        fetch_members(league)
        if i % 10 == 0 or i == len(definitions):
            print(f'League pages {i}/{len(catalogue["leagues"])}', flush=True)

    def covered_ids():
        return {tid for data in memberships.values() for tid in data['sourceTeamIds']} & club_ids

    recovered = []
    for club in clubs:
        if club['id'] in covered_ids():
            continue
        cache_path = cache/f'club-{club["id"]}-leagues.json'
        if cache_path.exists():
            data = json.loads(cache_path.read_text())
        else:
            data = browser_eval(cli, args.page_id, CLUB_LEAGUES.replace('SOURCE_URL', json.dumps(club['sourceUrl'])))
            write_json(cache_path, data)
        for league in data['leagues']:
            if league['id'] not in definitions:
                definitions[league['id']] = league
                recovered.append(league['id'])
                fetch_members(league)
                print(f'Recovered group {league["id"]}: {league["label"]}', flush=True)
            # Keep direct club-profile evidence even if the group page is incomplete.
            if club['id'] not in memberships[league['id']]['sourceTeamIds']:
                memberships[league['id']].setdefault('profileConfirmedTeamIds', []).append(club['id'])

    leagues = []
    for league_id in sorted(definitions):
        definition = definitions[league_id]
        membership = memberships[league_id]
        confirmed = set(membership['sourceTeamIds']) | set(membership.get('profileConfirmedTeamIds', []))
        selected = sorted(confirmed & club_ids)
        if not selected:
            continue
        leagues.append({**definition, 'fifaVersion': 27, 'gender': {'id': 0, 'label': 'Male'},
            'teamIds': selected, 'sourceTeamCount': len(membership['sourceTeamIds']),
            'listedInCatalogue': league_id not in recovered})
    by_league = {league['id']: league for league in leagues}
    for club in clubs:
        club['leagueIds'] = [league['id'] for league in leagues if club['id'] in league['teamIds']]
    unresolved = [club['id'] for club in clubs if not club['leagueIds']]
    assert not unresolved, f'Clubs without source-confirmed league: {unresolved}'
    by_club = {club['id']: club for club in clubs}
    assert all(lid in by_league and club['id'] in by_league[lid]['teamIds'] for club in clubs for lid in club['leagueIds'])
    assert all(cid in by_club and league['id'] in by_club[cid]['leagueIds'] for league in leagues for cid in league['teamIds'])
    assert [{k:v for k,v in club.items() if k != 'leagueIds'} for club in clubs] == [
        {k:v for k,v in club.items() if k != 'leagueIds'} for club in original_clubs]
    assert hashlib.sha256((directory/'players.json').read_bytes()).hexdigest() == player_digest
    manifest_path = directory/'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    assert manifest['sha256']['players.json'] == player_digest
    assert manifest['sha256']['clubs.json'] == hashlib.sha256(club_path.read_bytes()).hexdigest()
    write_json(directory/'leagues.json', leagues)
    write_json(club_path, clubs)
    manifest.setdefault('datasets', {})['leagues'] = {
        'file': 'leagues.json', 'sourceUrl': catalogue['sourceUrl'], 'fifaVersion': 27,
        'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'snapshotDate': None,
        'catalogueGroupCount': len(catalogue['leagues']), 'leagueCount': len(leagues),
        'linkedClubCount': len(clubs), 'relationshipCount': sum(len(league['teamIds']) for league in leagues),
        'recoveredGroupIds': recovered, 'clubsWithoutLeague': unresolved,
        'excludedGroups': [{'id': league['id'], 'label': league['label']} for league in catalogue['leagues'] if league['id'] not in by_league],
        'completeForExistingClubs': True,
        'selection': 'Only groups with source-confirmed memberships among the existing male clubs; groups without selected clubs are excluded.',
        'limitations': ['Source pages do not display a snapshot date.',
            'teamIds contains only clubs in clubs.json; sourceTeamCount may be larger.',
            'Group membership follows FIFACM, including continental competitions and any provider-specific group names.'],
    }
    limitations = manifest['datasets']['clubs']['limitations']
    manifest['datasets']['clubs']['limitations'] = [
        text.replace('League IDs, manager names, stadium names, and tactical profiles require individual club pages and are not collected here.',
                     'League IDs are linked through league membership pages; manager names, stadium names, and tactical profiles are not collected.')
        for text in limitations]
    for name in ['clubs.json', 'leagues.json']:
        manifest['sha256'][name] = hashlib.sha256((directory/name).read_bytes()).hexdigest()
    manifest['validation']['clubLeagueLinksValidBothDirections'] = True
    manifest['validation']['allClubsHaveSourceConfirmedLeague'] = True
    write_json(manifest_path, manifest)
    readme_path = directory/'README.md'
    original_readme = readme_path.read_text()
    _, marker, extra_notes = original_readme.partition('\n## Chuẩn hóa cầu thủ\n')
    readme = original_readme.split('\n## Giải đấu\n')[0]
    readme = readme.replace('Chưa tải trang chi tiết để lấy mã giải, HLV, tên sân hoặc chiến thuật.',
        'Mã giải được liên kết từ trang giải; chưa thu thập HLV, tên sân hoặc chiến thuật.')
    readme += (
        '\n## Giải đấu\n\n'
        f'`leagues.json` có **{len(leagues)} nhóm giải/đấu trường**, liên kết đủ **{len(clubs)} CLB** hiện tại. '
        '`leagues[].teamIds` tham chiếu `clubs[].id`; `clubs[].leagueIds` tham chiếu ngược `leagues[].id`. '
        'ID giải là số. Quan hệ có thể nhiều–nhiều.\n\n'
        'Nguồn danh mục https://www.fifacm.com/leagues và trang chi tiết từng giải; '
        'CLB chưa có trong các trang đó được kiểm tra thêm qua liên kết giải ở hồ sơ CLB. '
        'Chỉ lưu các nhóm có CLB trong bộ nam hiện tại. Không tạo giải hoặc CLB giả cho cầu thủ tự do. '
        '`sourceTeamCount` là số đội trên trang nguồn, có thể lớn hơn số đội được chọn trong `teamIds`. '
        'Tên và cách phân nhóm giữ theo FIFACM; các trang danh mục không công bố ngày snapshot.\n\n'
        'Tải lại: `python3 -B scripts/crawl_fifacm_leagues.py --page-id <orca-page-id>`.\n'
    )
    if marker:
        readme += marker + extra_notes
    readme_path.write_text(readme)
    print(json.dumps({'leagues': len(leagues), 'clubs': len(clubs),
        'relationships': sum(len(league['teamIds']) for league in leagues),
        'recoveredGroups': recovered, 'allLinksValid': True,
        'groups': [{'id': league['id'], 'label': league['label'], 'clubs': len(league['teamIds'])} for league in leagues]}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--page-id', required=True)
    parser.add_argument('--cache', type=Path)
    run(parser.parse_args())
