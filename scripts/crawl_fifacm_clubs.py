#!/usr/bin/env python3
"""Collect FIFACM club cards linked to the existing male player dataset."""

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import tempfile

from crawl_fifacm import browser_eval, player_club_id
from fifacm_formations import infer_formation, load_formation_catalogue, validate_club_formation_references


ROOT = Path(__file__).resolve().parents[1]
EXPRESSION = r"""
(async () => {
  if (location.hostname !== 'www.fifacm.com') throw new Error('Open FIFACM first');
  const response = await fetch('/teams', {signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  if (!/EA FC 27 Teams/.test(doc.title)) throw new Error('Wrong edition: ' + doc.title);
  const clubs = [...doc.querySelectorAll('.team-col')].map(card => {
    const id = card.id.match(/^team_(\d+)$/)?.[1];
    if (!id) throw new Error('Missing team ID');
    const value = name => {
      const raw = card.dataset[name];
      if (raw == null || raw === '') return null;
      if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new Error('Invalid ' + name + ': ' + raw);
      return Number(raw);
    };
    const image = card.querySelector('.team-img img');
    const imagePath = image?.getAttribute('data-lazy-src') || image?.getAttribute('src');
    const holder = card.querySelector('.team-holder');
    return {
      id: Number(id), label: card.querySelector('.team-name')?.textContent.trim(), fifaVersion: 27,
      imageUrl: imagePath ? new URL(imagePath, response.url).href : null,
      overallRating: value('ovr'), attack: value('att'), midfield: value('mid'), defense: value('def'),
      worthEur: value('worth'), budgetEur: value('budget'), foundationYear: value('foundation'),
      stadiumCapacity: value('capacity'), averageAge: value('age'),
      youthDevelopment: value('youth'), profitability: value('profitability'),
      internationalPrestige: value('international'),
      colors: {background: holder?.style.background || null, text: card.style.color || null},
      sourceUrl: new URL(card.getAttribute('href'), response.url).href,
      sourceAttributes: {...card.dataset},
    };
  });
  return JSON.stringify({sourceUrl: response.url, title: doc.title, clubs});
})()
"""


def write_json(path, data):
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, prefix='.'+path.name+'-', delete=False) as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write('\n')
        pending = file.name
    os.replace(pending, path)


def club_financial_totals(club, players):
    """Sum the current playing roster; Worth and transfer Budget remain source fields."""
    ids = club['playerIds']
    assert len(ids) == len(set(ids)), f'Duplicate roster members: {club["id"]}'
    assert set(ids) <= players.keys(), f'Unknown roster members: {club["id"]}'
    assert all(player_club_id(players[pid]) == club['id'] for pid in ids)
    for pid in ids:
        for key in ['valueEur', 'wageEur']:
            value = players[pid][key]
            assert type(value) is int and value >= 0, f'Invalid {key}: {pid}'
    return {
        'squadValueEur': sum(players[pid]['valueEur'] for pid in ids),
        'weeklyWageEur': sum(players[pid]['wageEur'] for pid in ids),
    }


