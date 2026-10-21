import { useState, type ReactNode } from "react";
import { renamePlayer } from "@/engine/actions";
import { POSITION_NAMES } from "@/engine/constants";
import { dynamicRating, natName, ovrRange } from "@/engine/players";
import { getClub } from "@/engine/state";
import type { Player } from "@/engine/types";
import { Avatar } from "./Avatar";
import { ClubBadge } from "./ClubBadge";
import { playerImgKey, shrinkImage, useImages } from "@/lib/images";
import { commit } from "@/stores/gameStore";
import { toast } from "@/stores/uiStore";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { Input } from "@/components/shadcn/input";

/** Phần đầu bảng trượt: ảnh, chỉ số, tên (sửa được), CLB. Dùng cho hồ sơ cầu thủ và đàm phán. */
export function PlayerHead({
  player,
  extra,
  onClose,
}: {
  player: Player;
  extra?: ReactNode;
  onClose?: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(player.name);
  const key = playerImgKey(player);
  const custom = useImages((imageState) => !!imageState.map[key]);
  const saveImage = useImages((imageState) => imageState.saveImage);
  const onImg = async (file: File | undefined) => {
    if (!file) return;
    try {
      await saveImage(key, await shrinkImage(file));
      toast("Đã cập nhật ảnh.");
    } catch (error) {
      toast((error as Error).message);
    }
  };
  return (
    <>
      <div className="grab" />
      <div className="sh-head">
        <div className="pav">
          <Avatar player={player} size={72} />
          <span className="pr">{dynamicRating(player)}</span>
          <label className="pimg" title="Đổi ảnh">
            {custom ? "Đổi" : "Ảnh"}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                void onImg(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        <div style={{ minWidth: 0 }}>
          {edit ? (
            <div className="row">
              <Input
                type="text"
                value={name}
                maxLength={32}
                style={{ flex: 1 }}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                aria-label="Tên cầu thủ"
              />
              <Button
                size="sm"
                onClick={() => {
                  commit(() => renamePlayer(player.id, name));
                  setEdit(false);
                }}
              >
                Lưu
              </Button>
            </div>
          ) : (
            <div className="sh-name">
              {player.name}{" "}
              <button
                className="linkb"
                onClick={() => {
                  setName(player.name);
                  setEdit(true);
                }}
              >
                Sửa tên
              </button>
            </div>
          )}
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <Badge variant="pos" className={`pos ${player.pos}`}>
              {POSITION_NAMES[player.pos]}
            </Badge>
            {player.secondaryPositions.map((line) => (
              <Badge key={line} variant="pos" className={`pos alt text-foreground ${line}`}>
                {line}
              </Badge>
            ))}
            <span className="hint">
              {player.age} tuổi · {natName(player)} · gốc {ovrRange(player)}
            </span>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            {player.club != null ? (
              <>
                <ClubBadge name={getClub(player.club).name} size={20} />
                <span className="hint" style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {getClub(player.club).name}
                </span>
              </>
            ) : (
              <span className="hint">Cầu thủ tự do</span>
            )}
            {custom && (
              <Button
                variant="link"
                className="linkb relative h-auto min-h-0 after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] border-0 px-1 py-0.5 text-xs font-semibold tracking-normal text-muted-foreground normal-case"
                onClick={() => void saveImage(key, null)}
              >
                Xóa ảnh
              </Button>
            )}
          </div>
          {player.longName && player.longName !== player.name ? (
            <div className="hint">
              {player.longName}
              {player.positionDetail ? " · " + player.positionDetail : ""}
            </div>
          ) : player.positionDetail ? (
            <div className="hint">{player.positionDetail}</div>
          ) : null}
          {extra}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="x size-11 rounded-full border border-border text-xl"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </Button>
        )}
      </div>
    </>
  );
}
