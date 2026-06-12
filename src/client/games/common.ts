import { TRIBE_COLORS } from '../../shared/constants';
import type { PlayMsg } from '../../shared/protocol';

export interface GameView {
  render(ctx: CanvasRenderingContext2D, w: number, h: number, state: any, now: number): void;
  onPointer?(w: number, h: number, x: number, y: number): PlayMsg | null;
  onPointerMove?(w: number, h: number, x: number, y: number): void;
  onPointerUp?(): void;
  onKey?(key: string): PlayMsg | null;
  onKeyUp?(key: string): void;
}

export const colorOf = (idx: number): string => TRIBE_COLORS[idx] ?? '#fff';

// Soft radial glow: the cheap trick that makes everything look lit.
export function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha = 0.4
): void {
  const g = ctx.createRadialGradient(x, y, r * 0.05, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color + '00');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

export function shadowEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha = 0.22
): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

const h2 = (i: number) => {
  let h = (i * 374761393 + 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function backdrop(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
  // layered sunset sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#ffb35e');
  sky.addColorStop(0.22, '#ff8b55');
  sky.addColorStop(0.42, '#d95f70');
  sky.addColorStop(0.62, '#7a4a7a');
  sky.addColorStop(1, '#13202e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const sunX = w * 0.78;
  const sunY = h * 0.3;
  const sunR = Math.min(w, h) * 0.07;
  glow(ctx, sunX, sunY, sunR * 4.2, '#ffce7a', 0.5);
  const sg = ctx.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, sunR);
  sg.addColorStop(0, '#fff3c8');
  sg.addColorStop(1, '#ffce6e');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // drifting clouds, lit from below
  for (let i = 0; i < 3; i++) {
    const cw = w * (0.16 + 0.1 * h2(i));
    const cx = ((now / (90 + i * 35) + i * 500) % (w + cw * 2)) - cw;
    const cy = h * (0.12 + 0.1 * h2(i + 9));
    ctx.fillStyle = i === 1 ? '#ffd9b066' : '#ffc0a055';
    for (let b = 0; b < 4; b++) {
      ctx.beginPath();
      ctx.ellipse(
        cx + b * cw * 0.22,
        cy + Math.sin(b * 2.1 + i) * cw * 0.03,
        cw * (0.18 - b * 0.02),
        cw * 0.07,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  // birds heading home
  ctx.strokeStyle = '#3a2a3a';
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 2; i++) {
    const bx = ((now / (28 + i * 9) + i * 700) % (w + 60)) - 30;
    const by = h * (0.18 + i * 0.06) + Math.sin(now / 400 + i * 3) * 6;
    const flap = Math.sin(now / 130 + i) * 3.5;
    ctx.beginPath();
    ctx.moveTo(bx - 6, by - flap);
    ctx.quadraticCurveTo(bx, by + 2, bx + 6, by - flap);
    ctx.stroke();
  }

  // sea: depth gradient + sun glitter + parallax waves + foam
  const seaY = h * 0.62;
  const sea = ctx.createLinearGradient(0, seaY, 0, h);
  sea.addColorStop(0, '#3fc0b0');
  sea.addColorStop(0.4, '#1e7d85');
  sea.addColorStop(1, '#0c1a26');
  ctx.fillStyle = sea;
  ctx.fillRect(0, seaY, w, h - seaY);
  // glitter path under the sun
  for (let i = 0; i < 22; i++) {
    const gy = seaY + 6 + i * ((h - seaY) / 26);
    const jitter = Math.sin(now / 300 + i * 2.7) * (6 + i);
    const gw = 8 + h2(i + 40) * 26 + i * 1.5;
    ctx.fillStyle = `rgba(255,222,150,${0.22 - i * 0.008})`;
    ctx.fillRect(sunX - gw / 2 + jitter, gy, gw, 2);
  }
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.16 - i * 0.03})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 22) {
      ctx.lineTo(x, seaY + 12 + i * 17 + Math.sin(now / (600 + i * 120) + x * 0.035 + i * 2) * 3);
    }
    ctx.stroke();
  }

  // far island, then near island with swaying palms
  ctx.fillStyle = '#2a3548aa';
  ctx.beginPath();
  ctx.moveTo(w * 0.52, seaY + 2);
  ctx.quadraticCurveTo(w * 0.6, seaY - h * 0.035, w * 0.68, seaY + 2);
  ctx.fill();
  ctx.fillStyle = '#0e1824';
  ctx.beginPath();
  ctx.moveTo(-10, seaY + 4);
  ctx.quadraticCurveTo(w * 0.12, seaY - h * 0.075, w * 0.32, seaY + 4);
  ctx.fill();
  const sway = Math.sin(now / 1100) * 0.03;
  ctx.save();
  ctx.translate(w * 0.12, seaY + 4);
  ctx.rotate(sway);
  palm(ctx, 0, 0, h * 0.085, '#0e1824');
  ctx.restore();
  ctx.save();
  ctx.translate(w * 0.2, seaY + 2);
  ctx.rotate(-sway * 0.7);
  palm(ctx, 0, 0, h * 0.055, '#0e1824');
  ctx.restore();
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
  const c = colorOf(colorIdx);
  const g = ctx.createRadialGradient(x - size * 0.2, y - size * 0.2, size * 0.1, x, y, size * 0.6);
  g.addColorStop(0, '#ffffffcc');
  g.addColorStop(0.35, c);
  g.addColorStop(1, c);
  ctx.fillStyle = g;
  ctx.strokeStyle = '#0008';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  txt(ctx, name, x + size * 0.8, y, size, '#f4ecd8', 'left', 700);
}

