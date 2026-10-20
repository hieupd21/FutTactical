import { useState } from "react";
import { BUDGET_STEP, hireScout, reallocate, scoutCost, WAGE_STEP } from "@/engine/actions";
import { myWages, objStatus } from "@/engine/board";
import { myRep, repLabel } from "@/engine/career";
import { fmtM, fmtW } from "@/engine/format";
import { me, S } from "@/engine/state";
import { ClubBadge } from "@/components/ClubBadge";
import { FileButton, KV } from "@/components/ui";
import { bulkImages, clubImgKey, shrinkImage, useImages } from "@/lib/images";
import { commit, useGame, useGameVersion } from "@/stores/gameStore";
import { toast } from "@/stores/uiStore";
import { shortD, stars } from "@/utils/display";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";

function Board() {
  const confC = S.conf >= 60 ? "var(--win)" : S.conf >= 35 ? "var(--gold-ink)" : "var(--loss)";
  const w = myWages(),
    liab = S.liab.filter((l) => l.amt > 0),
    recv = S.liab.filter((l) => l.amt < 0);
  return (
    <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
      <h2>Ban lãnh đạo</h2>
      <div>
        <div className="row between">
          <span>Niềm tin</span>
          <b className="mono">{Math.round(S.conf)}/100</b>
        </div>
        <div className="conf">
          <i style={{ width: `${S.conf}%`, background: confC }} />
        </div>
        <div className="row between">
          <span>Uy tín HLV</span>
          <b className="mono">
            {Math.round(myRep())}/100 · {repLabel(myRep())}
          </b>
        </div>
        <p className="hint">Dưới 12 điểm giữa mùa hoặc dưới 15 khi tổng kết, bạn sẽ bị sa thải.</p>
      </div>
      {S.board.objs.map((o) => {
        const st = objStatus(o);
        return (
          <div key={o.k} className="obj">
            <span>
              <b>{o.n}</b>
              <br />
              <span className="hint">{o.imp}</span>
            </span>
            <span className={`st ${st.pending ? "" : st.ok ? "ok" : "no"}`}>
              {st.pending ? "Chưa bắt đầu" : st.ok ? "Đang đạt" : "Chưa đạt"}
            </span>
            <span className="hint" style={{ gridColumn: "1/-1" }}>
              {st.txt}
            </span>
          </div>
        );
      })}
      <h2>Tài chính</h2>
      <KV
        rows={[
          ["Ngân sách chuyển nhượng", fmtM(me().budget)],
          ["Tổng lương", fmtW(w)],
          ["Quỹ lương", fmtW(S.wageCap)],
          ["Còn trống", fmtW(S.wageCap - w), w > S.wageCap ? "no" : "ok"],
        ]}
      />
      <div className="col" style={{ gap: 6 }}>
        <h3>Điều chỉnh ngân sách</h3>
        <p className="hint">
          {fmtM(BUDGET_STEP)} ngân sách chuyển nhượng ↔ {fmtW(WAGE_STEP)} quỹ lương.
        </p>
        <div className="row">
          <Button variant="ghost" size="sm" disabled={me().budget < BUDGET_STEP} onClick={() => commit(() => reallocate("toWage"))}>
            {fmtM(BUDGET_STEP)} → quỹ lương
          </Button>
          <Button variant="ghost" size="sm" disabled={S.wageCap - w < WAGE_STEP} onClick={() => commit(() => reallocate("toFee"))}>
            Quỹ lương → {fmtM(BUDGET_STEP)}
          </Button>
        </div>
      </div>
      {(liab.length > 0 || recv.length > 0) && (
        <>
          <h3>Các khoản trả góp</h3>
          <KV
            rows={[
              ...liab.map((l): [string, string, string] => [`Trả ${l.to} (mùa ${l.y})`, "−" + fmtM(l.amt), "no"]),
              ...recv.map((l): [string, string, string] => [`Nhận từ ${l.to} (mùa ${l.y})`, "+" + fmtM(-l.amt), "ok"]),
            ]}
          />
        </>
      )}
    </Card>
  );
}

