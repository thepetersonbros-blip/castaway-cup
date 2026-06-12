import { MIN_PLAYERS, TRIBE_COLORS } from '../shared/constants';
import { colorIdxOf, game, nameOf, phaseSecondsLeft } from './state';
import { connect, sendLobby } from './net';
import { sfx } from './audio';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let join: HTMLElement;
let lobby: HTMLElement;
let intro: HTMLElement;
let results: HTMLElement;
let standings: HTMLElement;
let final: HTMLElement;
let curtain: HTMLElement;
let topbar: HTMLElement;
let pickedColor = 0;
let lastPhase = '';

function el(cls: string, id: string): HTMLElement {
  const e = document.createElement('div');
  e.className = cls;
  e.id = id;
  return e;
}

export function initUi(): void {
  const ui = document.getElementById('ui')!;
  join = el('screen', 'scr-join');
  lobby = el('screen', 'scr-lobby');
  intro = el('overlay', 'scr-intro');
  results = el('overlay', 'scr-results');
  standings = el('overlay', 'scr-standings');
  final = el('overlay', 'scr-final');
  curtain = el('', 'curtain');
  topbar = el('', 'topbar');
  topbar.id = 'topbar';
  ui.append(join, lobby, intro, results, standings, final, topbar, curtain);
  pickedColor = Number(localStorage.getItem('cc.color') ?? 0) || 0;
  renderJoin();
  setInterval(tickTimers, 250);
}

const colorDots = (sel: number, taken: Set<number>, idAttr: string) =>
  TRIBE_COLORS.map(
    (c, i) =>
      `<div class="hat ${i === sel ? 'sel' : ''} ${taken.has(i) ? 'taken' : ''}" data-${idAttr}="${i}" style="background:${c}"></div>`
  ).join('');

function renderJoin(): void {
  const url = new URL(location.href);
  const prefill = (url.searchParams.get('room') ?? localStorage.getItem('cc.lastRoom') ?? '').toUpperCase();
  const name = localStorage.getItem('cc.name') ?? '';
  join.innerHTML = `
    <div class="title">🏝 CASTAWAY CUP</div>
    <div class="subtitle">Six wash ashore. One rules the island.</div>
    <div class="card">
      <input type="text" id="j-name" placeholder="Your name" maxlength="14" value="${esc(name)}" />
      <div class="hint">Pick your bandana:</div>
      <div class="hats" id="j-colors">${colorDots(pickedColor, new Set(), 'c')}</div>
      <button id="j-create">⛺ Start a new island</button>
      <div class="row">
        <input type="text" id="j-code" class="code" placeholder="CODE" maxlength="4" style="flex:1" value="${esc(prefill)}" />
        <button id="j-join" class="secondary">Join</button>
      </div>
      <div class="err" id="j-err">${errText()}</div>
      <div class="hint">A game-show night for 6 friends: seven quick challenges, points for every finish,
      one Island Champion. Phones and computers both work.</div>
    </div>`;
  join.querySelectorAll('[data-c]').forEach((d) =>
    d.addEventListener('click', () => {
      pickedColor = Number((d as HTMLElement).dataset.c);
      localStorage.setItem('cc.color', String(pickedColor));
      join.querySelectorAll('[data-c]').forEach((x) => x.classList.remove('sel'));
      d.classList.add('sel');
    })
  );
  const nameInput = join.querySelector('#j-name') as HTMLInputElement;
  const codeInput = join.querySelector('#j-code') as HTMLInputElement;
  const getName = () => {
    const n = nameInput.value.trim();
    if (!n) {
      (join.querySelector('#j-err') as HTMLElement).textContent = 'Pick a name first!';
      return null;
    }
    localStorage.setItem('cc.name', n);
    return n;
  };
  join.querySelector('#j-create')?.addEventListener('click', () => {
    const n = getName();
    if (n) connect({ create: true, name: n, color: pickedColor });
  });
  const doJoin = () => {
    const n = getName();
    const code = codeInput.value.trim().toUpperCase();
    if (n && code.length === 4) connect({ room: code, name: n, color: pickedColor });
  };
  join.querySelector('#j-join')?.addEventListener('click', doJoin);
  codeInput.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') doJoin();
  });
}

