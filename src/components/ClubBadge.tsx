import { memo } from "react";
import { clubCode, clubColors, hashStr, lum } from "@/lib/clubVisual";
import { clubImgKey, useImg } from "@/lib/images";

const SHIELD = "M16 2 L29 6 V16 C29 24 23 29 16 31 C9 29 3 24 3 16 V6 Z";

/** Huy hiệu CLB: ảnh người dùng thêm, hoặc khiên SVG theo màu áo */
export const ClubBadge = memo(function ClubBadge({ name, size = 28 }: { name: string; size?: number }) {
  const custom = useImg(clubImgKey(name));
  if (custom) return <img className="bdg" src={custom} width={size} height={size} alt="" />;
  const [c1, c2] = clubColors(name);
  const pat = hashStr(name) % 5, code = clubCode(name), id = "g" + hashStr(name + size);
  const ring = lum(c1) > 0.85 && lum(c2) > 0.85 ? "#888" : "rgba(0,0,0,.25)";
  const long = code.length > 2;
  return (
    <svg className="bdg" width={size} height={size} viewBox="0 0 32 33" aria-hidden="true">
      <defs><clipPath id={id}><path d={SHIELD} /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        <rect width="32" height="33" fill={c1} />
        {pat === 0 && <rect x="0" y="11" width="32" height="7" fill={c2} />}
        {pat === 1 && <><rect x="7" y="0" width="5" height="32" fill={c2} /><rect x="20" y="0" width="5" height="32" fill={c2} /></>}
        {pat === 2 && <path d="M0 22 L22 0 H32 V4 L4 32 H0 Z" fill={c2} />}
        {pat === 3 && <rect x="16" y="0" width="16" height="32" fill={c2} />}
        {pat === 4 && <path d="M3 10 L16 18 L29 10 V15 L16 23 L3 15 Z" fill={c2} />}
      </g>
      <path d={SHIELD} fill="none" stroke={ring} strokeWidth="1.2" />
      <rect x={long ? 5 : 7} y="12.6" width={long ? 22 : 18} height="9.6" rx="2.4" fill="rgba(10,14,12,.62)" />
      <text x="16" y="20.2" textAnchor="middle" fontFamily="Barlow Condensed,Arial Narrow,sans-serif" fontWeight="800" fontSize={long ? 9 : 10.5} fill="#ffffff" letterSpacing=".3">{code}</text>
    </svg>
  );
});
