import { useState } from "react";
import { natFlagUrl, natName } from "@/engine/players";
import type { Player } from "@/engine/types";

/** Cờ quốc tịch của cầu thủ theo ảnh FIFACM; không có ảnh hoặc lỗi tải thì không hiển thị gì */
export function NationFlag({ player, width = 22 }: { player: Player; width?: number }) {
  const flagUrl = natFlagUrl(player);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  if (!flagUrl || failedUrls.includes(flagUrl)) return null;
  return (
    <img
      key={flagUrl}
      src={flagUrl}
      alt={natName(player)}
      title={natName(player)}
      width={width}
      loading="lazy"
      onError={() => setFailedUrls((urls) => [...urls, flagUrl])}
      className="inline-block h-auto shrink-0 rounded-[2px] object-contain"
    />
  );
}
