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
import { sfx } from './audio';

const VIEWS: Record<ChallengePub['g'], GameView> = {
  fire: fireView,
  fish: fishView,
  balance: balanceView,
  climb: climbView,
  memory: memoryView,
  idol: idolView
};

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let lastCount = -1;

export function initRenderer(c: HTMLCanvasElement): void {
  canvas = c;
  ctx = c.getContext('2d')!;
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  };
  resize();
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);

  canvas.addEventListener('pointerdown', (e) => {
    if (game.phase !== 'playing' || !game.state) return;
    const view = VIEWS[game.state.g];
    const rect = canvas.getBoundingClientRect();
    const msg = view.onPointer?.(rect.width, rect.height, e.clientX - rect.left, e.clientY - rect.top);
    if (msg) {
      sendPlay(msg);
      sfx.tap();
    }
  });
  window.addEventListener('keydown', (e) => {
    const tgt = e.target as HTMLElement;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
    if (game.phase !== 'playing' || !game.state) return;
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (key === ' ') e.preventDefault();
    const msg = VIEWS[game.state.g].onKey?.(key);
    if (msg) sendPlay(msg);
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

  if (game.phase === 'playing' && game.state) {
    VIEWS[game.state.g].render(ctx, w, h, game.state, now);
  } else if (game.phase === 'countdown') {
    const left = Math.ceil(phaseSecondsLeft());
    if (left !== lastCount) {
      lastCount = left;
      if (left > 0) sfx.tick();
      if (left === 0) sfx.gong();
    }
    txt(ctx, game.card?.title ?? '', w / 2, h * 0.32, 34, '#ffd98a');
    txt(ctx, left > 0 ? String(left) : 'GO!', w / 2, h * 0.5, 110, '#fff3b0');
  }
}
