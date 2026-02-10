export const THEME_STORAGE_KEY = "airfmt.theme";

export const themeIds = [
  "dopamine",
  "midnight",
  "retro",
  "aurora",
  "sunset",
  "ocean",
  "ember",
  "jade",
  "graphite",
  "mono",
] as const;

export type ThemeId = (typeof themeIds)[number];

export type ThemeOption = {
  id: ThemeId;
  label: string;
  description: string;
};

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "dopamine",
    label: "多巴胺",
    description: "高饱和糖果色，明亮活力",
  },
  {
    id: "midnight",
    label: "深夜霓虹",
    description: "深色玻璃+霓虹强调，科技感更强",
  },
  {
    id: "retro",
    label: "复古像素",
    description: "高对比像素风，偏编辑器质感",
  },
  {
    id: "aurora",
    label: "极光玻璃",
    description: "紫青极光，柔和发光玻璃层",
  },
  {
    id: "sunset",
    label: "落日胶片",
    description: "暖橙与玫红叠层，复古胶片氛围",
  },
  {
    id: "ocean",
    label: "海盐青绿",
    description: "海蓝与薄荷渐变，通透冷感玻璃",
  },
  {
    id: "ember",
    label: "余烬夜幕",
    description: "深夜煤灰底配暖橙光感，视觉聚焦更强",
  },
  {
    id: "jade",
    label: "玉雾清晨",
    description: "浅玉与云白渐层，低对比清爽阅读",
  },
  {
    id: "graphite",
    label: "石墨蓝图",
    description: "蓝灰工业感配亮青强调，信息层次分明",
  },
  {
    id: "mono",
    label: "黑白极简",
    description: "极简黑白，信息密度更高",
  },
];

export const DEFAULT_THEME: ThemeId = "dopamine";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  if (!value) {
    return false;
  }

  return themeIds.includes(value as ThemeId);
}
