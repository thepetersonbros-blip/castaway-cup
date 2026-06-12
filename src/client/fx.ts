// Tiny particle system shared by every game view. Purely cosmetic.

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
}

const parts: P[] = [];
const CAP = 280;

export function burst(
  x: number,
  y: number,
  o: {
    n?: number;
    colors: string[];
    speed?: number;
    size?: number;
    life?: number;
    grav?: number;
    up?: boolean; // bias upward (embers, sparks)
  }
): void {
  const n = o.n ?? 10;
  for (let i = 0; i < n; i++) {
    if (parts.length >= CAP) parts.shift();
    const a = o.up ? -Math.PI / 2 + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2;
    const sp = (o.speed ?? 2) * (0.35 + Math.random() * 0.85);
    const life = Math.round((o.life ?? 36) * (0.6 + Math.random() * 0.8));
    parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life,
      max: life,
      size: (o.size ?? 3) * (0.6 + Math.random() * 0.9),
      color: o.colors[Math.floor(Math.random() * o.colors.length)],
      grav: o.grav ?? 0.06
    });
  }
}

export function drawFx(ctx: CanvasRenderingContext2D): void {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life--;
    if (p.life <= 0) {
      parts.splice(i, 1);
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.grav;
    p.vx *= 0.985;
    const a = p.life / p.max;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function clearFx(): void {
  parts.length = 0;
}