function Images() {
  const { map, put, clearAll } = useImages();
  const [confirm, setConfirm] = useState(false);
  const name = me().n,
    key = clubImgKey(name);
  const keys = Object.keys(map);
  const onBadge = async (f: File) => {
    try {
      await put(key, await shrinkImage(f));
      toast("Đã cập nhật huy hiệu.");
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const onBulk = async (files: File[]) => {
    toast(`Đang xử lý ${files.length} ảnh…`);
    const r = await bulkImages(
      files,
      Object.values(S.P),
      Object.values(S.clubs).map((c) => c.n),
    );
    toast(
      `Đã thêm ${r.pc} ảnh cầu thủ, ${r.cc} huy hiệu${r.miss.length ? `. Không khớp tên: ${r.miss.slice(0, 3).join(", ")}${r.miss.length > 3 ? "…" : ""}` : ""}.`,
    );
  };
  return (
    <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
      <h2>Ảnh & huy hiệu</h2>
      <div className="row">
        <ClubBadge name={name} size={56} />
        <div className="col" style={{ gap: 6, flex: 1 }}>
          <FileButton label="Đổi huy hiệu CLB" accept="image/*" onFiles={(f) => void onBadge(f[0])} />
          {map[key] && (
            <Button
              variant="link"
              className="linkb relative h-auto min-h-0 after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] border-0 px-1 py-0.5 text-xs font-semibold tracking-normal text-muted-foreground normal-case"
              style={{ alignSelf: "flex-start" }}
              onClick={() => void put(key, null)}
            >
              Về huy hiệu mặc định
            </Button>
          )}
        </div>
      </div>
      <p className="hint">
        Nhập nhiều ảnh cùng lúc: đặt tên file trùng tên cầu thủ hoặc CLB như trong game (ví dụ "B. Saka.png", "Bukayo Saka.jpg",
        "Arsenal.png"). Ảnh được thu nhỏ và chỉ lưu trong trình duyệt này.
      </p>
      <FileButton label="Nhập ảnh hàng loạt" accept="image/*" multiple onFiles={(f) => void onBulk(f)} />
      {keys.length > 0 && (
        <div className="row between">
          <span className="hint">
            Đã thêm {keys.filter((k) => k[0] === "p").length} ảnh cầu thủ, {keys.filter((k) => k[0] === "c").length} huy hiệu.
          </span>
          {confirm ? (
            <span className="row">
              <Button
                variant="hot"
                size="sm"
                onClick={() => {
                  setConfirm(false);
                  void clearAll().then(() => toast("Đã xóa tất cả ảnh."));
                }}
              >
                Xóa hết
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                Hủy
              </Button>
            </span>
          ) : (
            <Button
              variant="link"
              className="linkb relative h-auto min-h-0 after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] border-0 px-1 py-0.5 text-xs font-semibold tracking-normal text-muted-foreground normal-case"
              onClick={() => setConfirm(true)}
            >
              Xóa tất cả ảnh
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function Staff() {
  const reset = useGame((s) => s.reset);
  const [confirm, setConfirm] = useState(false);
  return (
    <Card className="panel min-w-0 gap-0 rounded-xl p-4 shadow-none">
      <h2>Nhân sự</h2>
      <div className="obj">
        <span>
          <b>Trưởng bộ phận tuyển trạch</b>
          <br />
          <span className="hint">Càng giỏi, ước tính tiềm năng và giá chuyển nhượng càng chính xác.</span>
        </span>
        <span className="stars">{stars(S.scout)}</span>
      </div>
      {S.scout < 5 && (
        <Button variant="ghost" size="sm" disabled={me().budget < scoutCost()} onClick={() => toast(commit(hireScout)!)}>
          Thuê người giỏi hơn · {fmtM(scoutCost())}
        </Button>
      )}
      <h2>Lịch sử</h2>
      {S.seasonLog.length ? (
        S.seasonLog.map((s) => (
          <div key={s.y} className="row between">
            <span>
              Mùa {s.y}/{s.y + 1}
            </span>
            <b>Hạng {s.pos ?? "—"}</b>
          </div>
        ))
      ) : (
        <p className="hint">Mùa giải đầu tiên.</p>
      )}
      <h2>Tin CLB</h2>
      {S.news
        .filter((x) => x.k === "club")
        .slice(0, 10)
        .map((x, i) => (
          <p key={i} className="hint" style={{ color: "var(--ink)" }}>
            {shortD(x.d)} · {x.t}
          </p>
        ))}
      <p className="hint">Dữ liệu: {S.src || "Thế giới hư cấu"}</p>
      {confirm ? (
        <div className="row">
          <span>Xóa sự nghiệp hiện tại?</span>
          <Button variant="hot" size="sm" onClick={() => void reset()}>
            Xóa
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
            Hủy
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
          Bắt đầu lại
        </Button>
      )}
    </Card>
  );
}

export function ClubPage() {
  useGameVersion();
  return (
    <div className="grid2">
      <Board />
      <div className="col">
        <Images />
        <Staff />
      </div>
    </div>
  );
}
