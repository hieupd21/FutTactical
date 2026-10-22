#!/usr/bin/env python3
"""Collect default male club/national lineups and derive explicit roster totals."""

import argparse
from collections import Counter
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import tempfile

from crawl_fifacm import browser_eval
from crawl_fifacm_clubs import EXPRESSION as CLUB_CATALOGUE, write_json, club_financial_totals
from fifacm_formations import infer_formation, load_formation_catalogue, validate_club_formation_references

ROOT = Path(__file__).resolve().parents[1]
NATIONAL_URL = 'https://www.fifacm.com/27/league/78/international'
BUILDER_JS = 'https://cdn.fifacm.com/static/site/js/pages/builder/main/builder.js?v=101125121611'

PROFILES = r"""
(async () => {
  if (location.hostname !== 'www.fifacm.com') throw new Error('Open FIFACM first');
  const results = await Promise.all(SOURCE_TEAMS.map(async team => {
    const response = await fetch(team.sourceUrl, {signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + team.id);
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    if (!/EA FC 27/.test(doc.title)) throw new Error('Wrong edition: ' + doc.title);
    const snapshot = [...doc.querySelectorAll('a,button')].map(e => e.textContent.trim())
      .find(s => /^\d+(st|nd|rd|th) of \w+ 2026$/.test(s));
    const playerId = anchor => {
      const match = anchor?.getAttribute('href')?.match(/\/(?:27\/)?player\/(\d+)\//);
      if (!match) throw new Error('Missing player ID: ' + team.id);
      return Number(match[1]);
    };
    const tables = [...doc.querySelectorAll('table')].filter(t => t.querySelector('tr.player-row'));
    const playerIds = [...(tables[0]?.querySelectorAll('tr.player-row .player-name a') || [])].map(playerId);
    const startingXI = [...doc.querySelectorAll('.field-container .player-holder')].map(holder => ({
      playerId: playerId(holder.querySelector('a')),
      position: holder.querySelector('.ph-card-player-position')?.textContent.trim(),
      overallRating: Number(holder.querySelector('.ph-card-player-rating')?.textContent.trim()),
      sourcePositionId: Number(holder.className.match(/\bpht(\d+)\b/)?.[1]),
    }));
    const profiles = Object.fromEntries([...doc.querySelectorAll('.site-top-profile')].map(e => [
      e.querySelector('.site-top-profile-title')?.textContent.trim(),
      e.querySelector('.site-top-profile-value')?.textContent.trim(),
    ]));
    if (Number(profiles.Id) !== team.id) throw new Error('Wrong team profile');
    if (!playerIds.length || new Set(playerIds).size !== playerIds.length) throw new Error('Invalid roster: ' + team.id);
    return {id: team.id, sourceUrl: response.url, title: doc.title, snapshotLabel: snapshot,
      playerIds, startingXI, overallRating: Number(profiles.Rating),
      retrievedAt: new Date().toISOString()};
  }));
  return JSON.stringify(results);
})()
"""


