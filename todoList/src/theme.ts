import { DEFAULT_THEME_COLOR, normalizeHexColor } from "./storage";

function hexToRgb(color: string): [number, number, number] | null {
  const normalized = normalizeHexColor(color);
  if (!normalized) {
    return null;
  }

  const value = normalized.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return [red, green, blue];
}

function rgbToHex(red: number, green: number, blue: number): string {
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function darken([red, green, blue]: [number, number, number], ratio: number): [number, number, number] {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return [clamp(red * ratio), clamp(green * ratio), clamp(blue * ratio)];
}

export function applyThemeColor(color: string, target: HTMLElement = document.documentElement): string {
  const normalized = normalizeHexColor(color) ?? DEFAULT_THEME_COLOR;
  const rgb = hexToRgb(normalized) ?? [47, 128, 237];
  const strong = darken(rgb, 0.8);

  target.style.setProperty("--theme-color", normalized);
  target.style.setProperty("--theme-color-strong", rgbToHex(strong[0], strong[1], strong[2]));
  target.style.setProperty("--theme-color-soft", `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.16)`);
  target.style.setProperty("--theme-shadow", `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.24)`);

  return normalized;
}
