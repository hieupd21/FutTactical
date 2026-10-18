# Ghép FC 27 (CLB + chỉ số, 11/10/2026) với FC 26 (tuổi, tiềm năng, lương, hợp đồng, giá trị)
import csv, collections, unicodedata, json, math, random
random.seed(27)
def norm(s): return ''.join(c for c in unicodedata.normalize('NFKD', s or '') if not unicodedata.combining(c)).lower().strip()
a = list(csv.DictReader(open('fc26.csv', encoding='utf-8')))
b = list(csv.DictReader(open('fc27.csv', encoding='utf-8-sig')))

LEAGUES = {
 13: {"Arsenal":"Arsenal","Aston Villa":"Aston Villa","AFC Bournemouth":"AFC Bournemouth","Brentford":"Brentford","Brighton":"Brighton & Hove Albion","Chelsea":"Chelsea",
      "Coventry City":"Coventry City","Crystal Palace":"Crystal Palace","Everton":"Everton","Fulham":"Fulham FC","Hull City":"Hull City","Ipswich":"Ipswich Town",
      "Leeds United":"Leeds United","Liverpool":"Liverpool","Manchester City":"Manchester City","Man Utd":"Manchester United","Newcastle Utd":"Newcastle United",
      "Nott'm Forest":"Nottingham Forest","Sunderland":"Sunderland","Spurs":"Tottenham Hotspur"},
 53: {"D. Alavés":"Deportivo Alavés","Athletic Club":"Athletic Club","Atlético de Madrid":"Atlético Madrid","FC Barcelona":"FC Barcelona","RC Celta":"RC Celta",
      "RC Deportivo":"RC Deportivo","Elche CF":"Elche CF","RCD Espanyol":"RCD Espanyol","Getafe CF":"Getafe CF","Levante UD":"Levante UD","Málaga CF":"Málaga CF",
      "CA Osasuna":"CA Osasuna","R. Racing Club":"Racing Santander","Rayo Vallecano":"Rayo Vallecano","Real Betis":"Real Betis Balompié","Real Madrid":"Real Madrid",
      "Real Sociedad":"Real Sociedad","Sevilla FC":"Sevilla FC","Valencia CF":"Valencia CF","Villarreal CF":"Villarreal CF"},
 19: {"FC Augsburg":"FC Augsburg","Union Berlin":"1. FC Union Berlin","SV Werder Bremen":"SV Werder Bremen","Borussia Dortmund":"Borussia Dortmund","SV Elversberg":"SV Elversberg",
      "Frankfurt":"Eintracht Frankfurt","SC Freiburg":"SC Freiburg","Hamburger SV":"Hamburger SV","TSG Hoffenheim":"TSG 1899 Hoffenheim","1. FC Köln":"1. FC Köln","RB Leipzig":"RB Leipzig",
      "Leverkusen":"Bayer 04 Leverkusen","1. FSV Mainz 05":"1. FSV Mainz 05","M'gladbach":"Borussia Mönchengladbach","FC Bayern München":"FC Bayern München",
      "SC Paderborn 07":"SC Paderborn 07","FC Schalke 04":"FC Schalke 04","VfB Stuttgart":"VfB Stuttgart"},
 31: {"Bergamo Calcio":"Atalanta","Bologna":"Bologna","Cagliari":"Cagliari","Como":"Como","Fiorentina":"Fiorentina","Frosinone":"Frosinone","Genoa":"Genoa",
      "Lombardia FC":"Inter","Juventus":"Juventus","Latium":"Lazio","Lecce":"Lecce","Milano FC":"AC Milan","Monza":"Monza","SSC Napoli":"Napoli","Parma":"Parma",
      "AS Roma":"Roma","Sassuolo":"Sassuolo","Torino":"Torino","Udinese":"Udinese","Venezia":"Venezia"},
 16: {"Angers SCO":"Angers SCO","AJ Auxerre":"AJ Auxerre","Stade Brestois 29":"Stade Brestois 29","Havre AC":"Le Havre AC","Le Mans FC":"Le Mans FC","RC Lens":"RC Lens",
      "LOSC Lille":"Lille OSC","FC Lorient":"FC Lorient","OL":"Olympique Lyonnais","OM":"Olympique de Marseille","AS Monaco":"AS Monaco","OGC Nice":"OGC Nice",
      "Paris FC":"Paris FC","Paris SG":"Paris Saint-Germain","Stade Rennais FC":"Stade Rennais FC","Strasbourg":"RC Strasbourg Alsace","Toulouse FC":"Toulouse FC","ESTAC Troyes":"ESTAC Troyes"},
}
RELEGATED = {"West Ham":"West Ham United","Burnley":"Burnley","Wolves":"Wolverhampton Wanderers","RCD Mallorca":"RCD Mallorca","Girona FC":"Girona FC","R. Oviedo":"Real Oviedo",
  "VfL Wolfsburg":"VfL Wolfsburg","Heidenheim":"1. FC Heidenheim 1846","FC St. Pauli":"FC St. Pauli","Cremonese":"Cremonese","Hellas Verona":"Hellas Verona FC","Pisa":"Pisa",
  "FC Metz":"FC Metz","FC Nantes":"FC Nantes"}
