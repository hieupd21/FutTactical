#!/usr/bin/env python3
"""Verify club rosters/totals and remove the former builder-derived club schema."""

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import shutil
import tempfile

from crawl_fifacm_clubs import ROOT, club_financial_totals, write_json
from fifacm_formations import infer_formation, load_formation_catalogue, validate_club_formation_references


def run(cache):
    directory = ROOT/'data/fifacm'
    formations = load_formation_catalogue(directory/'formations.json')
    preserved_names = ['players.json', 'leagues.json', 'national-teams.json', 'nations.json', 'formations.json']
    preserved = {name: hashlib.sha256((directory/name).read_bytes()).hexdigest() for name in preserved_names}
    clubs = json.loads((directory/'clubs.json').read_text())
    original = json.loads((directory/'clubs.json').read_text())
    manifest = json.loads((directory/'manifest.json').read_text())
    assert all(manifest['sha256'][n] == digest for n, digest in preserved.items())
    assert manifest['sha256']['clubs.json'] == hashlib.sha256((directory/'clubs.json').read_bytes()).hexdigest()
    players = {p['id']: p for p in json.loads((directory/'players.json').read_text())}
    assert len(players) == manifest['downloadedPlayerCount']
    linked = set()
    differences = []
    for club in clubs:
        profile = json.loads((cache/f'team-{club["id"]}.json').read_text())
        assert profile['id'] == club['id']
        assert profile['sourceUrl'] == club['sourceUrl']
        assert profile['snapshotLabel'] == manifest['snapshotLabel']
        assert profile['overallRating'] == club['overallRating']
        assert set(profile['playerIds']) == set(club['playerIds'])
        assert len(profile['startingXI']) == len({p['playerId'] for p in profile['startingXI']}) == 11
        assert {p['playerId'] for p in profile['startingXI']} <= set(club['playerIds'])
        assert not linked.intersection(club['playerIds'])
        linked.update(club['playerIds'])
        assert club['worthEur'] == int(club['sourceAttributes']['worth'])
        totals = club_financial_totals(club, players)
        old = club.pop('squadBuilder', None)
        if old and (old['valueEur'] != totals['squadValueEur'] or old['wageEur'] != totals['weeklyWageEur']):
            differences.append(club['id'])
        club.update(totals)
        club['startingXI'] = profile['startingXI']
        club['formation'] = infer_formation(club['startingXI'])
    assert linked == {p['id'] for p in players.values() if p['clubId'] is not None}
    validate_club_formation_references(clubs, formations)
    added = {'squadValueEur', 'weeklyWageEur', 'formation', 'startingXI'}
    assert [{k:v for k,v in c.items() if k not in added} for c in clubs] == [
        {k:v for k,v in c.items() if k not in added | {'squadBuilder'}} for c in original]
    backup = Path(tempfile.mkdtemp(prefix='fifacm-before-club-metrics-'))
    for name in ['clubs.json', 'manifest.json', 'README.md']:
        shutil.copy2(directory/name, backup/name)
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    club_ids = {c['id'] for c in clubs}
    manifest['datasets']['clubs']['limitations'] = [
        s.replace('default lineups are stored in squadBuilder', 'default club lineups are stored in startingXI')
        for s in manifest['datasets']['clubs']['limitations']]
    manifest['datasets']['clubMetrics'] = {
        'verifiedAt': now, 'snapshotDate': manifest['snapshotDate'],
        'clubCount': len(clubs), 'linkedPlayerCount': len(linked),
        'rostersMatchCachedSourceProfiles': True,
        'squadValueEur': 'Sum players[].valueEur for the current club.playerIds.',
        'weeklyWageEur': 'Sum players[].wageEur for the current club.playerIds; EUR per week.',
        'worthEur': 'Preserved source HTML data-worth value; distinct from total player value.',
        'financialScope': 'Current playing roster, including substitutes and reserves. Loaned-in players count at the playing club; salary sharing, loan fees, bonuses, staff wages and loaned-out wages are not known.',
        'limitations': ['Player financial amounts may already be rounded by FIFACM.',
                       'weeklyWageEur is the listed player wage total, not a verified club accounting payroll or spending limit.',
                       'Formation is an inferred basic shape, not a source-confirmed tactical variant. startingXI preserves original positions. Unknown or incomplete patterns remain null.'],
        'formationMethod': 'inferred_from_starting_xi',
        'financialTotalsChangedFromPreviousGroup': differences,
        'clubsWithoutSourceConfirmedFormation': len(clubs),
        'inferredFormationCount': sum(c['formation'] is not None for c in clubs),
        'unresolvedFormationClubIds': [c['id'] for c in clubs if c['formation'] is None],
    }
    profile_metadata = manifest['datasets'].get('teamProfiles', {})
    profile_metadata['unresolvedFormations'] = [
        item for item in profile_metadata.get('unresolvedFormations', []) if item['id'] not in club_ids]
    profile_metadata['formationMethod'] = 'National-team definitions only: exact starting-position multiset match. Clubs do not use builder definitions.'
    profile_metadata['clubFormationStatus'] = 'Inferred basic shape from startingXI positions; null for incomplete or unrecognized lineups.'
    manifest['validation'].update({'clubFinancialTotalsVerified': True, 'clubsHaveNoSquadBuilderGroup': True,
        'allClubFormationsInferred': all(c['formation'] is not None for c in clubs),
        'clubFormationReferencesValid': True})
    manifest['clubFormationReference'] = {'field': 'formation', 'target': 'formations.json:id', 'nullable': True}
    readme_path = directory/'README.md'
    readme = readme_path.read_text().replace(
        'đội hình mặc định nằm trong squadBuilder', 'đội hình CLB nằm trong startingXI')
    readme = readme.replace('`clubs[].squadBuilder` và `national-teams[].squadBuilder` chứa:',
        'Phần dưới chỉ mô tả `national-teams[].squadBuilder`; CLB dùng các trường trực tiếp được mô tả ở phần sau:')
    readme = readme.split('\n## Giá trị, lương và sơ đồ CLB\n')[0]
    readme += (
        '\n## Giá trị, lương và sơ đồ CLB\n\n'
        '`clubs.json` bỏ nhóm `squadBuilder`. Các trường trực tiếp:\n\n'
        '- `squadValueEur`: tổng giá trị cầu thủ trong `playerIds`, gồm đá chính, dự bị và dự trữ.\n'
        '- `weeklyWageEur`: tổng lương tuần của cùng danh sách. Đây là lương cầu thủ được niêm yết, '
        'chưa phải toàn bộ quỹ lương kế toán hoặc hạn mức chi lương của CLB. '
        'Chưa có dữ liệu chia sẻ lương cho mượn, thưởng, phí mượn hoặc lương nhân viên.\n'
        '- `worthEur`: giữ nguyên Worth từ data-worth của nguồn, tách biệt với tổng giá trị cầu thủ.\n'
        '- `formation`: sơ đồ cơ bản suy ra từ 11 vị trí trong startingXI, ví dụ 4-2-3-1, 4-3-3, 3-4-2-1. '
        'Các vị trí trái/phải được nhóm thành vai trò; hậu vệ biên/wing-back tính trong hàng thủ, '
        'LW/RW trong hàng công, LM/RM trong hàng tiền vệ. Chỉ dùng các mẫu vai trò được nhận diện; '
        'thiếu người, trùng cầu thủ, thiếu thủ môn hoặc vị trí/mẫu chưa nhận diện thì null. '
        'Không gán mã biến thể Squad Builder; đây là sơ đồ suy luận, không phải sơ đồ chiến thuật được nguồn xác nhận.\n'
        '  `clubs[].formation` tham chiếu `formations[].id` trong danh mục sơ đồ dùng chung.\n'
        '- `startingXI`: giữ nguyên 11 cầu thủ và vị trí gốc trên hồ sơ CLB.\n\n'
        'Đã đối chiếu toàn bộ 663 danh sách CLB với hồ sơ cùng snapshot 6/10/2026 và tính lại '
        'các tổng từ players.json. Cầu thủ cho mượn đến được tính ở CLB đang thi đấu; '
        'cầu thủ cho mượn đi không thuộc playerIds hiện tại. Các số nguồn K/M có thể đã được làm tròn. '
        'Các file đội tuyển/quốc tịch, cầu thủ và giải đấu được giữ nguyên. '
        'Chi tiết xác minh: `manifest.datasets.clubMetrics`.\n\n'
        'Kiểm tra lại bằng `python3 -B scripts/verify_fifacm_clubs.py --cache <thư-mục-cache-hồ-sơ>`.\n'
    )
    assert all(hashlib.sha256((directory/n).read_bytes()).hexdigest() == h for n,h in preserved.items())
    write_json(directory/'clubs.json', clubs)
    manifest['sha256']['clubs.json'] = hashlib.sha256((directory/'clubs.json').read_bytes()).hexdigest()
    write_json(directory/'manifest.json', manifest)
    readme_path.write_text(readme)
    assert all(hashlib.sha256((directory/n).read_bytes()).hexdigest() == h for n,h in preserved.items())
    print(json.dumps({'clubs': len(clubs), 'linkedPlayers': len(linked), 'financialDifferences': differences,
                      'inferredFormations': sum(c['formation'] is not None for c in clubs),
                      'preservedFiles': preserved_names, 'backup': str(backup)}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, required=True)
    run(parser.parse_args().cache)
