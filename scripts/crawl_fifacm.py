#!/usr/bin/env python3
"""Download the male FIFACM listing through an existing Orca browser tab.

The browser must already show FIFACM /players with its male database selected.
Only displayed listing values are collected; hidden attributes are not guessed.
"""

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
PAGE_PARSER = r"""
function parseListing(doc, page, sourceUrl) {
  const text = node => node?.textContent.replace(/\s+/g, ' ').trim() || '';
  const imageUrl = img => {
    const path = img?.getAttribute('data-lazy-src') || img?.getAttribute('src');
    return path ? new URL(path, sourceUrl).href : null;
  };
  const integer = value => {
    if (!/^-?[\d,]+$/.test(value)) throw new Error('Invalid integer: ' + value);
    return Number(value.replaceAll(',', ''));
  };
  const money = value => {
    if (!value || /^[-–—]$/.test(value)) return null;
    const match = value.match(/^€\s*([\d.,]+)\s*([KMB])?$/i);
    if (!match) throw new Error('Unsupported money: ' + value);
    return Math.round(Number(match[1].replaceAll(',', '')) *
      ({K: 1e3, M: 1e6, B: 1e9}[match[2]?.toUpperCase()] || 1));
  };
  if (!/EA FC 27/.test(doc.title)) throw new Error('Unexpected title: ' + doc.title);
  const snapshot = [...doc.querySelectorAll('.menu-dd .dropdown-toggle')]
    .map(text).find(value => /\d+(st|nd|rd|th) of \w+ 2026/.test(value));
  if (!snapshot) throw new Error('Missing squad update date');
  const pageNumbers = [...doc.querySelectorAll('.pagination a')]
    .map(a => Number(new URL(a.getAttribute('href'), sourceUrl).searchParams.get('page')))
    .filter(n => Number.isInteger(n) && n > 0);
  const players = [...doc.querySelectorAll('tr.player-row')].map(row => {
    const cells = [...row.cells];
    if (cells.length !== 15) throw new Error('Unexpected player column count: ' + cells.length);
    const link = row.querySelector('.player-name a');
    const href = link?.getAttribute('href');
    const id = href?.match(/^\/player\/(\d+)\//)?.[1];
    if (!id) throw new Error('Missing player ID');
    const entity = parameter => {
      const a = [...row.querySelectorAll('a[href]')].find(a =>
        new URL(a.getAttribute('href'), sourceUrl).searchParams.has(parameter));
      if (!a) return null;
      const img = a.querySelector('img');
      const label = img?.getAttribute('data-original-title') || img?.getAttribute('title') || img?.alt;
      if (!label) throw new Error('Missing ' + parameter + ' name for ' + id);
      return {id: integer(new URL(a.getAttribute('href'), sourceUrl).searchParams.get(parameter)),
        label, imageUrl: imageUrl(img)};
    };
    const positions = text(row.querySelector('.player-position-cln')).split('|')[0]
      .split(',').map(p => p.trim()).filter(Boolean);
    const contractText = text(row.querySelector('.player-cln'));
    const years = contractText.match(/(\d{4})\s*-\s*(\d{4})/);
    const amounts = [...row.querySelectorAll('.player-value-wage > div')].map(text);
    if (amounts.length !== 2) throw new Error('Missing value/wage for ' + id);
    const release = text(cells[7]);
    const bodyType = text(row.querySelector('.player-weight strong')) || null;
    const height = text(row.querySelector('.player-height')).match(/(\d+)cm/);
    const weight = text(row.querySelector('.player-weight')).match(/(\d+)kg/);
    const team = entity('teams');
    // FIFACM's dedicated free-agents listing uses club 111592, labelled "NG - FA".
    const freeAgent = !team || team.id === 111592 || /^(free agents?|free)$/i.test(team.label);
    const foot = text(cells[11]);
    if (!['L', 'R'].includes(foot)) throw new Error('Unexpected foot for ' + id);
    return {
      id: Number(id), name: text(link), gender: {id: 0, label: 'Male'}, fifaVersion: 27,
      overallRating: integer(text(cells[2])), potential: integer(text(cells[3])),
      growth: integer(text(cells[4])), age: integer(text(cells[5])), positions,
      team: freeAgent ? null : team, sourceTeam: team, nationality: entity('nations'),
      isFreeAgent: freeAgent, contractStartYear: years ? Number(years[1]) : null,
      contractYear: years ? Number(years[2]) : null, contractText,
      isOnLoan: /loan/i.test(contractText) ? true : null,
      valueEur: money(amounts[0]), wageEur: money(amounts[1]), releaseClauseEur: money(release),
      skillMoves: integer(text(cells[8])), weakFootAbility: integer(text(cells[9])),
      workRates: text(cells[10]), preferredFoot: foot === 'L' ? 'Left' : 'Right',
      heightCm: height ? Number(height[1]) : null, weightKg: weight ? Number(weight[1]) : null,
      bodyType, realFace: /R\.Face/.test(contractText), totalStats: integer(text(cells[14])),
      avatarUrl: imageUrl(row.querySelector('.player-img-info')),
      sourceUrl: new URL(href, sourceUrl).href, sourcePage: page,
    };
  });
  return {page, sourceUrl, snapshot, pageCount: Math.max(0, ...pageNumbers),
    count: players.length, players};
}
"""


