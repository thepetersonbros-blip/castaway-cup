import type { TypePub } from '../../shared/protocol';
import { game, nameOf, colorIdxOf } from '../state';
import { sendPlay } from '../net';
import { chip, txt, type GameView } from './common';
import { sfx } from '../audio';

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');

let inputEl: HTMLInputElement | null = null;
let currentWord = '';
let lastRound = -1;

function ensureInput(): HTMLInputElement {
  if (!inputEl) {
    inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.id = 'type-box';
    inputEl.placeholder = 'type it here!';
    inputEl.autocomplete = 'off';
    inputEl.autocapitalize = 'off';
    inputEl.spellcheck = false;
    inputEl.setAttribute('autocorrect', 'off');
    inputEl.setAttribute('enterkeyhint', 'go');
    Object.assign(inputEl.style, {
      position: 'fixed',
      left: '50%',
      bottom: 'calc(18% + env(safe-area-inset-bottom, 0px))',
      transform: 'translateX(-50%)',
      width: 'min(70vw, 380px)',
      fontSize: '22px',
      textAlign: 'center',
      padding: '12px',
      borderRadius: '12px',
      border: '3px solid #3a5a78',
      background: '#142433',
      color: '#f4ecd8',
      outline: 'none',
      zIndex: '20',
      display: 'none'
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(inputEl);
    inputEl.addEventListener('input', () => {
      if (!currentWord) return;
      if (norm(inputEl!.value) === norm(currentWord)) {
        sendPlay({ g: 'type', word: inputEl!.value });
        inputEl!.value = '';
        sfx.good();
      }
    });
  }
  return inputEl;
}

export function hideTypeInput(): void {
  if (inputEl) inputEl.style.display = 'none';
}

export const typeView: GameView = {
  render(ctx, w, h, state: TypePub, now) {
    currentWord = state.word;
    const me = state.players.find((p) => p.slot === game.you.slot);
    const el = ensureInput();

    if (state.round !== lastRound) {
      lastRound = state.round;
      el.value = '';
      sfx.gong();
    }

    const typing = state.mode === 'go' && !!me && !me.done;
    el.style.display = typing ? 'block' : 'none';
    if (typing && document.activeElement !== el && now % 1000 < 50) el.focus();

    txt(ctx, `BOTTLE ${state.round} OF ${state.rounds}`, w / 2, h * 0.08, 20, '#ffd98a');

    // bobbing bottles + the word on a driftwood plank
    const cy = h * 0.3;
    const bob = Math.sin(now / 480) * 6;
    txt(ctx, '🍾', w / 2 - Math.min(w * 0.34, 280), cy + bob, 34);
    txt(ctx, '🍾', w / 2 + Math.min(w * 0.34, 280), cy - bob, 34);
    if (state.mode === 'go') {
      const plankW = Math.min(w * 0.7, 60 + state.word.length * 30);
      const pg = ctx.createLinearGradient(0, cy - 42, 0, cy + 42);
      pg.addColorStop(0, '#8a6c4a');
      pg.addColorStop(0.5, '#6e5438');
      pg.addColorStop(1, '#54402a');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.roundRect(w / 2 - plankW / 2, cy - 40, plankW, 80, 14);
      ctx.fill();
      ctx.strokeStyle = '#3a2c1a';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff22';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(w / 2 - plankW / 2 + 5, cy - 35, plankW - 10, 70, 10);
      ctx.stroke();
      ctx.save();
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 10;
      txt(ctx, state.word.toUpperCase(), w / 2, cy, Math.min(50, (plankW - 30) / (state.word.length * 0.62)), '#ffe9b8');
      ctx.restore();
      if (me?.done) {
        txt(ctx, `sent! ${me.ms !== null ? (me.ms / 1000).toFixed(1) + 's' : ''} 🎉`, w / 2, cy + 50, 18, '#9fe8a8');
      }
    } else {
      txt(ctx, state.word.toUpperCase(), w / 2, cy, 30, '#9fb3bf');
      // round results
      const finished = state.players
        .filter((p) => p.ms !== null)
        .sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0));
      let y = cy + 44;
      txt(ctx, finished.length === 0 ? 'Nobody got it out! 🦗' : 'FASTEST THUMBS:', w / 2, y, 16, '#ffe8c8');
      y += 28;
      finished.slice(0, 6).forEach((p, i) => {
        const medal = ['🥇', '🥈', '🥉'][i] ?? '·';
        chip(ctx, w / 2 - 100, y, colorIdxOf(p.slot), `${medal} ${nameOf(p.slot)}`, 13.5);
        txt(ctx, `${((p.ms ?? 0) / 1000).toFixed(2)}s`, w / 2 + 70, y, 14, '#ffd98a', 'left');
        y += 25;
      });
    }

    // live done-marks during typing
    if (state.mode === 'go') {
      const racing = state.players;
      const per = Math.min(150, w / Math.max(1, racing.length));
      racing.forEach((p, i) => {
        const cx = w / 2 + (i - (racing.length - 1) / 2) * per;
        chip(ctx, cx - 34, h * 0.62, colorIdxOf(p.slot), nameOf(p.slot), 12.5);
        txt(ctx, p.done ? '✅' : '⌨…', cx, h * 0.62 + 19, 13);
      });
    }

    // running scores
    const per = Math.min(150, w / Math.max(1, state.players.length));
    state.players.forEach((p, i) => {
      const cx = w / 2 + (i - (state.players.length - 1) / 2) * per;
      chip(ctx, cx - 30, h * 0.9, colorIdxOf(p.slot), `${nameOf(p.slot)} ${p.score}`, 12.5);
    });
  },
  onPointer() {
    // tapping anywhere puts you back in the box (phones love losing focus)
    if (inputEl && inputEl.style.display !== 'none') inputEl.focus();
    return null;
  }
};
