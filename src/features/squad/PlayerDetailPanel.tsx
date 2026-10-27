import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { formatMoney, formatWage } from "@/engine/format";
import { detailedAttributePages, faceStats } from "@/engine/faceStats";
import { mockData, type PlayerProfile } from "@/engine/mockData";
import { playStyleIconUrl } from "@/engine/playStyles";
import { dynamicRating, moraleLabel, natName, ovrRange } from "@/engine/players";
import { myLineup, mySlotPositions, playablePositions, ratingAtSlot } from "@/engine/squad";
import { getClub } from "@/engine/state";
import type { Player } from "@/engine/types";
import { Avatar } from "@/components/Avatar";
import { NationFlag } from "@/components/NationFlag";
import { RatingDiamond } from "./PlayerCard";
import { useHorizontalSwipe } from "./useHorizontalSwipe";
import { Button } from "@/components/shadcn/button";
import { useUi } from "@/stores/uiStore";
import { classNames, moraleColor } from "@/utils/display";

const WORK_RATE_LEVEL: Record<string, string> = { L: "thấp", M: "vừa", H: "cao" };
/** "H / M" thành "Công cao · Thủ vừa"; thiếu hoặc lạ định dạng thì "—" */
const workRateLabel = (workRates: string | null): string => {
  const [attack, defense] = (workRates ?? "")
    .split("/")
    .map((part) => WORK_RATE_LEVEL[part.trim()]);
  return attack && defense ? `Công ${attack} · Thủ ${defense}` : "—";
};
const levelLabel = (value: number): string =>
  value >= 80
    ? "Rất tốt"
    : value >= 60
      ? "Tốt"
      : value >= 40
        ? "Ổn"
        : value >= 20
          ? "Kém"
          : "Rất kém";
const fitnessLabel = (fitness: number): string =>
  fitness >= 85 ? "Sung sức" : fitness >= 70 ? "Ổn" : fitness >= 50 ? "Mệt" : "Kiệt sức";

function Condition({
  label,
  value,
  caption,
  color,
}: {
  label: string;
  value: number;
  caption: string;
  color: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <b className="text-base leading-tight" style={{ color }}>
        {caption}
      </b>
      <span className="text-xs text-muted-foreground tabular-nums">{Math.round(value)}</span>
    </div>
  );
}

function AttributeRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-9 items-center justify-between gap-2">
      <dt className="min-w-0 truncate text-sm text-muted-foreground">{label}</dt>
      <dd className="m-0 text-right text-base font-bold tabular-nums">{children}</dd>
    </div>
  );
}

/** Một dòng chỉ số: tên bên trái, số tô màu theo mức chỉ số bên phải (dùng cho chỉ số tổng hợp và chi tiết) */
function FaceStatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex h-9 items-center justify-between gap-2">
      <dt className="min-w-0 truncate text-sm text-muted-foreground">{label}</dt>
      <dd className="m-0 text-base font-bold tabular-nums" style={{ color: moraleColor(value) }}>
        {value}
      </dd>
    </div>
  );
}

/** Biểu tượng PlayStyle của FIFACM; lỗi tải ảnh thì hiện chữ viết tắt */
function PlayStyleIcon({ name, isPlus }: { name: string; isPlus: boolean }) {
  const [hasFailed, setHasFailed] = useState(false);
  const iconUrl = playStyleIconUrl(name, isPlus);
  return (
    <li title={`${name}${isPlus ? " +" : ""}`} className="grid size-10 place-items-center">
      {iconUrl && !hasFailed ? (
        <img
          src={iconUrl}
          alt={name}
          width={40}
          height={40}
          loading="lazy"
          onError={() => setHasFailed(true)}
          className="size-10 object-contain"
        />
      ) : (
        <b className="text-xs">
          {name
            .split(" ")
            .map((word) => word[0])
            .join("")
            .slice(0, 2)}
        </b>
      )}
    </li>
  );
}