def browser_eval(cli, page_id, expression):
    process = subprocess.run(
        [cli, 'eval', '--page', page_id, '--expression', expression, '--json'],
        capture_output=True, text=True, timeout=55,
    )
    if process.returncode:
        raise RuntimeError(process.stderr[:500] or process.stdout[:500])
    response = json.loads(process.stdout)
    if not response.get('ok'):
        raise RuntimeError(str(response)[:1000])
    return json.loads(response['result']['result'])


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def player_club_id(player):
    """Read a club reference from either the published schema or a raw cache row."""
    if 'clubId' in player:
        club_id = player['clubId']
        if 'team' in player:
            legacy_id = player['team']['id'] if player['team'] else None
            if club_id != legacy_id:
                raise ValueError(f'Conflicting club references for player {player["id"]}')
    elif 'team' in player:
        club_id = player['team']['id'] if player['team'] else None
    else:
        raise ValueError(f'Missing club reference for player {player["id"]}')
    if club_id is not None and (type(club_id) is not int or club_id <= 0):
        raise ValueError(f'Invalid club ID for player {player["id"]}')
    return club_id


def normalize_player(player):
    club_id = player_club_id(player)
    source_team = player.get('sourceTeam')
    if club_id is not None and source_team is not None and source_team['id'] != club_id:
        raise ValueError(f'Source team differs from current club for player {player["id"]}')
    normalized = {}
    for key, value in player.items():
        if key == 'sourceTeam':
            continue
        if key == 'team':
            normalized['clubId'] = club_id
        else:
            normalized[key] = value
    normalized.setdefault('clubId', club_id)
    return normalized


def write_players(path, players):
    """Write a JSON array with one compact player object per line."""
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, prefix='.'+path.name+'-', delete=False) as file:
        file.write('[\n')
        for index, player in enumerate(players):
            file.write('  ' + json.dumps(player, ensure_ascii=False, separators=(',', ':')))
            file.write(',\n' if index + 1 < len(players) else '\n')
        file.write(']\n')
        pending = file.name
    os.replace(pending, path)