fc27_names = set(x['club_name'] for x in b)
for lid, m in LEAGUES.items():
    miss = [k for k in m if k not in fc27_names]; assert not miss, (lid, miss)
    assert len(m) in (18, 20), (lid, len(m))

idx = collections.defaultdict(list)
for x in a:
    nat = norm(x['nationality_name'])
    for k in {norm(x['long_name']), norm(x['short_name'])}: idx[(k, nat)].append(x)
NATFIX={"Bosnia Herzegovina":"Bosnia and Herzegovina","CAR":"Central African Republic","Cape Verde Islands":"Cabo Verde","Czech Republic":"Czechia","DR Congo":"Congo DR",
  "FYR Macedonia":"North Macedonia","Guinea Bissau":"Guinea-Bissau","Ivory Coast":"Côte d'Ivoire","Luxemburg":"Luxembourg","Netherlands Antilles":"Curacao",
  "Palestinian Authority":"Palestine","St Kitts Nevis":"Saint Kitts and Nevis","St Lucia":"Saint Lucia","Trinidad & Tobago":"Trinidad and Tobago"}
LINE={"GK":"GK","CB":"DF","LB":"DF","RB":"DF","LWB":"DF","RWB":"DF","CDM":"MF","CM":"MF","CAM":"MF","LM":"MF","RM":"MF","ST":"FW","CF":"FW","LW":"FW","RW":"FW"}
def match(y):
    natr = NATFIX.get(y['nation_name'], y['nation_name']); nat = norm(natr); fn, ln = norm(y['first_name']), norm(y['last_name'])
    cands = []
    for k in [norm(f"{y['first_name']} {y['last_name']}"), norm(y['common_name']), (fn[:1]+'. '+ln) if fn and ln else '', ln if not fn else '']:
        if k and (k, nat) in idx: cands += idx[(k, nat)]
    if not cands: return None
    r = int(y['rating']); line = LINE.get(y['position'], 'MF')
    def score(x):
        o = int(float(x['overall'] or 0)); xl = LINE.get((x['player_positions'] or 'CM').split(',')[0].strip(), 'MF')
        return abs(o - r) + (0 if xl == line else 6)
    best = min(cands, key=score)
    return best if score(best) <= 12 else None

POSLINE = {"GK":"GK","CB":"DF","LB":"DF","RB":"DF","LWB":"DF","RWB":"DF","CDM":"MF","CM":"MF","CAM":"MF","LM":"MF","RM":"MF","ST":"FW","CF":"FW","LW":"FW","RW":"FW"}
lid_of = {}; name_of = {}
for lid, m in LEAGUES.items():
    for k, v in m.items(): lid_of[k] = lid; name_of[k] = v
