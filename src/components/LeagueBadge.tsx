import { useState } from "react";
import { mockData } from "@/engine/mockData";

/** Logo giải từ FIFACM; không có ảnh hoặc ảnh lỗi thì không hiện gì. */
export function LeagueBadge({ leagueId, size = 28 }: { leagueId: string; size?: number }) {
  const imageUrl = mockData().clubVisuals.leagueImageUrlById?.[leagueId];
  const [hasFailed, setHasFailed] = useState(false);
  if (!imageUrl || hasFailed) return null;
  return (
    <img
      src={imageUrl}
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
      alt=""
      onError={() => setHasFailed(true)}
    />
  );
}