def squad_data(team, profile, players, variants):
    assert profile['id'] == team['id']
    assert profile['snapshotLabel'] == '6th of Oct 2026', profile['snapshotLabel']
    assert profile['overallRating'] == team['overallRating'], f'Rating changed: {team["id"]}'
    ids = profile['playerIds']
    assert set(ids) <= players.keys(), f'Unknown roster players: {set(ids) - players.keys()}'
    lineup = profile['startingXI']
    assert 0 < len(lineup) <= 11 and len({p['playerId'] for p in lineup}) == len(lineup), f'Invalid XI: {team["id"]}'
    if team.get('teamType') != 'national':
        assert len(lineup) == 11, f'Incomplete club XI: {team["id"]}'
    assert {p['playerId'] for p in lineup} <= set(ids), f'XI outside roster: {team["id"]}'
    assert all(p['position'] and 0 < p['overallRating'] <= 99 for p in lineup)
    positions = Counter(p['position'] for p in lineup)
    candidates = [f['code'] for f in variants if Counter(f['positions']) == positions]
    code = candidates[0] if len(candidates) == 1 else None
    shapes = {c.split('-')[0] for c in candidates}
    return {
        'formation': code,
        'formationShape': '-'.join(next(iter(shapes))) if len(shapes) == 1 else None,
        'formationCandidates': candidates,
        'formationMethod': 'Exact position-multiset match against FIFACM squad-builder definitions; null if ambiguous or unmatched.',
        'rating': profile['overallRating'],
        'ratingMethod': 'FIFACM team profile Rating; not a calculated community-squad rating.',
        'valueEur': sum(players[pid]['valueEur'] for pid in ids),
        'wageEur': sum(players[pid]['wageEur'] for pid in ids),
        'financialScope': 'All source-displayed playerIds, including substitutes/reserves; excludes loaned-out players. National rosters may be partial.',
        'financialMethod': 'Sum of players.json valueEur/wageEur; source player amounts may be rounded.',
        'wagePeriod': 'week',
        'startingXI': lineup,
        'startingXIComplete': len(lineup) == 11,
        'missingStartingPlayerCount': 11 - len(lineup),
        'snapshotDate': '2026-10-06',
        'sourceUrl': profile['sourceUrl'],
        'retrievedAt': profile['retrievedAt'],
    }