// A little castaway with shading and a face. lean in radians.
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
  // body with a lit edge
  const bg = ctx.createLinearGradient(-s * 0.5, 0, s * 0.5, 0);
  bg.addColorStop(0, '#dfb285');
  bg.addColorStop(1, '#b08a60');
  ctx.fillStyle = bg;
  ctx.fillRect(-s * 0.5, -s * 2.1, s, s * 1.3);
  const sg = ctx.createLinearGradient(-s * 0.5, 0, s * 0.5, 0);
  sg.addColorStop(0, '#46705a');
  sg.addColorStop(1, '#2e4a3c');
  ctx.fillStyle = sg;
  ctx.fillRect(-s * 0.5, -s * 0.9, s, s * 0.9); // shorts
  // arms
  ctx.strokeStyle = '#caa177';
  ctx.lineCap = 'round';
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
  // head + face + bandana with knot
  const hg = ctx.createRadialGradient(-s * 0.15, -s * 2.7, s * 0.1, 0, -s * 2.55, s * 0.6);
  hg.addColorStop(0, '#f2cb9e');
  hg.addColorStop(1, '#d9a172');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, -s * 2.55, s * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#10202e';
  ctx.beginPath();
  ctx.arc(-s * 0.18, -s * 2.52, s * 0.06, 0, Math.PI * 2);
  ctx.arc(s * 0.18, -s * 2.52, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  const c = colorOf(colorIdx);
  ctx.fillStyle = c;
  ctx.fillRect(-s * 0.58, -s * 3.0, s * 1.16, s * 0.42);
  ctx.beginPath();
  ctx.arc(s * 0.58, -s * 2.82, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function flame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number): void {
  if (size <= 0) return;
  glow(ctx, x, y - size * 0.45, size * 1.7, '#ff8c46', Math.min(0.5, size / 60));
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
  // inner tongue
  ctx.fillStyle = '#fff8d8cc';
  ctx.beginPath();
  ctx.moveTo(x - size * 0.18, y);
  ctx.quadraticCurveTo(x - size * 0.2, y - size * 0.4 * fl, x, y - size * 0.62 * fl);
  ctx.quadraticCurveTo(x + size * 0.2, y - size * 0.4 * fl, x + size * 0.18, y);
  ctx.fill();
}
