import { game, onUpdate } from './state';
import { connect } from './net';
import { initRenderer } from './renderer';
import { initUi, route } from './ui';
import { unlock } from './audio';

function boot(): void {
  initUi();
  initRenderer(document.getElementById('game') as HTMLCanvasElement);
  onUpdate(route);
  route();

  const tryUnlock = () => unlock();
  window.addEventListener('pointerdown', tryUnlock);
  window.addEventListener('keydown', tryUnlock);

  // iOS niceties
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  const tryWakeLock = async () => {
    try {
      await (navigator as any).wakeLock?.request('screen');
    } catch {
      /* fine */
    }
  };
  void tryWakeLock();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void tryWakeLock();
  });

  // refreshed mid-season? hop back in
  const room = new URL(location.href).searchParams.get('room')?.toUpperCase();
  const name = localStorage.getItem('cc.name');
  if (room && name && localStorage.getItem(`cc.token.${room}`)) {
    connect({ room, name, color: Number(localStorage.getItem('cc.color') ?? 0) || 0 });
  }

  (window as unknown as { __game: typeof game }).__game = game;
}

boot();