/** Các ô PlayStyle: ô có sẵn là biểu tượng của FIFACM (bản Plus có icon vàng), chỉ hiện những PlayStyle cầu thủ có */
function PlayStyles({ playStyles }: { playStyles: { name: string; isPlus: boolean }[] }) {
  return (
    <section aria-label="Phong cách chơi" className="flex flex-col gap-2">
      <h3 className="m-0 text-sm font-semibold text-muted-foreground">Phong cách chơi</h3>
      <ul className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-2 p-0">
        {playStyles.map((playStyle) => (
          <PlayStyleIcon key={playStyle.name} name={playStyle.name} isPlus={playStyle.isPlus} />
        ))}
      </ul>
      {playStyles.length === 0 && (
        <p className="m-0 text-xs text-muted-foreground">
          Cầu thủ chưa có phong cách chơi đặc trưng nào.
        </p>
      )}
    </section>
  );
}

function StarRating({ count }: { count: number | null }) {
  if (count === null) return <>—</>;
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${count} trên 5 sao`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={14}
          aria-hidden="true"
          className={index < count ? "fill-(--gold) text-(--gold)" : "text-foreground/30"}
        />
      ))}
    </span>
  );
}

/** Trang mới trượt vào từ phía hướng chuyển (1 = sang trang sau, -1 = về trang trước), trang cũ trượt ra ngược lại */
const PAGE_SLIDE_VARIANTS = {
  enter: ({ direction, distance }: { direction: number; distance: number }) => ({
    opacity: 0,
    x: direction * distance,
  }),
  center: { opacity: 1, x: 0 },
  exit: ({ direction, distance }: { direction: number; distance: number }) => ({
    opacity: 0,
    x: -direction * distance,
  }),
};
const PAGE_LABELS = [
  "Tổng quan",
  "Tốc độ, dứt điểm, rê bóng",
  "Chuyền bóng, phòng ngự, thể chất",
  "Vị trí và năng khiếu",
];

/** Dải chấm chuyển trang; vuốt ngang trên bảng thông số cũng đổi trang và quay vòng ở hai đầu */
export function PageDots({
  pageIndex,
  onChange,
}: {
  pageIndex: number;
  onChange: (pageIndex: number) => void;
}) {
  return (
    <nav
      aria-label="Chuyển trang thông số"
      className="flex shrink-0 items-center justify-center gap-3 py-1"
    >
      {PAGE_LABELS.map((label, index) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          title={label}
          aria-current={index === pageIndex ? "page" : undefined}
          onClick={() => onChange(index)}
          className={classNames(
            "size-2 cursor-pointer rounded-full border-0 p-0 transition-colors",
            index === pageIndex ? "bg-foreground" : "bg-foreground/35 hover:bg-foreground/60",
          )}
        />
      ))}
    </nav>
  );
}

/** Trang 2 và 3: chỉ số chi tiết của FIFACM, chia đều thành hai cột (mỗi cột tối đa 8 dòng) */
function DetailedAttributes({
  attributes,
  isGoalkeeper,
  detailPageIndex,
}: {
  attributes: Record<string, number> | null;
  isGoalkeeper: boolean;
  /** 0 = trang 2 (tốc độ, dứt điểm, rê bóng), 1 = trang 3 (chuyền bóng, phòng ngự, thể chất) */
  detailPageIndex: number;
}) {
  if (!attributes)
    return <p className="m-0 text-sm text-muted-foreground">Chưa có chỉ số chi tiết.</p>;
  const pageAttributes = detailedAttributePages(isGoalkeeper)[detailPageIndex];
  const rowsPerColumn = Math.ceil(pageAttributes.length / 2);
  const columns = [pageAttributes.slice(0, rowsPerColumn), pageAttributes.slice(rowsPerColumn)];
  return (
    <div className="grid grid-cols-2 gap-x-5">
      {columns.map((columnAttributes, columnIndex) => (
        <dl key={columnIndex} className="m-0 flex flex-col divide-y divide-foreground/10">
          {columnAttributes.map((attribute) => (
            <FaceStatRow
              key={attribute.key}
              label={attribute.label}
              value={attributes[attribute.key]}
            />
          ))}
        </dl>
      ))}
    </div>
  );
}

/** Trang 3: chỉ số theo từng vị trí, tốc độ làm việc, năng khiếu và PlayStyle */
function PositionsAndStyles({ profile }: { profile: PlayerProfile | undefined }) {
  if (!profile) return <p className="m-0 text-sm text-muted-foreground">Chưa có dữ liệu.</p>;
  const positionRatings = Object.entries(profile.positionRatings).sort(
    ([, ratingA], [, ratingB]) => ratingB - ratingA,
  );
  return (
    <>
      <section aria-label="Chỉ số theo vị trí" className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold text-muted-foreground">Chỉ số theo vị trí</h3>
        <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0 sm:grid-cols-6">
          {positionRatings.map(([position, rating]) => (
            <li
              key={position}
              className="flex flex-col items-center rounded-lg bg-foreground/10 py-1"
            >
              <span className="text-xs text-muted-foreground">{position}</span>
              <b className="tabular-nums" style={{ color: moraleColor(rating) }}>
                {rating}
              </b>
            </li>
          ))}
        </ul>
      </section>
      <dl className="m-0 flex flex-col divide-y divide-foreground/10">
        <AttributeRow label="Tốc độ làm việc">{workRateLabel(profile.workRates)}</AttributeRow>
      </dl>
      {profile.specialities.length > 0 && (
        <section aria-label="Năng khiếu" className="flex flex-col gap-2">
          <h3 className="m-0 text-sm font-semibold text-muted-foreground">Năng khiếu</h3>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {profile.specialities.map((speciality) => (
              <li key={speciality} className="rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs">
                {speciality}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Thông số của cầu thủ đang được chọn ở màn Đội hình */
export function PlayerDetailPanel({
  player,
  pageIndex,
  onPageChange,
}: {
  player: Player;
  pageIndex: number;
  onPageChange: (pageIndex: number) => void;
}) {
  const { openPlayer } = useUi();
  const shouldReduceMotion = useReducedMotion();
  const previousPageIndexRef = useRef(pageIndex);
  const lastDirectionRef = useRef(1);
  // Vuốt quay vòng (trang cuối vuốt tiếp về trang đầu) vẫn trượt theo hướng vuốt, không theo chiều tăng giảm của chỉ số trang
  const swipeDirectionRef = useRef<1 | -1 | null>(null);
  const direction =
    pageIndex === previousPageIndexRef.current
      ? lastDirectionRef.current
      : (swipeDirectionRef.current ?? (pageIndex > previousPageIndexRef.current ? 1 : -1));
  const slideDirection = { direction, distance: shouldReduceMotion ? 0 : 48 };
  useEffect(() => {
    previousPageIndexRef.current = pageIndex;
    lastDirectionRef.current = direction;
    swipeDirectionRef.current = null;
  }, [pageIndex, direction]);
  const startSwipe = useHorizontalSwipe((swipeDirection) => {
    swipeDirectionRef.current = swipeDirection;
    onPageChange((pageIndex + swipeDirection + PAGE_LABELS.length) % PAGE_LABELS.length);
  });
  const profile =
    player.sourceId === undefined
      ? undefined
      : mockData().playerProfileBySourceId?.[player.sourceId];
  const status =
    player.injuryDays > 0
      ? `Chấn thương ${player.injuryDays} ngày`
      : player.away
        ? `Đang ở ${getClub(player.away.club).name}`
        : "Sẵn sàng thi đấu";
  const lineupIndex = myLineup().indexOf(player.id);
  const slotPosition = lineupIndex >= 0 ? mySlotPositions()[lineupIndex] : undefined;
  const currentRating = slotPosition ? ratingAtSlot(player, slotPosition) : dynamicRating(player);
  const otherPositions = (
    player.positionDetail ? playablePositions(player) : [player.pos, ...player.secondaryPositions]
  ).filter((position) => position !== slotPosition);
  return (
    <div
      className="flex touch-pan-y flex-col gap-3 overflow-x-clip select-none"
      onPointerDown={startSwipe}
    >
      <div className="flex items-center gap-3">
        <Avatar player={player} size={72} className="rounded-none bg-transparent" />
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <NationFlag player={player} />
            <span>
              {slotPosition && <b className="text-foreground">{slotPosition}</b>}
              {slotPosition && otherPositions.length > 0 && " • "}
              {otherPositions.join(" • ")}
            </span>
          </span>
          <h2 className="m-0 font-(family-name:--f-display) text-lg leading-tight font-extrabold uppercase">
            {player.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs text-muted-foreground">
            <span>
              Gốc <b className="text-foreground tabular-nums">{ovrRange(player)}</b>
            </span>
            <span>
              Tiềm năng <b className="text-foreground tabular-nums">{player.pot}</b>
            </span>
          </div>
        </div>
        <span className="relative mr-12 size-10 shrink-0" title="Chỉ số hiện tại">
          <RatingDiamond rating={currentRating} baseRating={ovrRange(player)} isLarge />
        </span>
      </div>

      <>
        <div className="grid grid-cols-3 gap-3 border-t border-foreground/15 pt-3.5">
          <Condition
            label="Phong độ"
            value={player.form}
            caption={levelLabel(player.form)}
            color={moraleColor(player.form)}
          />
          <Condition
            label="Tinh thần"
            value={player.morale}
            caption={moraleLabel(player.morale)}
            color={moraleColor(player.morale)}
          />
          <Condition
            label="Thể lực"
            value={player.fitness}
            caption={fitnessLabel(player.fitness)}
            color={player.fitness < 70 ? "var(--lv-1)" : "var(--lv-5)"}
          />
        </div>

        <div
          className="rounded-lg bg-foreground/10 py-1.5 text-center text-sm font-semibold"
          style={player.injuryDays > 0 ? { color: "var(--loss)" } : undefined}
        >
          {status}
        </div>
      </>

      <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
        <m.div
          key={pageIndex}
          custom={slideDirection}
          variants={PAGE_SLIDE_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex min-h-74 flex-col gap-3"
        >
          {pageIndex === 0 && (
            <>
              <div className="grid grid-cols-2 gap-x-5">
                <dl className="m-0 flex flex-col divide-y divide-foreground/10">
                  {profile?.attributes &&
                    faceStats(profile.attributes, player.pos === "GK").map((stat) => (
                      <FaceStatRow key={stat.label} label={stat.label} value={stat.value} />
                    ))}
                  <AttributeRow label="Kỹ thuật">
                    <StarRating count={profile?.skillMoves ?? null} />
                  </AttributeRow>
                  <AttributeRow label="Chân yếu">
                    <StarRating count={profile?.weakFoot ?? null} />
                  </AttributeRow>
                </dl>
                <dl className="m-0 flex flex-col divide-y divide-foreground/10">
                  <AttributeRow label="Tuổi">{player.age}</AttributeRow>
                  <AttributeRow label="Chiều cao">
                    {profile?.heightCm ? `${profile.heightCm} cm` : "—"}
                  </AttributeRow>
                  <AttributeRow label="Quốc tịch">
                    <span className="inline-flex items-center gap-1.5">
                      <NationFlag player={player} width={18} />
                      {natName(player)}
                    </span>
                  </AttributeRow>
                  <AttributeRow label="Vai trò">
                    {player.contract ? player.contract.role : "—"}
                  </AttributeRow>
                  <AttributeRow label="Giá trị">{formatMoney(player.marketValue)}</AttributeRow>
                  <AttributeRow label="Lương">
                    {player.contract ? formatWage(player.contract.wage) : "—"}
                  </AttributeRow>
                  <AttributeRow label="Hợp đồng">
                    {player.contract ? `30/6/${player.contract.expiryYear}` : "—"}
                  </AttributeRow>
                  <AttributeRow label="Chân thuận">
                    {profile?.preferredFoot === "Left"
                      ? "Trái"
                      : profile?.preferredFoot === "Right"
                        ? "Phải"
                        : "—"}
                  </AttributeRow>
                </dl>
              </div>
            </>
          )}
          {(pageIndex === 1 || pageIndex === 2) && (
            <DetailedAttributes
              attributes={profile?.attributes ?? null}
              isGoalkeeper={player.pos === "GK"}
              detailPageIndex={pageIndex - 1}
            />
          )}
          {pageIndex === 3 && <PositionsAndStyles profile={profile} />}
        </m.div>
      </AnimatePresence>

      {profile && (
        <div className="mt-auto">
          <PlayStyles playStyles={profile.playStyles} />
        </div>
      )}

      {player.demand && (
        <div className="flex flex-col items-start gap-2">
          <p className="m-0 text-sm font-semibold text-destructive">
            Cầu thủ đang có yêu cầu chờ bạn trả lời.
          </p>
          <Button variant="ghost" size="sm" onClick={() => openPlayer(player.id)}>
            Xử lý yêu cầu
          </Button>
        </div>
      )}
    </div>
  );
}
