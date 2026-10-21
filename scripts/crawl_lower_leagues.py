#!/usr/bin/env python3
"""Tải cầu thủ các giải hạng dưới từ API công khai của trang ratings EA FC rồi gộp vào public/data/fc27.json.

Dùng: python3 scripts/crawl_lower_leagues.py [thư mục cache, mặc định /tmp/ea]
EA không công bố tiềm năng, giá, lương, hợp đồng nên các cột đó được ước lượng
(giá và lương = 0 để engine tự tính từ chỉ số; hợp đồng 2027-2029 theo id cầu thủ).
"""
import glob, json, os, subprocess, sys, time

CACHE = sys.argv[1] if len(sys.argv) > 1 else "/tmp/ea"
DATA = os.path.join(os.path.dirname(__file__), "..", "public", "data", "fc27.json")
API = "https://drop-api.ea.com/rating/ea-sports-fc?locale=en&limit=100&offset="
PAGE_COUNT = 180
SEASON_YEAR = 2026
FIFA_VERSION = 27
# tên giải của EA -> league_id trong gói dữ liệu
LEAGUES = {
    "EFL League One": 60,
    "EFL League Two": 61,
    "Bundesliga 2": 20,
    "LALIGA HYPERMOTION": 54,
    "Ligue 2 BKT": 17,
    "Serie BKT": 32,
}


def fetch_pages() -> None:
    os.makedirs(CACHE, exist_ok=True)
    for page in range(PAGE_COUNT):
        path = os.path.join(CACHE, f"p_{page * 100}.json")
        if os.path.exists(path) and os.path.getsize(path) > 1000:
            continue
        subprocess.run(["curl", "-s", "-A", "Mozilla/5.0", "--retry", "3", "-o", path, API + str(page * 100)], check=True)
        time.sleep(0.2)


def potential(ovr: int, age: int) -> int:
    room = 8 if age <= 21 else 5 if age <= 24 else 2 if age <= 27 else 0
    return min(92, ovr + room)


def to_row(item: dict) -> list:
    first, last = item["firstName"].strip(), item["lastName"].strip()
    common = (item.get("commonName") or "").strip()
    short = common or f"{first[:1]}. {last}"
    long_name = f"{first} {last}".strip()
    birth_year = int(item["birthdate"].split("/")[2].split(" ")[0])
    age = SEASON_YEAR - birth_year
    positions = [item["position"]["shortLabel"]] + [alt["shortLabel"] for alt in item.get("alternatePositions") or []]
    ovr = item["overallRating"]
    return [
        LEAGUES[item["leagueName"]],
        item["team"]["label"],
        short,
        long_name,
        ", ".join(positions),
        ovr,
        potential(ovr, age),
        0,
        0,
        age,
        2027 + item["id"] % 3,
        0,
        item["nationality"]["label"],
        FIFA_VERSION,
    ]


def main() -> None:
    fetch_pages()
    items = []
    for path in glob.glob(os.path.join(CACHE, "p_*.json")):
        items += [entry for entry in json.load(open(path))["items"] if entry]
    rows = [to_row(item) for item in items if item["leagueName"] in LEAGUES and item.get("team") and item["gender"]["id"] == 0]
    kept = [row for row in json.load(open(DATA)) if row[0] not in LEAGUES.values()]
    json.dump(kept + rows, open(DATA, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"Thêm {len(rows)} cầu thủ, tổng {len(kept) + len(rows)} dòng")


main()