function errText(): string {
  switch (game.errCode) {
    case 'room-not-found':
      return 'No island with that code (or the server was napping). Start a new one!';
    case 'room-full':
      return 'That island is packed.';
    case 'bad-name':
      return 'Try a different name.';
    case 'bad-version':
      return 'Old version cached. Hard-refresh (Ctrl+Shift+R).';
    case 'lost':
      return 'Lost the connection for good. Reload the page.';
    default:
      return '';
  }
}

function renderLobby(): void {
  const me = game.roster.find((r) => r.slot === game.you.slot);
  const isHost = !!me?.isHost;
  const n = game.roster.filter((r) => r.connected).length;
  const taken = new Set(game.roster.filter((r) => r.slot !== game.you.slot).map((r) => r.color));
  lobby.innerHTML = `
    <div class="title" style="font-size:32px">THE TRIBE GATHERS</div>
    <div class="card">
      <div class="hint" style="text-align:center">Castaways join with the code:</div>
      <div class="codebig">${game.code}</div>
      <button id="l-copy" class="secondary">📋 Copy invite link</button>
      <div class="roster">
        ${game.roster
          .map(
            (r) => `<div class="p">
              <div class="chip" style="background:${TRIBE_COLORS[r.color]}"></div>
              <div class="nm">${esc(r.name)} ${r.isHost ? '⭐' : ''}</div>
              <div class="tag">${r.connected ? (r.slot === game.you.slot ? 'you' : 'ready') : 'gone'}</div>
            </div>`
          )
          .join('')}
      </div>
      <div class="hint">Bandana:</div>
      <div class="hats" id="l-colors">${colorDots(me?.color ?? 0, taken, 'c')}</div>
      ${
        isHost
          ? `<button id="l-start" ${n < MIN_PLAYERS ? 'disabled' : ''}>🔥 Light the torches (${n} castaways)</button>
             <div class="hint" style="text-align:center">Seven challenges. Points every game. Most points takes the Cup.</div>`
          : `<div class="hint" style="text-align:center">Waiting for the host to light the torches...</div>`
      }
    </div>`;
  lobby.querySelector('#l-copy')?.addEventListener('click', () => {
    void navigator.clipboard?.writeText(`${location.origin}${location.pathname}?room=${game.code}`);
    (lobby.querySelector('#l-copy') as HTMLElement).textContent = '✓ Copied!';
  });
  lobby.querySelector('#l-start')?.addEventListener('click', () => sendLobby({ type: 'start' }));
  lobby.querySelectorAll('[data-c]').forEach((d) =>
    d.addEventListener('click', () => {
      const c = Number((d as HTMLElement).dataset.c);
      if (!taken.has(c)) sendLobby({ type: 'color', color: c });
    })
  );
}

function renderIntro(): void {
  const c = game.card;
  if (!c) return;
  intro.innerHTML = `
    <div class="gamecard">
      <div class="which">CHALLENGE ${c.index} OF ${c.total}</div>
      <div class="gt">${esc(c.title)}</div>
      <div class="tag2">${esc(c.tagline)}</div>
      <div class="how">${esc(c.howTo)}</div>
      <div class="hint" style="margin-top:12px" id="intro-timer"></div>
    </div>`;
}

function renderResults(): void {
  const r = game.results;
  if (!r) return;
  results.innerHTML = `
    <div class="bigbanner" style="color:var(--sun)">${esc(r.card.title)} — RESULTS</div>
    <table class="res">
      <tr><th></th><th>castaway</th><th>result</th><th>points</th></tr>
      ${r.rows
        .map(
          (row) => `<tr class="${row.slot === game.you.slot ? 'me' : ''}">
            <td>${row.place === 1 ? '🥇' : row.place === 2 ? '🥈' : row.place === 3 ? '🥉' : row.place}</td>
            <td class="nm"><span class="chip" style="display:inline-block;width:13px;height:13px;background:${TRIBE_COLORS[colorIdxOf(row.slot)]}"></span> ${esc(nameOf(row.slot))}</td>
            <td>${esc(row.display)}</td>
            <td class="pts">+${row.pts}</td>
          </tr>`
        )
        .join('')}
    </table>`;
}