def run(args):
    cli = os.environ.get('ORCA_CLI_COMMAND') or ('orca-dev' if os.environ.get('ORCA_DEV_REPO_ROOT') else 'orca')
    output = args.output.resolve()
    if output.exists() and any(output.iterdir()):
        raise RuntimeError('Output directory must be empty; existing data is never overwritten.')
    cache = args.cache.resolve() if args.cache else Path(tempfile.mkdtemp(prefix='fifacm-pages-'))
    cache.mkdir(parents=True, exist_ok=True)
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    first = browser_eval(cli, args.page_id, PAGE_PARSER + r"""
      (() => {
        if (!/(?:^|; )gender=0(?:;|$)/.test(document.cookie)) throw new Error('Select male database first');
        if (location.pathname !== '/players' || location.search) throw new Error('Open unfiltered /players first');
        return JSON.stringify(parseListing(document, 1, location.href));
      })()
    """)
    assert first['count'] == 30 and first['pageCount'] > 1
    snapshot = first['snapshot']
    page_count = first['pageCount']
    write_json(cache/'page-1.json', first)
    target = min(args.max_pages, page_count) if args.max_pages else page_count
    print(f'Snapshot {snapshot}; pages {page_count}; cache {cache}', flush=True)
    pages = {1: first}
    error = None
    try:
        for start in range(2, target+1):
            requested = [start]
            remaining = []
            for number in requested:
                path = cache/f'page-{number}.json'
                if path.exists():
                    cached = json.loads(path.read_text())
                    assert cached['page'] == number and cached['snapshot'] == snapshot
                    pages[number] = cached
                else:
                    remaining.append(number)
            if remaining:
                expression = PAGE_PARSER + r"""
                (async () => {
                  if (!/(?:^|; )gender=0(?:;|$)/.test(document.cookie)) throw new Error('Male selection lost');
                  const results = [], pending = PAGES;
                  const workers = Array.from({length: 1}, async () => {
                    while (pending.length) {
                      const page = pending.shift();
                      const url = new URL('/players?page=' + page, location.origin).href;
                      let response, html;
                      for (let attempt = 0; attempt < 2; attempt++) {
                        try {
                          response = await fetch(url, {signal: AbortSignal.timeout(8000)});
                          if (!response.ok) throw new Error('HTTP ' + response.status + ' on page ' + page);
                          html = await response.text();
                          break;
                        } catch (error) {
                          if (attempt === 1) throw error;
                          if (response && response.status < 500 && !response.ok) throw error;
                          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                        }
                      }
                      const doc = new DOMParser().parseFromString(html, 'text/html');
                      results.push(parseListing(doc, page, url));
                      await new Promise(resolve => setTimeout(resolve, 400));
                    }
                  });
                  await Promise.all(workers);
                  return JSON.stringify(results);
                })()
                """
                fetched = browser_eval(cli, args.page_id, expression.replace('PAGES', json.dumps(remaining)))
                for page in fetched:
                    assert page['snapshot'] == snapshot, 'Snapshot changed during crawl'
                    assert page['page'] in remaining and page['count'] > 0
                    assert page['count'] == 30 or page['page'] == page_count
                    pages[page['page']] = page
                    write_json(cache/f'page-{page["page"]}.json', page)
            if (len(pages)-1) % 30 == 0 or len(pages) == target:
                print(f'Pages {len(pages)}/{target}; players {sum(p["count"] for p in pages.values())}', flush=True)
    except Exception as exc:
        error = str(exc)
        print('Stopped: ' + error, flush=True)

    players = [p for number in sorted(pages) for p in pages[number]['players']]
    assert len(players) == len({p['id'] for p in players}), 'Duplicate player IDs: pagination cannot be trusted'
    for player in players:
        assert player['gender']['id'] == 0
        assert player['potential'] - player['overallRating'] == player['growth']
        assert 0 < player['overallRating'] <= 99 and 0 < player['potential'] <= 99
        assert player['nationality'] is not None
    complete = len(pages) == page_count and error is None
    output.mkdir(parents=True, exist_ok=True)
    write_players(output/'players.json', [normalize_player(player) for player in players])
    manifest = {
        'schemaVersion': 2,
        'playerClubReference': {'field': 'clubId', 'target': 'clubs.json:id', 'freeAgentValue': None},
        'sourceConventions': {'freeAgentTeam': {'id': 111592, 'label': 'NG - FA'}},
        'provider': 'FIFACM', 'baseUrl': 'https://www.fifacm.com', 'sourceUrl': 'https://www.fifacm.com/players',
        'sport': 'football', 'gender': {'id': 0, 'label': 'Male'}, 'fifaVersion': 27,
        'snapshotLabel': snapshot, 'retrievalMethod': 'Orca browser / male cookie / HTML listing',
        'downloadStartedAt': started, 'downloadCompletedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'complete': complete, 'reportedPageCount': page_count, 'downloadedPageCount': len(pages),
        'downloadedPlayerCount': len(players), 'uniquePlayerIds': len({p['id'] for p in players}),
        'missingPages': sorted(set(range(1, page_count+1))-set(pages)), 'error': error,
        'financialUnit': {'currency': 'EUR', 'wagePeriod': 'week'},
        'limitations': [
            'Source is the FC27 Career Mode HTML listing, not a raw EA game database export.',
            'Financial values are converted from displayed K/M figures and may be rounded by the website; original strings are retained.',
            'Individual profile attributes, birthdates, and league IDs are not collected by this listing crawl.',
            'The ordinary listing does not identify every loan. isOnLoan is null unless explicitly displayed.',
            'Snapshot date is checked on every downloaded page; the website does not expose the active snapshot ID in these links.',
            'No FC26 rows, EA dataset, financial estimates, or local FC27 file are used to fill missing values.',
        ],
        'pages': [{'page': n, 'itemCount': p['count'], 'sourceUrl': p['sourceUrl']} for n,p in sorted(pages.items())],
        'sha256': {'players.json': hashlib.sha256((output/'players.json').read_bytes()).hexdigest()},
    }
    write_json(output/'manifest.json', manifest)
    (output/'README.md').write_text(
        '# Dữ liệu bóng đá nam FIFACM\n\n'
        f'- Phiên bản: FC27; snapshot hiển thị: **{snapshot}**.\n'
        f'- Đã tải: **{len(players)} cầu thủ / {len(pages)} trên {page_count} trang**.\n'
        f'- Đầy đủ danh sách: **{str(complete).lower()}**; xem `manifest.json` để biết trang thiếu/lỗi.\n\n'
        '`players.json` là mảng object lấy từ bảng HTML FIFACM. `id` giữ ID của website; '
        '`sourceUrl` và `sourcePage` truy lại từng bản ghi. `clubId` tham chiếu `clubs[].id`; '
        '`clubId: null` biểu thị cầu thủ tự do. Quy ước nguồn NG - FA (ID 111592) được lưu '
        'một lần trong `manifest.sourceConventions`. Mỗi cầu thủ được ghi trên một dòng của mảng JSON.\n\n'
        '`valueEur`, `wageEur`, `releaseClauseEur` quy đổi từ chuỗi EUR hiển thị; lương theo tuần. '
        'Các số K/M trên website có thể đã làm tròn. '
        '`contractText` giữ cách hiển thị hợp đồng gốc; website vẫn có thể hiển thị năm hợp đồng cho NG - FA. '
        '`isOnLoan: null` nghĩa bảng thường không xác nhận tình trạng cho mượn. '
        'Trường không đọc được để null, không bổ sung hoặc ước lượng từ FC26/EA.\n\n'
        'Nguồn: https://www.fifacm.com/players. Đây là dữ liệu Career Mode được website công bố, '
        'không xác minh lương/giá ngoài đời. Không tải ảnh, chỉ lưu URL. '
        'Chưa thu thập thuộc tính ẩn của hồ sơ hay mã giải đấu.\n\n'
        'Tải lại bằng `python3 -B scripts/crawl_fifacm.py --page-id <orca-page-id> '
        '--output <thư-mục-trống>`. Tab cần mở `/players`, chọn Male trước khi chạy.\n'
    )
    print(json.dumps({k: manifest[k] for k in ['complete','downloadedPageCount','reportedPageCount','downloadedPlayerCount','error']},ensure_ascii=False), flush=True)
    if error:
        raise SystemExit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--page-id', required=True)
    parser.add_argument('--output', type=Path, default=ROOT/'data/fifacm')
    parser.add_argument('--cache', type=Path)
    parser.add_argument('--max-pages', type=int, help='Download a smaller sample; manifest will mark it incomplete.')
    run(parser.parse_args())
