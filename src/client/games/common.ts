import { TRIBE_COLORS } from '../../shared/constants';
import type { PlayMsg } from '../../shared/protocol';

export interface GameView {
  render(ctx: CanvasRenderingContext2D, w: number, h: number, state: any, now: number): void;
  onPointer?(w: number, h: number, x: number, y: number): PlayMsg | null;
  onKey?(key: string): PlayMsg | null;
}

export const colorOf = (idx: number): string => TRIBE_COLORS[idx] ?? '#fff';

export function backdrop(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#ff9d4d');
  sky.addColorStop(0.35, '#e8645a');
  sky.addColorStop(0.62, '#7a4a7a');
  sky.addColorStop(1, '#152433');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // sun
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.3, Math.min(w, h) * 0.07, 0, Math.PI * 2);
  ctx.fill();
  // sea band
  const seaY = h * 0.62;
  const sea = ctx.createLinearGradient(0, seaY, 0, h);
  sea.addColorStop(0, '#2fb3a8aa');
  sea.addColorStop(1, '#10202e');
  ctx.fillStyle = sea;
  ctx.fillRect(0, seaY, w, h - seaY);
  ctx.strokeStyle = '#ffffff22';
  for (let i = 0; i < 4; i++) {
    const y = seaY + 12 + i * 16;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 24) {
      ctx.lineTo(x, y + Math.sin(now / 700 + x * 0.04 + i) * 2.5);
    }
    ctx.stroke();
  }
  // island silhouette
  ctx.fillStyle = '#101c28';
  ctx.beginPath();
  ctx.moveTo(-10, seaY + 4);
  ctx.quadraticCurveTo(w * 0.12, seaY - h * 0.07, w * 0.3, seaY + 4);
  ctx.fill();
  palm(ctx, w * 0.12, seaY + 4, h * 0.085, '#101c28');
}

export function palm(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size * 0.14;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + size * 0.35, y - size * 0.6, x + size * 0.25, y - size);
  ctx.stroke();
  const tx = x + size * 0.25;
  const ty = y - size;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * 0.95 + (i / 4) * Math.PI * 0.9;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(
      tx + Math.cos(a) * size * 0.55,
      ty + Math.sin(a) * size * 0.35 - size * 0.12,
      tx + Math.cos(a) * size * 0.8,
      ty + Math.sin(a) * size * 0.55
    );
    ctx.lineWidth = size * 0.09;
    ctx.stroke();
  }
}

export function txt(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color = '#f4ecd8',
  align: CanvasTextAlign = 'center',
  weight = 800
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

export function chip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIdx: number,
  name: string,
  size = 13
): void {
  ctx.fillStyle = colorOf(colorIdx);
  ctx.strokeStyle = '#0008';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  txt(ctx, name, x + size * 0.8, y, size, '#f4ecd8', 'left', 700);
}

// A little castaway: head, bandana, body. lean in radians.
export function castaway(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number, // feet
  s: number, // scale (height ~ 3.2s)
  colorIdx: number,
  lean = 0,
  armsUp = false
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  // body
  ctx.fillStyle = '#caa177';
  ctx.fillRect(-s * 0.5, -s * 2.1, s, s * 1.3);
  ctx.fillStyle = '#3a5a4a';
  ctx.fillRect(-s * 0.5, -s * 0.9, s, s * 0.9); // shorts
  // arms
  ctx.strokeStyle = '#caa177';
  ctx.lineWidth = s * 0.32;
  ctx.beginPath();
  if (armsUp) {
    ctx.moveTo(-s * 0.45, -s * 1.9);
    ctx.lineTo(-s * 0.95, -s * 2.8);
    ctx.moveTo(s * 0.45, -s * 1.9);
    ctx.lineTo(s * 0.95, -s * 2.8);
  } else {
    ctx.moveTo(-s * 0.45, -s * 1.9);
    ctx.lineTo(-s * 0.85, -s * 1.1);
    ctx.moveTo(s * 0.45, -s * 1.9);
    ctx.lineTo(s * 0.85, -s * 1.1);
  }
  ctx.stroke();
  // head + bandana
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(0, -s * 2.55, s * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colorOf(colorIdx);
  ctx.fillRect(-s * 0.58, -s * 3.0, s * 1.16, s * 0.42);
  ctx.restore();
}

export function flame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number): void {
  if (size <= 0) return;
  const fl = 1 + Math.sin(now / 90 + x) * 0.12;
  const grad = ctx.createRadialGradient(x, y - size * 0.4, size * 0.1, x, y - size * 0.4, size);
  grad.addColorStop(0, '#fff3b0');
  grad.addColorStop(0.45, '#ffb84d');
  grad.addColorStop(1, '#ff784600');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.5, y);
  ctx.quadraticCurveTo(x - size * 0.55, y - size * 0.7 * fl, x, y - size * 1.25 * fl);
  ctx.quadraticCurveTo(x + size * 0.55, y - size * 0.7 * fl, x + size * 0.5, y);
  ctx.fill();
}