function renderStandings(target: HTMLElement, headline: string, sub: string): void {
  const max = Math.max(1, ...game.totals.map((t) => t.total));
  target.innerHTML = `
    <div class="bigbanner" style="color:var(--sun)">${headline}</div>
    ${sub ? `<div class="hint" style="font-size:15px">${sub}</div>` : ''}
    <div style="display:flex;flex-direction:column;gap:8px;width:min(520px,92vw)">
      ${game.totals
        .map(
          (t, i) => `<div class="torchrow">
            <div class="nm">${i === 0 && t.total > 0 ? '🔥 ' : ''}${esc(nameOf(t.slot))}</div>
            <div class="torchbar"><div style="width:0%;background:${TRIBE_COLORS[colorIdxOf(t.slot)]}" data-w="${Math.max(4, (t.total / max) * 100)}">${t.total}</div></div>
          </div>`
        )
        .join('')}
    </div>`;
  requestAnimationFrame(() => {
    target.querySelectorAll('.torchbar > div').forEach((b) => {
      (b as HTMLElement).style.width = `${(b as HTMLElement).dataset.w}%`;
    });
  });
}

function renderFinal(): void {
  const f = game.final;
  if (!f) return;
  const isHost = game.roster.find((r) => r.slot === game.you.slot)?.isHost;
  const champs = f.champions.map((s) => nameOf(s)).join(' & ');
  renderStandings(final, '🏆 ISLAND CHAMPION', '');
  final.insertAdjacentHTML(
    'afterbegin',
    `<div class="crown">👑</div><div class="bigbanner" style="color:var(--sun)">${esc(champs)}</div>`
  );
  final.insertAdjacentHTML(
    'beforeend',
    isHost
      ? `<button id="f-again" style="margin-top:10px">🌅 New season (fresh scores)</button>`
      : `<div class="hint">The host can start a new season.</div>`
  );
  final.querySelector('#f-again')?.addEventListener('click', () => sendLobby({ type: 'again' }));
}

function renderCurtain(): void {
  if (game.connState === 'connecting') {
    curtain.innerHTML = `<div class="spin"></div><div><b>Rowing to the island...</b></div>
      <div class="hint">Free servers nap. First wake-up can take a minute.</div>`;
    curtain.classList.add('on');
  } else if (game.connState === 'reconnecting') {
    curtain.innerHTML = `<div class="spin"></div><div><b>Reconnecting...</b></div>`;
    curtain.classList.add('on');
  } else if (game.connState === 'failed') {
    curtain.innerHTML = `<div><b>${errText() || 'Connection failed.'}</b></div><button id="c-back">Back to shore</button>`;
    curtain.classList.add('on');
    curtain.querySelector('#c-back')?.addEventListener('click', () => {
      game.connState = 'boot';
      game.errCode = '';
      route();
    });
  } else {
    curtain.classList.remove('on');
  }
}

function tickTimers(): void {
  const t = document.getElementById('intro-timer');
  if (t && game.phase === 'intro') t.textContent = `starting in ${Math.ceil(phaseSecondsLeft())}...`;
  if (topbar.classList.contains('on') && game.state) {
    const secs =
      'left' in game.state && typeof (game.state as any).left === 'number'
        ? Math.ceil(((game.state as any).left as number) / 20)
        : null;
    topbar.innerHTML = `<span>${game.card?.title ?? ''}</span>${secs !== null ? `<span class="t">${secs}s</span>` : ''}`;
  }
}

export function route(): void {
  const show = (e: HTMLElement, on: boolean) => (e.style.display = on ? 'flex' : 'none');
  const on = game.connState === 'on';
  show(join, game.connState === 'boot' || game.connState === 'failed');
  if (game.connState === 'boot') renderJoin();
  show(lobby, on && game.phase === 'lobby');
  if (on && game.phase === 'lobby') renderLobby();
  show(intro, on && game.phase === 'intro');
  if (on && game.phase === 'intro') renderIntro();
  show(results, on && game.phase === 'results');
  if (on && game.phase === 'results') renderResults();
  show(standings, on && game.phase === 'standings');
  if (on && game.phase === 'standings') renderStandings(standings, '🔥 THE TORCH COUNT', 'next challenge coming up...');
  show(final, on && game.phase === 'final');
  if (on && game.phase === 'final') renderFinal();
  topbar.classList.toggle('on', on && game.phase === 'playing');
  renderCurtain();

  if (game.phase !== lastPhase) {
    if (game.phase === 'results') sfx.cheer();
    if (game.phase === 'final') sfx.cheer();
    lastPhase = game.phase;
  }
}