def run(args):
    directory = ROOT/'data/fifacm'
    preserved = {name: hashlib.sha256((directory/name).read_bytes()).hexdigest()
                 for name in ['players.json', 'leagues.json', 'clubs.json']}
    players = {p['id']: p for p in json.loads((directory/'players.json').read_text())}
    assert players and all(p['gender']['id'] == 0 and p['fifaVersion'] == 27 for p in players.values())
    clubs = json.loads((directory/'clubs.json').read_text())
    formations = load_formation_catalogue(args.formations)
    variants = [v for formation in formations for v in formation.get('variants', [])]
    cli = os.environ.get('ORCA_CLI_COMMAND') or 'orca'
    cache = args.cache
    cache.mkdir(parents=True, exist_ok=True)
    catalogue = browser_eval(cli, args.page_id, CLUB_CATALOGUE.replace(
        "fetch('/teams'", "fetch('/27/league/78/international'").replace(
        '/EA FC 27 Teams/', '/EA FC 27 International/'))
    nationals = catalogue['clubs']
    assert len({t['id'] for t in nationals}) == len(nationals) and nationals
    assert not ({t['id'] for t in nationals} & {t['id'] for t in clubs})
    write_json(cache/'national-catalogue.json', catalogue)
    teams = clubs + nationals
    for offset in range(0, len(teams), 4):
        batch = teams[offset:offset+4]
        missing = [t for t in batch if not (cache/f'team-{t["id"]}.json').exists()]
        if missing:
            result = browser_eval(cli, args.page_id, PROFILES.replace('SOURCE_TEAMS', json.dumps(
                [{'id': t['id'], 'sourceUrl': t['sourceUrl']} for t in missing])))
            assert {p['id'] for p in result} == {t['id'] for t in missing}
            for profile in result:
                write_json(cache/f'team-{profile["id"]}.json', profile)
        if offset % 40 == 0 or offset+4 >= len(teams):
            print(f'Profiles {min(offset+4,len(teams))}/{len(teams)}', flush=True)

    club_ids = {team['id'] for team in clubs}
    national_squads = {}
    for team in teams:
        profile = json.loads((cache/f'team-{team["id"]}.json').read_text())
        if team['id'] in club_ids:
            assert set(profile['playerIds']) == set(team['playerIds']), f'Club roster changed: {team["id"]}'
            assert len(profile['startingXI']) == 11
            assert {p['playerId'] for p in profile['startingXI']} <= set(team['playerIds'])
            team.pop('squadBuilder', None)
            team.update(club_financial_totals(team, players))
            team['startingXI'] = profile['startingXI']
            team['formation'] = infer_formation(team['startingXI'])
        else:
            team['gender'] = {'id': 0, 'label': 'Male'}
            team['teamType'] = 'national'
            team['playerIds'] = profile['playerIds']
            team['squadBuilder'] = squad_data(team, profile, players, variants)
            national_squads[team['id']] = team['squadBuilder']
    nationals.sort(key=lambda t: t['id'])
    validate_club_formation_references(clubs, formations)
    nations_by_id = {}
    for player in players.values():
        nationality = player['nationality']
        nation = nations_by_id.setdefault(nationality['id'], {
            key: nationality[key] for key in ['id', 'label', 'imageUrl']
        })
        assert nation['label'] == nationality['label'], 'Conflicting nationality labels'
        if not nation['imageUrl'] and nationality.get('imageUrl'):
            nation['imageUrl'] = nationality['imageUrl']
    for team in nationals:
        nation_ids = {players[pid]['nationality']['id'] for pid in team['playerIds']}
        assert len(nation_ids) == 1, f'Mixed nationality roster: {team["id"]}'
        team['nationId'] = next(iter(nation_ids))
        assert team['nationId'] in nations_by_id
    nations = [nations_by_id[nid] for nid in sorted(nations_by_id)]
    manifest = json.loads((directory/'manifest.json').read_text())
    assert all(manifest['sha256'][n] == h == hashlib.sha256((directory/n).read_bytes()).hexdigest()
               for n, h in preserved.items()), 'Input dataset changed during crawl'
    # All validations above run before any published data changes.
    write_json(directory/'clubs.json', clubs)
    write_json(directory/'national-teams.json', nationals)
    write_json(directory/'nations.json', nations)
    write_json(directory/'formations.json', formations)
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    manifest['datasets']['nationalTeams'] = {
        'file': 'national-teams.json', 'sourceUrl': NATIONAL_URL, 'fifaVersion': 27,
        'snapshotDate': '2026-10-06', 'retrievedAt': now,
        'teamCount': len(nationals), 'rosterLinkCount': sum(len(t['playerIds']) for t in nationals),
        'selection': 'All teams in the FC27 International group with the Male database selected.',
        'completeForSourceGroup': True,
        'limitations': ['National playerIds are the source-selected squad, not every eligible player of that nationality.',
                       'Some source rosters and pitch lineups omit players; financial totals cover only the displayed playerIds, not a verified complete national squad.',
                       'International is a source group; it is not added to the club-only leagues.json relationships.'],
    }
    manifest['datasets']['formations'] = {
        'file': 'formations.json', 'sourceUrl': BUILDER_JS,
        'labelSourceUrl': 'https://www.fifacm.com/squad-builder', 'count': len(formations),
        'schemaVersion': 2, 'variantCount': len(variants),
        'clubReference': 'clubs[].formation -> formations[].id',
        'normalization': 'Basic shape IDs with id/label/lines; original source builder definitions retained in variants.',
        'retrievedAt': now,
    }
    manifest['datasets']['nations'] = {
        'file': 'nations.json', 'source': 'Distinct players.json nationality objects, grouped by original ID.',
        'nationCount': len(nations), 'linkedPlayerCount': len(players),
        'fields': ['id', 'label', 'imageUrl'],
        'playerReference': 'players[].nationality.id -> nations[].id',
        'nationalTeamReference': 'national-teams[].nationId -> nations[].id',
        'nationalTeamNationMethod': 'National team nationId is the single nationality.id shared by every player in its source-selected roster.',
        'limitations': ['This is the nationality catalogue represented by the existing players; it is not a complete list of countries worldwide.',
                       'References are stored on players and national teams; the nationality catalogue does not store reverse membership lists.'],
    }
    manifest['datasets']['clubs']['limitations'] = [s.replace(
        'Clubs without players in the male player dataset are outside this selection; national teams are not collected.',
        'Clubs without players in the male dataset are outside this selection; national teams are stored separately in national-teams.json.')
        .replace('League IDs are linked through league membership pages; manager names, stadium names, and tactical profiles are not collected.',
                 'League IDs are source-linked; default club lineups are stored in startingXI. Manager and stadium names are not collected.')
        .replace('default lineups are stored in squadBuilder', 'default club lineups are stored in startingXI')
        for s in manifest['datasets']['clubs']['limitations']]
    manifest['datasets']['teamProfiles'] = {
        'clubCount': len(clubs), 'nationalTeamCount': len(nationals), 'retrievedAt': now,
        'snapshotDate': '2026-10-06', 'financialScope': 'Full source roster; derived sum of player value/wage.',
        'ratingSource': 'Team profile Rating',
        'formationMethod': 'Exact multiset of starting XI positions matched to source builder definitions.',
        'unresolvedFormations': [{'id': t['id'], 'label': t['label'], 'candidates': t['squadBuilder']['formationCandidates']}
                                 for t in nationals if t['squadBuilder']['formation'] is None],
        'clubFormationStatus': 'Inferred basic shape from startingXI positions; null for incomplete or unrecognized lineups.',
        'communitySquadsImported': False,
        'incompleteNationalStartingXIs': [
            {'id': t['id'], 'label': t['label'], 'displayedPlayers': len(t['squadBuilder']['startingXI'])}
            for t in nationals if not t['squadBuilder']['startingXIComplete']],
    }
    for name in ['clubs.json', 'national-teams.json', 'nations.json', 'formations.json']:
        manifest['sha256'][name] = hashlib.sha256((directory/name).read_bytes()).hexdigest()
    manifest['validation'].update({
        'allNationalPlayerReferencesValid': True,
        'allTeamStartingXIsComplete': all(s['startingXIComplete'] for s in national_squads.values()),
        'allClubStartingXIsComplete': True,
        'allTeamProfileSnapshotDatesMatch': True, 'clubRosterMatchesProfile': True,
        'allPlayerNationalityReferencesValid': True, 'nationalTeamNationLinksValid': True,
        'clubFormationReferencesValid': True,
    })
    manifest['clubFormationReference'] = {'field': 'formation', 'target': 'formations.json:id', 'nullable': True}
    write_json(directory/'manifest.json', manifest)
    readme_path = directory/'README.md'
    old_readme = readme_path.read_text()
    _, club_notes_marker, club_notes = old_readme.partition('\n## Giá trị, lương và sơ đồ CLB\n')
    readme = old_readme.split('\n## Đội tuyển và quốc tịch\n')[0]
    readme = readme.replace('Mã giải được liên kết từ trang giải; chưa thu thập HLV, tên sân hoặc chiến thuật.',
                            'Mã giải được liên kết từ trang giải; đội hình CLB nằm trong startingXI. Chưa thu thập HLV hoặc tên sân.')
    readme += (
        '\n## Đội tuyển và quốc tịch\n\n'
        f'`national-teams.json` có **{len(nationals)} đội tuyển nam**, lấy toàn bộ nhóm '
        f'International FC27: {NATIONAL_URL}. `playerIds` là danh sách được nguồn triệu tập, '
        'tham chiếu `players[].id`; không phải mọi cầu thủ cùng quốc tịch. '
        'Đội tuyển được lưu riêng, không thay `clubId` hoặc quan hệ CLB–giải.\n\n'
        f'`nations.json` có **{len(nations)} quốc tịch** xuất hiện trong bộ cầu thủ. '
        'Mỗi quốc tịch chỉ có `id`, `label`, `imageUrl`; không lưu danh sách liên kết ngược. '
        '`players[].nationality.id` → `nations[].id`; `national-teams[].nationId` → `nations[].id`. '
        'Mã quốc gia và mã đội tuyển khác nhau; liên kết được xác nhận bằng việc toàn bộ tuyển thủ có cùng nationality.id. '
        'Danh mục quốc tịch được nhóm từ dữ liệu cầu thủ, không phải danh sách mọi quốc gia trên thế giới.\n\n'
        '## Đội hình mặc định\n\n'
        'CLB lưu trực tiếp `squadValueEur`, `weeklyWageEur`, `startingXI`; `formation` là sơ đồ cơ bản suy ra từ 11 vị trí. '
        '`worthEur` giữ Worth của nguồn, độc lập với tổng giá trị cầu thủ. '
        'Phần dưới chỉ mô tả `national-teams[].squadBuilder`:\n\n'
        '- `startingXI`: các cầu thủ hiển thị trên sân, vị trí, rating và mã vị trí nguồn. '
        'Toàn bộ CLB đủ 11 người; một số đội tuyển thiếu người ngay trên trang nguồn. '
        '`startingXIComplete` và `missingStartingPlayerCount` ghi rõ tình trạng; không tự điền người thiếu.\n'
        '- `rating`: Rating trên hồ sơ đội FIFACM, giống `overallRating` của đội.\n'
        '- `valueEur`, `wageEur`: tổng các trường tương ứng trong `players.json` của toàn bộ `playerIds`, '
        'gồm đá chính, dự bị và dự trữ được nguồn hiển thị; không gồm cầu thủ đã cho mượn đi. Lương theo tuần. '
        'Danh sách đội tuyển có thể thiếu người, nên không coi tổng đó là giá trị/lương của đội tuyển đầy đủ đã được xác minh. '
        'Đây là số tổng hợp; các số cầu thủ nguồn có thể đã được làm tròn. Không dùng `worthEur` thay tổng giá trị cầu thủ.\n'
        '- `formation`: mã Squad Builder khi tập hợp vị trí của XI khớp duy nhất một định nghĩa. '
        '`formationCandidates` giữ các mã khớp; `formationShape` giữ dạng cơ bản khi các mã cùng sơ đồ. '
        'Nếu không khớp hoặc không xác định duy nhất, giữ null; không tự gán biến thể.\n\n'
        '`formations.json` là danh mục sơ đồ dùng chung, mỗi mục có `id`, `label`, `lines` và `variants`. '
        '`clubs[].formation` tham chiếu `formations[].id`, ví dụ `4-2-3-1`. '
        'Các định nghĩa gốc từ JavaScript Squad Builder được giữ trong `variants` với `code`, `label`, `positions`; '
        'mã `national-teams[].squadBuilder.formation` thuộc `variants[].code`. '
        'Vị trí mẫu có thể khác hồ sơ đội; các trường null của đội tuyển được liệt kê trong '
        '`manifest.datasets.teamProfiles.unresolvedFormations`. Không nhập đội hình cộng đồng từ `/squads`. '
        'Snapshot hồ sơ đội và cầu thủ đều **6/10/2026**.\n\n'
        'Tải lại: `python3 -B scripts/crawl_fifacm_team_profiles.py --page-id <orca-page-id> '
        '--formations data/fifacm/formations.json --cache <thư-mục-cache>`. '
        'Dùng cache mới khi tải snapshot mới. Các tham chiếu cầu thủ, danh sách CLB và ngày snapshot được kiểm tra trước khi xuất.\n'
    )
    if club_notes_marker:
        readme += club_notes_marker + club_notes
    readme_path.write_text(readme)
    assert all(hashlib.sha256((directory/n).read_bytes()).hexdigest() == preserved[n]
               for n in ['players.json', 'leagues.json'])
    print(json.dumps({'clubs': len(clubs), 'nationals': len(nationals), 'nations': len(nations),
        'unresolvedFormations': len(manifest['datasets']['teamProfiles']['unresolvedFormations']),
        'playersAndLeaguesUnchanged': True}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--page-id', required=True)
    parser.add_argument('--cache', type=Path, default=Path(tempfile.gettempdir())/'fifacm-team-profiles')
    parser.add_argument('--formations', type=Path, required=True,
                        help='Normalized formation catalogue with basic IDs and nested source variants')
    run(parser.parse_args())
