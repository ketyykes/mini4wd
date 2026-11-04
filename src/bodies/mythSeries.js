// 第八階段：神話車殼的體系清單（網頁選單分群、P20、陣容圖共用；定義見 GOAL.md、SPEC.md P20 第八階段定義）
// 順序 = 網頁選單與陣容圖的排列順序；希臘、北歐為必做體系（P20 各 ≥ 3 款）

/** @typedef {import('./types').MythSeries} MythSeries */

/** @type {{ key: MythSeries, label: string }[]} 神話體系代號與中文名稱 */
export const MYTH_SERIES = [
  { key: 'greek', label: '希臘神話' },
  { key: 'norse', label: '北歐神話' },
  { key: 'egyptian', label: '埃及神話' },
  { key: 'mesopotamian', label: '美索不達米亞神話' },
  { key: 'celtic', label: '凱爾特神話' },
  { key: 'slavic', label: '斯拉夫神話' },
  { key: 'finnish', label: '芬蘭神話' },
  { key: 'japanese', label: '日本神話' },
  { key: 'chinese', label: '中國神話' },
  { key: 'hindu', label: '印度神話' },
  { key: 'mesoamerican', label: '阿茲特克／馬雅神話' },
  { key: 'polynesian', label: '波利尼西亞神話' },
];

/** @type {(key: string | undefined) => string} 體系代號 → 網頁選單分組名稱（「神話・希臘神話」）；未知代號回傳「神話・其他」 */
export const mythGroupLabel = (key) => {
  const s = MYTH_SERIES.find((x) => x.key === key);
  if (!s) {
    return '神話・其他';
  }
  return `神話・${s.label}`;
};