def run(page_id):
    directory = ROOT/'data/fifacm'
    formations = load_formation_catalogue(directory/'formations.json')
    player_path = directory/'players.json'
    digest = hashlib.sha256(player_path.read_bytes()).hexdigest()
    players = json.loads(player_path.read_text())
    by_id = {player['id']: player for player in players}
    assert players and all(player['gender']['id'] == 0 for player in players)
    members = {}
    for player in players:
        club_id = player_club_id(player)
        if club_id is not None:
            members.setdefault(club_id, []).append(player['id'])
    existing = {club['id']: club for club in json.loads((directory/'clubs.json').read_text())} if (directory/'clubs.json').exists() else {}
    cli = os.environ.get('ORCA_CLI_COMMAND') or ('orca-dev' if os.environ.get('ORCA_DEV_REPO_ROOT') else 'orca')
    catalogue = browser_eval(cli, page_id, EXPRESSION)
    all_clubs = {club['id']: club for club in catalogue['clubs']}
    assert len(all_clubs) == len(catalogue['clubs']), 'Duplicate source club IDs'
    missing = set(members)-set(all_clubs)
    assert not missing, f'Player clubs missing from catalogue: {sorted(missing)}'
    clubs = []
    for club_id in sorted(members):
        club = all_clubs[club_id]
        assert club['label'] and club['fifaVersion'] == 27
        club['gender'] = {'id': 0, 'label': 'Male'}
        club['playerIds'] = members[club_id]
        if 'leagueIds' in existing.get(club_id, {}):
            club['leagueIds'] = existing[club_id]['leagueIds']
        club.update(club_financial_totals(club, by_id))
        club['formation'] = None
        if 'startingXI' in existing.get(club_id, {}):
            old = existing[club_id]
            assert set(old['playerIds']) == set(club['playerIds']), 'Roster changed; refresh team profiles before replacing the catalogue'
            assert old['overallRating'] == club['overallRating'], 'Rating changed; refresh team profiles'
            club['startingXI'] = old['startingXI']
            club['formation'] = infer_formation(club['startingXI'])
        clubs.append(club)
    validate_club_formation_references(clubs, formations)
    linked = [player_id for club in clubs for player_id in club['playerIds']]
    assert len(linked) == len(set(linked)) == sum(player_club_id(player) is not None for player in players)
    assert all(player_club_id(by_id[player_id]) == club['id'] for club in clubs for player_id in club['playerIds'])
    if (directory/'leagues.json').exists():
        leagues = {league['id']: league for league in json.loads((directory/'leagues.json').read_text())}
        by_club = {club['id']: club for club in clubs}
        assert all(club.get('leagueIds') for club in clubs), 'New club IDs require a matching league dataset'
        assert all(lid in leagues and club['id'] in leagues[lid]['teamIds'] for club in clubs for lid in club['leagueIds'])
        assert all(cid in by_club and league['id'] in by_club[cid]['leagueIds'] for league in leagues.values() for cid in league['teamIds'])
    manifest_path = directory/'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    assert manifest['sha256']['players.json'] == digest
    write_json(directory/'clubs.json', clubs)
    previous_limitations = manifest.get('datasets', {}).get('clubs', {}).get('limitations')
    manifest.setdefault('datasets', {})['clubs'] = {
        'file': 'clubs.json', 'sourceUrl': catalogue['sourceUrl'], 'fifaVersion': 27,
        'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'catalogueTeamCount': len(all_clubs),
        'clubCount': len(clubs), 'linkedPlayerCount': len(linked),
        'selection': 'Only club IDs referenced by the existing male players.json; other catalogue teams are excluded.',
        'completeForPlayerClubReferences': True, 'missingPlayerClubIds': [],
        'snapshotDate': None,
        'limitations': [
            'The team catalogue does not display a squad snapshot date. Player and club retrieval dates are recorded separately.',
            'Clubs without players in the male player dataset are outside this selection; national teams are not collected.',
            'Financial numbers are copied from HTML data-worth/data-budget attributes, not inferred from rounded card labels.',
            'Source-zero budgets are preserved as zero and are unverified; zero should not be interpreted as a confirmed usable budget.',
            'Existing leagueIds are preserved when leagues.json is present; manager names, stadium names, and tactical profiles are not collected here.',
        ],
        'sourceZeroBudgetCount': sum(club['budgetEur'] == 0 for club in clubs),
    }
    if previous_limitations and all('squadValueEur' in club for club in clubs):
        manifest['datasets']['clubs']['limitations'] = previous_limitations
    manifest['sha256']['clubs.json'] = hashlib.sha256((directory/'clubs.json').read_bytes()).hexdigest()
    manifest['validation']['allPlayerClubReferencesValid'] = True
    manifest['validation']['clubPlayerLinksValidBothDirections'] = True
    manifest['validation']['clubFormationReferencesValid'] = True
    manifest['clubFormationReference'] = {'field': 'formation', 'target': 'formations.json:id', 'nullable': True}
    write_json(manifest_path, manifest)
    readme_path = directory/'README.md'
    original_readme = readme_path.read_text()
    _, marker, league_notes = original_readme.partition('\n## Giải đấu\n')
    readme = original_readme.split('\n## Câu lạc bộ\n')[0]
    readme += (
        '\n## Câu lạc bộ\n\n'
        f'`clubs.json` có **{len(clubs)} CLB** được tham chiếu bởi cầu thủ nam trong `players.json`. '
        '`players[].clubId` liên kết `clubs[].id`; `clubs[].playerIds` liên kết ngược về `players[].id`. '
        'Cầu thủ tự do giữ `clubId: null` và không được gán vào CLB giả.\n\n'
        'Nguồn: https://www.fifacm.com/teams, FC27. Danh mục không hiển thị ngày snapshot; '
        'thời điểm tải và phạm vi chọn nằm trong `manifest.datasets.clubs`. '
        'Đây là danh mục CLB có cầu thủ trong bộ nam hiện tại, không phải toàn bộ mọi đội trên website.\n\n'
        'Các trường: ID, tên, URL logo, overall/attack/midfield/defense, worthEur, budgetEur, '
        'foundationYear, stadiumCapacity, averageAge, youthDevelopment, profitability, internationalPrestige, '
        'màu hiển thị, sourceUrl và sourceAttributes. '
        'Số tiền lấy trực tiếp từ data attribute của HTML, có thể chính xác hơn nhãn K/M/B đã làm tròn. '
        'Ngân sách 0 được giữ theo nguồn và chưa xác minh; không coi đó là ngân sách sử dụng đã được xác nhận. '
        'Quan hệ giải dùng leagueIds nếu đã tải leagues.json. '
        '`squadValueEur` là tổng giá trị cầu thủ; `weeklyWageEur` là tổng lương tuần trong playerIds. '
        '`worthEur` giữ Worth của nguồn. `formation` là sơ đồ cơ bản suy ra từ 11 vị trí; '
        'chỉ để null nếu thiếu người hoặc không khớp quy tắc. '
        '`clubs[].formation` tham chiếu `formations[].id`. '
        '`startingXI` giữ vị trí gốc nếu đã tải hồ sơ đội. Chưa thu thập HLV hoặc tên sân.\n\n'
        'Tải lại: `python3 -B scripts/crawl_fifacm_clubs.py --page-id <orca-page-id>`.\n'
    )
    if marker:
        readme += marker + league_notes
    readme_path.write_text(readme)
    assert hashlib.sha256(player_path.read_bytes()).hexdigest() == digest
    print(json.dumps({
        'catalogueTeams': len(all_clubs), 'clubs': len(clubs), 'linkedPlayers': len(linked),
        'freeAgents': sum(player_club_id(player) is None for player in players),
        'sourceZeroBudgets': sum(club['budgetEur'] == 0 for club in clubs),
        'playersUnchanged': True, 'allLinksValid': True,
        'arsenal': next((club for club in clubs if club['id'] == 1), None),
    }, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--page-id', required=True)
    run(parser.parse_args().page_id)
