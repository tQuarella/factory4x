/**
 * Tiny DOM helpers. Screens are built once and updated in place (text,
 * disabled, widths), never rebuilt every frame, so a finger that lands on a
 * button is still on that button when it lifts.
 */

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  text = '',
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

export function setText(e: HTMLElement, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

export function setHidden(e: HTMLElement, hidden: boolean): void {
  if (e.hidden !== hidden) e.hidden = hidden;
}

export function toggleClass(e: HTMLElement, cls: string, on: boolean): void {
  if (e.classList.contains(cls) !== on) e.classList.toggle(cls, on);
}

export interface Btn {
  el: HTMLButtonElement;
  /** Updates label and enabled state, touching the DOM only on change. */
  set(label: string, enabled?: boolean): void;
}

/** A 44 px-minimum button. `onClick` runs on click (touch taps arrive as clicks). */
export function btn(parent: HTMLElement, label: string, onClick: () => void, cls = ''): Btn {
  const el = h('button', `btn ${cls}`.trim(), label, parent);
  el.type = 'button';
  el.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (!el.disabled) onClick();
  });
  return {
    el,
    set(l, enabled = true) {
      setText(el, l);
      if (el.disabled === enabled) el.disabled = !enabled;
    },
  };
}

/** A horizontal progress bar; `set(frac)` takes 0..1. */
export function bar(parent: HTMLElement, cls = ''): { el: HTMLElement; set(frac: number): void } {
  const el = h('div', `bar ${cls}`.trim(), '', parent);
  const fill = h('div', 'bar-fill', '', el);
  let last = -1;
  return {
    el,
    set(frac) {
      const pct = Math.round(Math.min(1, Math.max(0, frac)) * 100);
      if (pct !== last) {
        last = pct;
        fill.style.width = `${pct}%`;
      }
    },
  };
}
