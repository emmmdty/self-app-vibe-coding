import type { ViewportMode } from "./types";

const MODES: ViewportMode[] = ["desktop", "tablet", "mobile"];

export function isViewportMode(value: string): value is ViewportMode {
  return MODES.includes(value as ViewportMode);
}

export function applyViewportMode(frameElement: HTMLElement, mode: ViewportMode): void {
  frameElement.dataset.preview = mode;
}

export function setViewportButtonsActive(
  buttons: NodeListOf<HTMLButtonElement>,
  mode: ViewportMode
): void {
  buttons.forEach((button) => {
    const isActive = button.dataset.viewport === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}
