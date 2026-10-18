import { useState, type ReactNode } from "react";
import { renamePlayer } from "@/engine/actions";
import { POSN } from "@/engine/constants";
import { dyn, natName, ovrR } from "@/engine/players";
import { C } from "@/engine/state";
import type { Player } from "@/engine/types";
import { Avatar } from "./Avatar";
import { ClubBadge } from "./ClubBadge";
import { playerImgKey, shrinkImage, useImages } from "@/lib/images";
import { commit } from "@/stores/gameStore";
import { toast } from "@/stores/uiStore";

/** Phần đầu bảng trượt: ảnh, chỉ số, tên (sửa được), CLB. Dùng cho hồ sơ cầu thủ và đàm phán. */
export function PlayerHead({ p, extra, onClose }: { p: Player; extra?: ReactNode; onClose?: () => void }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(p.n);
  const key = playerImgKey(p);
  const custom = useImages((s) => !!s.map[key]);
  const put = useImages((s) => s.put);
  const onImg = async (f: File | undefined) => {
    if (!f) return;
    try { await put(key, await shrinkImage(f)); toast("Đã cập nhật ảnh."); } catch (e) { toast((e as Error).message); }
  };
  return (
    <>
      <div className="grab" />
      <div className="sh-head">
        <div className="pav">
          <Avatar p={p} size={72} />
          <span className="pr">{dyn(p)}</span>
          <label className="pimg" title="Đổi ảnh">{custom ? "Đổi" : "Ảnh"}<input type="file" accept="image/*" hidden onChange={(e) => { void onImg(e.target.files?.[0]); e.target.value = ""; }} /></label>
        </div>
        <div style={{ minWidth: 0 }}>
          {edit ? (
            <div className="row">
              <input type="text" value={name} maxLength={32} style={{ flex: 1 }} autoFocus onChange={(e) => setName(e.target.value)} aria-label="Tên cầu thủ" />
              <button className="btn sm" onClick={() => { commit(() => renamePlayer(p.id, name)); setEdit(false); }}>Lưu</button>
            </div>
          ) : (
            <div className="sh-name">{p.n} <button className="linkb" onClick={() => { setName(p.n); setEdit(true); }}>Sửa tên</button></div>
          )}
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <span className={`pos ${p.pos}`}>{POSN[p.pos]}</span>
            {p.pos2.map((x) => <span key={x} className={`pos ${x}`} style={{ opacity: 0.6 }}>{x}</span>)}
            <span className="hint">{p.age} tuổi · {natName(p)} · gốc {ovrR(p)}</span>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            {p.club != null
              ? <><ClubBadge name={C(p.club).n} size={20} /><span className="hint" style={{ color: "var(--ink)", fontWeight: 600 }}>{C(p.club).n}</span></>
              : <span className="hint">Cầu thủ tự do</span>}
            {custom && <button className="linkb" onClick={() => void put(key, null)}>Xóa ảnh</button>}
          </div>
          {p.ln && p.ln !== p.n ? <div className="hint">{p.ln}{p.posD ? " · " + p.posD : ""}</div> : p.posD ? <div className="hint">{p.posD}</div> : null}
          {extra}
        </div>
        {onClose && <button className="x" onClick={onClose} aria-label="Đóng">×</button>}
      </div>
    </>
  );
}