for k, v in RELEGATED.items(): lid_of[k] = 999; name_of[k] = v
# giải nguồn cầu thủ: Championship, Bồ Đào Nha, Hà Lan theo đa số cầu thủ (đã ghép) của CLB ở FC 26
maj = collections.defaultdict(collections.Counter); matched = {}
for i, y in enumerate(b):
    x = match(y)
    if x: matched[i] = x; maj[y['club_name']][x['league_id'].split('.')[0]] += 1
for c, cnt in maj.items():
    if c in lid_of: continue
    l, n = cnt.most_common(1)[0]
    if n >= 8 and l in ('13', '14'): lid_of[c] = 14; name_of[c] = c
    elif n >= 8 and l == '308': lid_of[c] = 308; name_of[c] = c
    elif n >= 8 and l == '10': lid_of[c] = 10; name_of[c] = c

unm_count = collections.Counter(y['club_name'] for i, y in enumerate(b) if i not in matched)
out = []; moved = []; seen = set(); drop_unmatched = collections.Counter()
for i, y in enumerate(b):
    c = y['club_name']
    if c not in lid_of: continue
    x = matched.get(i)
    if not x:
        drop_unmatched[c] += 1
        if unm_count[c] <= 10:   # CLB không có đội nữ trong file: đây là tân binh nam chưa có ở FC 26
            nm=(y['common_name'] or '').strip() or f"{y['first_name'][:1]}. {y['last_name']}".strip('. ')
            out.append([lid_of[c], name_of[c], nm, f"{y['first_name']} {y['last_name']}".strip(), y['position'], int(y['rating']), int(y['rating']), 0, 0, 0, 2026+random.randint(2,4), 0, NATFIX.get(y['nation_name'], y['nation_name']), 27, ''])
        continue   # còn lại chủ yếu là cầu thủ nữ (không có trong dữ liệu nam FC 26)
    if x['player_id'] in seen: continue
    seen.add(x['player_id'])
    ovr = int(y['rating']); o26 = int(float(x['overall'] or ovr)); pot = max(ovr, int(float(x['potential'] or ovr)))
    age = int(float(x['age'] or 25)) + 1
    prev = x['club_name'] or ''
    club = name_of[c]
    same = norm(prev) == norm(club)
    v26 = float(x['value_eur'] or 0); val = v26 * math.exp((ovr - o26) / 6) * (0.85 if age >= 31 else 1)
    wage = float(x['wage_eur'] or 0) * (1 if same else 1.15)
    cy = int(float(x['club_contract_valid_until_year'] or 0))
    contract = cy if (same and cy >= 2027) else 2026 + random.randint(1, 2) if same else 2026 + random.randint(3, 5)
    rc = 0
    if lid_of[c] == 53:
        rc26 = float(x['release_clause_eur'] or 0)
        rc = rc26 * math.exp((ovr - o26) / 6) if (same and rc26) else val * 2.2
    p27 = POSLINE.get(y['position'], None)
    pos26 = [p.strip() for p in (x['player_positions'] or '').split(',') if p.strip()]
    positions = ([y['position']] if y['position'] else []) + [p for p in pos26 if p != y['position']]
    short = (y['common_name'] or '').strip() or x['short_name']
    out.append([lid_of[c], club, short, x['long_name'], ", ".join(positions), ovr, pot, int(val), int(wage), age, contract, int(rc), x['nationality_name'], 27, '' if same else prev])
    if not same and lid_of[c] in (13, 53, 19, 31, 16) and prev: moved.append((ovr, short, prev, club))

cnt = collections.Counter(o[0] for o in out); print('by league', dict(cnt))
per = collections.Counter(o[1] for o in out if o[0] in (13, 53, 19, 31, 16)); print('smallest squads', sorted(per.items(), key=lambda a: a[1])[:8])
print('moved into top5:', len(moved)); print(sorted(moved, reverse=True)[:25])
print('dropped unmatched (mostly women) top clubs:', [(k, drop_unmatched[k]) for k in ['Arsenal', 'OL', 'Real Madrid', 'Man Utd', 'Juventus']])
json.dump(out, open('pack_fc27.json', 'w'), ensure_ascii=False, separators=(',', ':'))
import os; print(os.path.getsize('pack_fc27.json') // 1024, 'KB', len(out), 'players')
