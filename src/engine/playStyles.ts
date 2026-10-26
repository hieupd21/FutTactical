import playStyleIcons from "../../data/fifacm/playstyles.json";

const iconUrlByKey = new Map(
  playStyleIcons.map((icon) => [`${icon.name}|${icon.isPlus}`, icon.imageUrl]),
);

/** Biểu tượng PlayStyle của FIFACM; undefined nếu nguồn không có */
export function playStyleIconUrl(name: string, isPlus: boolean): string | undefined {
  return iconUrlByKey.get(`${name}|${isPlus}`);
}
