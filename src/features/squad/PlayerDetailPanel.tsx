import { Star } from "lucide-react";
import { type ReactNode, useState } from "react";
import { formatMoney, formatWage } from "@/engine/format";
import { faceStats } from "@/engine/faceStats";
import { mockData } from "@/engine/mockData";
import { playStyleIconUrl } from "@/engine/playStyles";
import { dynamicRating, moraleLabel, natName, ovrRange } from "@/engine/players";
import { available, myLineup } from "@/engine/squad";
import { getClub } from "@/engine/state";
import type { Player } from "@/engine/types";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/shadcn/button";
import { useUi } from "@/stores/uiStore";
import { moraleColor } from "@/utils/display";

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
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <dt className="text-sm whitespace-nowrap text-muted-foreground">{label}</dt>
      <dd className="m-0 text-right text-sm font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

/** Chỉ số tổng hợp: số + thanh theo màu mức chỉ số */
function FaceStatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <dt className="w-20 shrink-0 text-sm whitespace-nowrap text-muted-foreground">{label}</dt>
      <dd className="m-0 flex flex-1 items-center gap-2">
        <b className="w-7 text-right tabular-nums">{value}</b>
        <span
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/15"
          aria-hidden="true"
        >
          <i
            className="block h-full rounded-full"
            style={{ width: `${value}%`, background: moraleColor(value) }}
          />
        </span>
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
    <section aria-label="PlayStyles" className="flex flex-col gap-2">
      <h3 className="m-0 text-sm font-semibold text-muted-foreground">PlayStyles</h3>
      <ul className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-2 p-0">
        {playStyles.map((playStyle) => (
          <PlayStyleIcon key={playStyle.name} name={playStyle.name} isPlus={playStyle.isPlus} />
        ))}
      </ul>
      {playStyles.length > 0 ? (
        <p className="m-0 line-clamp-2 text-xs text-muted-foreground">
          {playStyles
            .map((playStyle) => `${playStyle.name}${playStyle.isPlus ? "+" : ""}`)
            .join(" · ")}
        </p>
      ) : (
        <p className="m-0 text-xs text-muted-foreground">Cầu thủ chưa có PlayStyle nào.</p>
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

/** Thông số của cầu thủ đang được chọn ở màn Đội hình */
export function PlayerDetailPanel({ player }: { player: Player }) {
  const { openPlayer, setSwapIn } = useUi();
  const isInLineup = myLineup().includes(player.id);
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
  const positions = [player.pos, ...player.secondaryPositions].join(" • ");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <Avatar player={player} size={72} />
        <div className="min-w-0 flex-1 pt-1">
          <span className="text-sm text-muted-foreground">
            {player.positionDetail ? player.positionDetail.replaceAll(", ", " • ") : positions}
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
            <span>
              Hiện tại <b className="text-foreground tabular-nums">{dynamicRating(player)}</b>
            </span>
          </div>
        </div>
      </div>

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

      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[1fr_1.15fr]">
        <dl className="m-0 flex flex-col divide-y divide-foreground/10">
          {profile?.attributes &&
            faceStats(profile.attributes, player.pos === "GK").map((stat) => (
              <FaceStatRow key={stat.label} label={stat.label} value={stat.value} />
            ))}
          <AttributeRow label="Kỹ thuật">
            <StarRating count={profile?.skillMoves ?? null} />
          </AttributeRow>
        </dl>
        <dl className="m-0 flex flex-col divide-y divide-foreground/10 border-t border-foreground/10 sm:border-t-0 sm:border-l sm:border-foreground/15 sm:pl-4">
          <AttributeRow label="Tuổi">{player.age}</AttributeRow>
          <AttributeRow label="Quốc tịch">{natName(player)}</AttributeRow>
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
          <AttributeRow label="Chân yếu">
            <StarRating count={profile?.weakFoot ?? null} />
          </AttributeRow>
        </dl>
      </div>

      {profile && <PlayStyles playStyles={profile.playStyles} />}

      {player.demand && (
        <p className="m-0 text-sm font-semibold text-destructive">
          Cầu thủ đang có yêu cầu chờ bạn trả lời. Mở hồ sơ để xử lý.
        </p>
      )}

      <div className="flex flex-wrap gap-2.5">
        {!isInLineup && available(player) && (
          <Button variant="hot" size="sm" onClick={() => setSwapIn(player.id)}>
            Đưa vào đội hình chính
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => openPlayer(player.id)}>
          Hồ sơ đầy đủ
        </Button>
      </div>
    </div>
  );
}
