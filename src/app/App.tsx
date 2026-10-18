import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { BottomNav, Header } from "@/components/AppChrome";
import { Toast } from "@/components/ui";
import { ClubPage } from "@/features/club/ClubPage";
import { HomePage } from "@/features/home/HomePage";
import { LeaguePage } from "@/features/league/LeaguePage";
import { MarketPage } from "@/features/market/MarketPage";
import { SquadPage } from "@/features/squad/SquadPage";
import { StartScreen } from "@/features/start/StartScreen";
import { useImages } from "@/lib/images";
import { useGame } from "@/stores/gameStore";
import { SheetHost } from "./SheetHost";

export function App() {
  const status = useGame((s) => s.status);
  useEffect(() => {
    void useGame.getState().boot();
    void useImages.getState().load();
  }, []);

  return (
    <HashRouter>
      <div className="wrap">
        <Header />
        <main className="col" style={{ gap: 14 }}>
          {status === "loading" && <section className="panel"><p className="hint">Đang tải sự nghiệp…</p></section>}
          {status === "none" && <StartScreen />}
          {status === "ready" && (
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/squad" element={<SquadPage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/league" element={<LeaguePage />} />
              <Route path="/club" element={<ClubPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>
      </div>
      {status === "ready" && <><BottomNav /><SheetHost /></>}
      <Toast />
    </HashRouter>
  );
}
