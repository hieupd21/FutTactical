// Màn hình bắt đầu sự nghiệp: chọn hạng đấu → đội bóng (kiểu FC26), xem huy hiệu + sức mạnh rồi xác nhận.
import { allLeagueInfos, findLeagueByPackId, mockData } from "@/engine/mockData";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ImagePlus, Lock } from "lucide-react";
import { NEWBIE_REPUTATION, strengthRequirement } from "@/engine/career";

import type { Line } from "@/engine/types";
import type { FifacmPack } from "@/engine/fifacm";
import { packClubLineStrengths, packClubs } from "@/engine/world";
import { ClubBadge } from "@/components/ClubBadge";
import { Preloader } from "@/components/Preloader";
import { Sheet } from "@/components/Sheet";
import { SegmentedControl } from "@/components/ui";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { Input } from "@/components/shadcn/input";
import { readLogoFile } from "@/lib/logoImage";
import { cn } from "@/lib/utils";
import { loadPack, PACKS } from "@/lib/data";
import { useGame } from "@/stores/gameStore";

type Mode = "rookie" | "free" | "custom";
const CUSTOM_NAME_MIN = 2;
const CUSTOM_NAME_MAX = 30;
type PickerKind = "country" | "league" | "club";

interface ClubChoice {
  name: string;
  strength: number;
  lineStrengths: Record<Line, number>;
  isLocked: boolean;
  requiredReputation: number;
  tierLabel: string;
  squadSize: number;
  topPlayers: { name: string; ovr: number; position: string }[];
}

const LINE_LABELS: [Line, string, string][] = [
  ["GK", "Thủ môn", "var(--pos-gk)"],
  ["DF", "Hậu vệ", "var(--pos-df)"],
  ["MF", "Tiền vệ", "var(--pos-mf)"],
  ["FW", "Tiền đạo", "var(--pos-fw)"],
];

function getTierLabel(rankIndex: number, clubCount: number): string {
  if (rankIndex < 3) return "Ứng viên vô địch";
  if (rankIndex < 7) return "Nhóm dự cúp châu Âu";
  if (rankIndex < clubCount - 5) return "Nhóm giữa";
  return "Đội cửa dưới";
}

/** Hàng chọn kiểu FC26: mũi tên trái/phải để lướt, bấm giữa để mở danh sách đầy đủ */
function PickerRow({
  label,
  value,
  onPrevious,
  onNext,
  onOpenList,
  isDisabled,
}: {
  label: string;
  value: string;
  onPrevious: () => void;
  onNext: () => void;
  onOpenList: () => void;
  isDisabled: boolean;
}) {
  // Hướng lướt của lần bấm gần nhất: giá trị mới trượt vào từ phía mũi tên được bấm
  const [slideDirection, setSlideDirection] = useState<"previous" | "next" | null>(null);
  const slideClass =
    slideDirection === null
      ? ""
      : cn(
          "animate-in fade-in duration-250 ease-out motion-reduce:animate-none",
          slideDirection === "next" ? "slide-in-from-right-6" : "slide-in-from-left-6",
        );
  const arrowClass =
    "grid size-12 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-(--accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        className={arrowClass}
        onClick={() => {
          setSlideDirection("previous");
          onPrevious();
        }}
        disabled={isDisabled}
        aria-label={`${label}: trước`}
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onOpenList}
        disabled={isDisabled}
        aria-haspopup="dialog"
        className="relative flex min-h-12 min-w-0 flex-1 items-center rounded-lg border border-border bg-card px-9 text-center text-foreground transition-colors hover:border-(--accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="min-w-0 flex-1 overflow-hidden">
          <span
            key={value}
            className={cn("block w-full truncate text-[15px] font-bold", slideClass)}
          >
            {value}
          </span>
        </span>
        <ChevronDown
          size={18}
          className="absolute right-3 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        className={arrowClass}
        onClick={() => {
          setSlideDirection("next");
          onNext();
        }}
        disabled={isDisabled}
        aria-label={`${label}: sau`}
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  );
}

