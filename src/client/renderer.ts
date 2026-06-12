import type { ChallengePub } from '../shared/protocol';
import { game, phaseSecondsLeft } from './state';
import { sendPlay } from './net';
import { backdrop, txt, type GameView } from './games/common';
import { fireView } from './games/fireView';
import { fishView } from './games/fishView';
import { balanceView } from './games/balanceView';
import { climbView } from './games/climbView';
import { memoryView } from './games/memoryView';
import { idolView } from './games/idolView';
import { gatherView } from './games/gatherView';
import { hideTypeInput, typeView } from './games/typeView';
import { stampedeView } from './games/stampedeView';
import { shoveView } from './games/shoveView';
import { drawFx } from './fx';
import { sfx } from './audio';

const VIEWS: Record<ChallengePub['g'], GameView> = {
  fire: fireView,
  fish: fishView,
  balance: balanceView,
  climb: climbView,
  memory: memoryView,
  idol: idolView,
  gather: gatherView,
  type: typeView,
  stampede: stampedeView,
  shove: shoveView
};

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let lastCount = -1;
let vignette: HTMLCanvasElement | null = null;

function makeVignette(w: number, h: number): void {
  vignette = document.createElement('canvas');
  vignette.width = Math.max(2, Math.floor(w / 2));
  vignette.height = Math.max(2, Math.floor(h / 2));
  const vc = vignette.getContext('2d')!;
  const g = vc.createRadialGradient(
    vignette.width / 2,
    vignette.height / 2,
    Math.min(vignette.width, vignette.height) * 0.42,
    vignette.width / 2,
    vignette.height / 2,
    Math.max(vignette.width, vignette.height) * 0.78
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(5,10,20,0.42)');
  vc.fillStyle = g;
  vc.fillRect(0, 0, vignette.width, vignette.height);
}

export function initRenderer(c: HTMLCanvasElement): void {
  canvas = c;
  ctx = c.getContext('2d')!;
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    makeVignette(canvas.clientWidth, canvas.clientHeight);
  };
  resize();
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);

  const view = (): GameView | null =>
    game.phase === 'playing' && game.state ? (VIEWS[game.state.g] ?? null) : null;

  canvas.addEventListener('pointerdown', (e) => {
    const v = view();
    if (!v) return;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const msg = v.onPointer?.(rect.width, rect.height, e.clientX - rect.left, e.clientY - rect.top);
    if (msg) {
      sendPlay(msg);
      sfx.tap();
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const v = view();
    if (!v?.onPointerMove) return;
    const rect = canvas.getBoundingClientRect();
    v.onPointerMove(rect.width, rect.height, e.clientX - rect.left, e.clientY - rect.top);
  });
  for (const ev of ['pointerup', 'pointercancel'] as const) {
    canvas.addEventListener(ev, () => view()?.onPointerUp?.());
  }
  window.addEventListener('keydown', (e) => {
    const tgt = e.target as HTMLElement;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
    const v = view();
    if (!v) return;
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (key === ' ') e.preventDefault();
    const msg = v.onKey?.(key);
    if (msg) sendPlay(msg);
  });
  window.addEventListener('keyup', (e) => {
    view()?.onKeyUp?.(e.key.toLowerCase());
  });

  requestAnimationFrame(frame);
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  backdrop(ctx, w, h, now);

  if (!(game.phase === 'playing' && game.state?.g === 'type')) hideTypeInput();

  if (game.phase === 'playing' && game.state) {
    VIEWS[game.state.g]?.render(ctx, w, h, game.state, now);
  } else if (game.phase === 'countdown') {
    const left = Math.ceil(phaseSecondsLeft());
    if (left !== lastCount) {
      lastCount = left;
      if (left > 0) sfx.tick();
      if (left === 0) sfx.gong();
    }
    txt(ctx, game.card?.title ?? '', w / 2, h * 0.32, 34, '#ffd98a');
    const pulse = 1 + (phaseSecondsLeft() % 1) * 0.18;
    txt(ctx, left > 0 ? String(left) : 'GO!', w / 2, h * 0.5, 110 * pulse, '#fff3b0');
  }

  drawFx(ctx);
  if (vignette) ctx.drawImage(vignette, 0, 0, w, h);
}