export function StartScreen() {
  const [dataset, setDataset] = useState<FifacmPack | null>(null);
  const rows = dataset?.rows ?? null;
  const [error, setError] = useState<string | null>(null);
  const [pickedCountryCode, setPickedCountryCode] = useState("");
  const [pickedLeagueId, setPickedLeagueId] = useState("");
  const [pickedClubName, setPickedClubName] = useState("");
  const [openedPicker, setOpenedPicker] = useState<PickerKind | null>(null);
  const [mode, setMode] = useState<Mode>("rookie");
  const [customName, setCustomName] = useState("");
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const { startReal } = useGame();

  useEffect(() => {
    loadPack("fifacm")
      .then(setDataset)
      .catch((loadError: Error) => setError(loadError.message));
  }, []);

  // HLV mới chỉ nhận được các đội có yêu cầu uy tín trong tầm; chế độ tự chọn mở hết
  const isRookie = mode === "rookie";
  const isCustom = mode === "custom";
  const playableLeagues = allLeagueInfos().filter((league) => league.isSimulated !== false);
  const countryCodes = [...new Set(playableLeagues.map((league) => league.nationality))];
  const selectedCountryCode = countryCodes.includes(pickedCountryCode)
    ? pickedCountryCode
    : countryCodes[0];
  const countryName = (countryCode: string) => mockData().leagues.countries[countryCode].name;
  const leagues = playableLeagues
    .filter((league) => league.nationality === selectedCountryCode)
    .sort((leagueA, leagueB) =>
      isRookie ? leagueA.level - leagueB.level : leagueB.level - leagueA.level,
    );
  const selectedLeague = leagues.find((league) => league.id === pickedLeagueId) ?? leagues[0];

  const clubs = useMemo<ClubChoice[]>(() => {
    if (!rows) return [];
    const leagueClubs = packClubs(rows, dataset ?? undefined)
      .filter((packClub) => findLeagueByPackId(packClub.leagueId)?.id === selectedLeague.id)
      .sort((packClubA, packClubB) => packClubB.strength - packClubA.strength);
    return leagueClubs.map((packClub, rankIndex) => {
      const requiredReputation = strengthRequirement(packClub.strength);
      return {
        name: packClub.name,
        strength: packClub.strength,
        lineStrengths: packClubLineStrengths(packClub),
        isLocked: isRookie && requiredReputation > NEWBIE_REPUTATION,
        requiredReputation,
        tierLabel: getTierLabel(rankIndex, leagueClubs.length),
        squadSize: packClub.rows.length,
        topPlayers: [...packClub.rows]
          .sort((rowA, rowB) => rowB[5] - rowA[5])
          .slice(0, 3)
          .map((dataRow) => ({
            name: dataRow[2],
            ovr: dataRow[5],
            position: String(dataRow[4]).split(",")[0].trim(),
          })),
      };
    });
  }, [rows, dataset, selectedLeague.id, isRookie]);

  // Đổi hạng đấu thì tên đã chọn không còn trong danh sách: tự rơi về đội mạnh nhất chọn được
  const selectedClub =
    clubs.find((club) => club.name === pickedClubName) ??
    clubs.find((club) => !club.isLocked) ??
    clubs[0];

  const stepCountry = (direction: 1 | -1) => {
    const currentIndex = countryCodes.indexOf(selectedCountryCode);
    setPickedCountryCode(
      countryCodes[(currentIndex + direction + countryCodes.length) % countryCodes.length],
    );
  };
  const stepLeague = (direction: 1 | -1) => {
    const currentIndex = leagues.findIndex((league) => league.id === selectedLeague.id);
    setPickedLeagueId(leagues[(currentIndex + direction + leagues.length) % leagues.length].id);
  };
  const stepClub = (direction: 1 | -1) => {
    if (!selectedClub) return;
    const currentIndex = clubs.findIndex((club) => club.name === selectedClub.name);
    setPickedClubName(clubs[(currentIndex + direction + clubs.length) % clubs.length].name);
  };

  const trimmedCustomName = customName.trim();
  const customNameError = !isCustom
    ? null
    : trimmedCustomName.length < CUSTOM_NAME_MIN
      ? `Tên CLB cần ít nhất ${CUSTOM_NAME_MIN} ký tự.`
      : trimmedCustomName.length > CUSTOM_NAME_MAX
        ? `Tên CLB tối đa ${CUSTOM_NAME_MAX} ký tự.`
        : dataset?.clubByName.has(trimmedCustomName)
          ? "Tên này trùng với một CLB có sẵn."
          : null;
  const pickLogoFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setCustomLogoDataUrl(await readLogoFile(file));
      setLogoError(null);
    } catch (readError) {
      setLogoError(readError instanceof Error ? readError.message : "Không đọc được ảnh.");
    }
  };

  const canConfirm = Boolean(
    rows && selectedClub && !selectedClub.isLocked && (!isCustom || !customNameError),
  );
  const confirm = () => {
    if (!rows || !dataset || !selectedClub || !canConfirm) return;
    startReal(rows, selectedLeague.id, selectedClub.name, PACKS.fifacm.sourceNote, {
      rookie: isRookie,
      dataset,
      ...(isCustom
        ? { customClub: { name: trimmedCustomName, logoDataUrl: customLogoDataUrl } }
        : {}),
    });
  };

  const isLoading = !rows && !error;
  const closePicker = () => setOpenedPicker(null);

  return (
    <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
      <h2>Chọn đội bóng</h2>
      <div className="mt-3 flex flex-col gap-1.5">
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          items={[
            ["rookie", "HLV mới"],
            ["free", "Tự chọn CLB"],
            ["custom", "CLB của tôi"],
          ]}
        />
        <p className="hint">
          {isRookie
            ? "Bạn còn vô danh nên chỉ được các đội hạng dưới giao ghế. Đạt thành tích để tăng uy tín, CLB lớn hơn sẽ gửi lời mời cuối mùa."
            : isCustom
              ? "Tự lập CLB của riêng bạn: đặt tên, tải logo, chọn giải. CLB mới thế chỗ một đội bị loại khỏi giải và thừa hưởng toàn bộ đội hình của đội đó (OVR, cầu thủ, hợp đồng)."
              : "Chọn thẳng bất kỳ CLB nào, kể cả đội mạnh nhất. Uy tín khởi đầu tương xứng với CLB đã chọn."}
        </p>
        <p className="hint">{PACKS.fifacm.note}</p>
      </div>

      {error && <p className="err mt-3">{error}</p>}

      {isCustom && (
        <div className="mt-4 flex items-start gap-3">
          <label
            className="grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-(--accent)"
            title="Tải logo từ máy tính"
          >
            {customLogoDataUrl ? (
              <img
                src={customLogoDataUrl}
                alt="Logo CLB"
                className="size-full object-contain p-1"
              />
            ) : (
              <span className="flex flex-col items-center gap-1 text-[11px] font-semibold">
                <ImagePlus size={22} aria-hidden="true" />
                Logo
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(changeEvent) => {
                void pickLogoFile(changeEvent.target.files?.[0]);
                changeEvent.target.value = "";
              }}
            />
          </label>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Input
              value={customName}
              onChange={(changeEvent) => setCustomName(changeEvent.target.value)}
              placeholder="Tên câu lạc bộ"
              maxLength={CUSTOM_NAME_MAX + 10}
              aria-invalid={Boolean(customName) && Boolean(customNameError)}
            />
            {customName && customNameError && <p className="err m-0">{customNameError}</p>}
            {logoError && <p className="err m-0">{logoError}</p>}
            {customLogoDataUrl && (
              <button
                type="button"
                onClick={() => setCustomLogoDataUrl(null)}
                className="w-fit cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Bỏ logo
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        <PickerRow
          label="Quốc gia"
          value={countryName(selectedCountryCode)}
          onPrevious={() => stepCountry(-1)}
          onNext={() => stepCountry(1)}
          onOpenList={() => setOpenedPicker("country")}
          isDisabled={countryCodes.length < 2}
        />
        <PickerRow
          label="Hạng đấu"
          value={selectedLeague.name}
          onPrevious={() => stepLeague(-1)}
          onNext={() => stepLeague(1)}
          onOpenList={() => setOpenedPicker("league")}
          isDisabled={leagues.length < 2}
        />
        <PickerRow
          label={isCustom ? "Đội bị loại bỏ" : "Đội bóng"}
          value={selectedClub?.name ?? (isLoading ? "Đang tải dữ liệu…" : "Chưa có đội")}
          onPrevious={() => stepClub(-1)}
          onNext={() => stepClub(1)}
          onOpenList={() => setOpenedPicker("club")}
          isDisabled={clubs.length < 2}
        />
      </div>

      <section
        aria-live="polite"
        className="mt-5 flex min-h-75 flex-col items-center gap-4 rounded-xl border border-border bg-secondary px-4 py-6"
      >
        {selectedClub ? (
          <>
            <div
              key={selectedClub.name}
              className={cn(
                "animate-in fade-in-0 zoom-in-90 duration-300 transition-[filter,opacity]",
                selectedClub.isLocked && "opacity-60 grayscale",
              )}
            >
              {isCustom && customLogoDataUrl ? (
                <img
                  src={customLogoDataUrl}
                  alt=""
                  width={128}
                  height={128}
                  style={{ objectFit: "contain" }}
                />
              ) : (
                <ClubBadge
                  name={isCustom ? trimmedCustomName || "CLB" : selectedClub.name}
                  size={128}
                />
              )}
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <h3 className="text-balance text-[20px] uppercase">
                {isCustom ? trimmedCustomName || "CLB của bạn" : selectedClub.name}
              </h3>
              <p className="hint">
                {isCustom
                  ? `${selectedLeague.name} · thế chỗ ${selectedClub.name}, thừa hưởng đội hình`
                  : `${selectedLeague.name} · ${selectedClub.tierLabel}`}
              </p>
            </div>
            <dl className="grid w-full max-w-105 grid-cols-5 gap-1.5 text-center">
              <div className="flex flex-col gap-1 rounded-lg bg-card px-1 py-2">
                <dt className="text-[10px] font-medium text-muted-foreground uppercase">
                  {isCustom ? "OVR đội" : "Sức mạnh"}
                </dt>
                <dd className="text-[20px] font-extrabold text-foreground tabular-nums">
                  {selectedClub.strength}
                </dd>
              </div>
              {LINE_LABELS.map(([line, lineLabel, lineColor]) => (
                <div key={line} className="flex flex-col gap-1 rounded-lg bg-card px-1 py-2">
                  <dt className="truncate text-[10px] font-medium text-muted-foreground uppercase">
                    {lineLabel}
                  </dt>
                  <dd
                    className="text-[20px] font-extrabold tabular-nums"
                    style={{ color: lineColor }}
                  >
                    {selectedClub.lineStrengths[line]}
                  </dd>
                </div>
              ))}
            </dl>
            {isCustom && (
              <div className="w-full max-w-105 rounded-lg bg-card px-3 py-2.5 text-left">
                <p className="hint m-0 mb-1.5">
                  Thừa hưởng {selectedClub.squadSize} cầu thủ, ngôi sao gồm:
                </p>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {selectedClub.topPlayers.map((topPlayer) => (
                    <li key={topPlayer.name} className="flex items-center gap-2 text-sm">
                      <span className="w-9 text-[11px] font-semibold text-muted-foreground">
                        {topPlayer.position}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {topPlayer.name}
                      </span>
                      <b className="tabular-nums">{topPlayer.ovr}</b>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedClub.isLocked && (
              <p className="flex items-center gap-1.5 text-center text-[13px] font-semibold text-destructive">
                <Lock size={14} aria-hidden="true" />
                Cần uy tín {selectedClub.requiredReputation}, bạn mới có {NEWBIE_REPUTATION}
              </p>
            )}
          </>
        ) : isLoading ? (
          <Preloader className="pointer-events-auto static inset-auto z-auto min-h-0 w-full flex-1" />
        ) : (
          <p className="hint m-auto">Dữ liệu không có CLB nào của giải này.</p>
        )}
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-4 rounded-b-xl border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button variant="hot" className="w-full" disabled={!canConfirm} onClick={confirm}>
          {selectedClub?.isLocked ? "Chưa thể chọn đội này" : "Xác nhận"}
        </Button>
      </div>

      {openedPicker === "country" && (
        <Sheet onClose={closePicker}>
          <h3>Chọn quốc gia</h3>
          <div className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto">
            {countryCodes.map((countryCode) => (
              <button
                key={countryCode}
                type="button"
                onClick={() => {
                  setPickedCountryCode(countryCode);
                  closePicker();
                }}
                aria-current={countryCode === selectedCountryCode}
                className={cn(
                  "min-h-12 rounded-lg border px-3.5 text-left text-[15px] font-bold text-foreground",
                  countryCode === selectedCountryCode
                    ? "border-(--accent) bg-secondary"
                    : "border-border bg-card hover:border-(--accent)",
                )}
              >
                {countryName(countryCode)}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {openedPicker === "league" && (
        <Sheet onClose={closePicker}>
          <h3>Chọn hạng đấu · {countryName(selectedCountryCode)}</h3>
          <div className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto">
            {leagues.map((league) => (
              <button
                key={league.id}
                type="button"
                onClick={() => {
                  setPickedLeagueId(league.id);
                  closePicker();
                }}
                aria-current={league.id === selectedLeague.id}
                className={cn(
                  "min-h-12 rounded-lg border px-3.5 text-left text-[15px] font-bold text-foreground",
                  league.id === selectedLeague.id
                    ? "border-(--accent) bg-secondary"
                    : "border-border bg-card hover:border-(--accent)",
                )}
              >
                {league.name}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {openedPicker === "club" && (
        <Sheet onClose={closePicker}>
          <h3>Chọn đội · {selectedLeague.name}</h3>
          <div className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto">
            {clubs.map((club) => (
              <button
                key={club.name}
                type="button"
                onClick={() => {
                  setPickedClubName(club.name);
                  closePicker();
                }}
                aria-current={club.name === selectedClub?.name}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left text-foreground",
                  club.name === selectedClub?.name
                    ? "border-(--accent) bg-secondary"
                    : "border-border bg-card hover:border-(--accent)",
                  club.isLocked && "opacity-60",
                )}
              >
                <ClubBadge name={club.name} size={36} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-bold">{club.name}</span>
                  <span className="hint">
                    {club.isLocked ? `Cần uy tín ${club.requiredReputation}` : club.tierLabel}
                  </span>
                </span>
                {club.isLocked ? (
                  <Lock
                    size={16}
                    className="shrink-0 text-muted-foreground"
                    aria-label="Chưa mở khóa"
                  />
                ) : (
                  <span className="shrink-0 text-[17px] font-extrabold tabular-nums">
                    {club.strength}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </Card>
  );
}
