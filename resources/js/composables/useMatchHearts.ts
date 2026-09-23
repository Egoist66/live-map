import { onBeforeUnmount, type Ref } from 'vue'

/**
 * Настройки сплеша сердец при мэтче.
 */
export interface MatchHeartsOptions {
  /** Сколько сердец в залпе из центра (по умолчанию 90). */
  burstCount?: number
  /** Фоновая стая взлетающих сердец, пока сплеш открыт (по умолчанию true). */
  ambient?: boolean
}

/**
 * Частица сердца на canvas.
 */
interface HeartParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  age: number
  ttl: number
  rotation: number
  spin: number
  swayPhase: number
  swayAmp: number
  swaySpeed: number
  color: string
  baseAlpha: number
  ring: boolean
}

const PALETTE = ['#f43f5e', '#ec4899', '#fb7185', '#fb923c', '#fbbf24', '#ffffff']

const MAX_PARTICLES = 160

/**
 * Контур сердца с центром около (0, 0), смотрит вниз.
 *
 * @param ctx контекст canvas
 * @param size условный радиус сердца
 */
function traceHeart(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.beginPath()
  ctx.moveTo(0, -0.35 * size)
  ctx.bezierCurveTo(0.5 * size, -0.9 * size, 1.0 * size, -0.1 * size, 0, 0.55 * size)
  ctx.bezierCurveTo(-1.0 * size, -0.1 * size, -0.5 * size, -0.9 * size, 0, -0.35 * size)
  ctx.closePath()
}

/**
 * Случайный элемент палитры.
 */
function pickColor(): string {
  const index = Math.floor(Math.random() * PALETTE.length)
  return PALETTE[index] ?? '#f43f5e'
}

/**
 * Прозрачность частицы по возрасту: быстрое появление, долгое затухание.
 */
function alphaFor(age: number, ttl: number, base: number): number {
  const born = Math.min(age / (ttl * 0.15), 1)
  const dying = Math.min(Math.max((ttl - age) / (ttl * 0.4), 0), 1)
  return base * Math.min(born, dying)
}

/**
 * Canvas-движок сплеша сердец для экрана мэтча.
 *
 * Залп из центра + расходящиеся кольца-контуры + фоновая стая
 * взлетающих сердец, пока сплеш открыт. Без зависимостей,
 * один rAF-цикл, DPR-aware. При `prefers-reduced-motion` —
 * короткий тихий залп без стаи и вращений.
 *
 * @param canvasRef canvas, на котором рисовать
 * @param options размер залпа и фоновая стая
 * @returns `play()` — запустить залп, `stop()` — остановить и очистить
 * @example
 * const canvasRef = ref<HTMLCanvasElement | null>(null)
 * const hearts = useMatchHearts(canvasRef)
 * watch(active, (v) => { v ? hearts.play() : hearts.stop() })
 */
export function useMatchHearts(canvasRef: Ref<HTMLCanvasElement | null>, options: MatchHeartsOptions = {}) {
  const burstCount = options.burstCount ?? 90
  const ambientEnabled = options.ambient ?? true

  let rafId = 0
  let running = false
  let lastAt = 0
  let ambientAt = 0
  let particles: HeartParticle[] = []
  let ctx: CanvasRenderingContext2D | null = null

  /**
   * Уважает настройку ОС «уменьшить движение».
   */
  function reducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  /**
   * Подгоняет canvas под окно с учётом DPR.
   */
  function fitCanvas(): void {
    const canvas = canvasRef.value
    if (!canvas) {
      return
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx = canvas.getContext('2d')
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function onResize(): void {
    fitCanvas()
  }

  /**
   * Залп сердец из центра экрана с разлётом во все стороны.
   */
  function burst(): void {
    const quiet = reducedMotion()
    const count = quiet ? 24 : burstCount
    const cx = window.innerWidth / 2
    const cy = window.innerHeight * 0.42
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 5.5
      const ttl = 1400 + Math.random() * 1100
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.2,
        size: 7 + Math.random() * 17,
        age: 0,
        ttl,
        rotation: Math.random() * Math.PI * 2,
        spin: quiet ? 0 : (Math.random() - 0.5) * 0.12,
        swayPhase: Math.random() * Math.PI * 2,
        swayAmp: quiet ? 0 : 0.6 + Math.random() * 1.2,
        swaySpeed: 0.002 + Math.random() * 0.004,
        color: pickColor(),
        baseAlpha: 0.85 + Math.random() * 0.15,
        ring: false,
      })
    }
    pushRings(cx, cy)
  }

  /**
   * Три расходящихся кольца-контура следом за залпом.
   */
  function pushRings(cx: number, cy: number): void {
    for (let i = 0; i < 3; i += 1) {
      particles.push({
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        size: 18 + i * 26,
        age: -i * 160,
        ttl: 1100,
        rotation: 0,
        spin: 0,
        swayPhase: 0,
        swayAmp: 0,
        swaySpeed: 0,
        color: '#fb7185',
        baseAlpha: 0.55,
        ring: true,
      })
    }
  }

  /**
   * Одно фоновое сердце снизу вверх.
   */
  function spawnAmbient(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    particles.push({
      x: Math.random() * width,
      y: height + 24,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(0.7 + Math.random() * 1.1),
      size: 6 + Math.random() * 12,
      age: 0,
      ttl: 3200 + Math.random() * 1800,
      rotation: (Math.random() - 0.5) * 0.6,
      spin: (Math.random() - 0.5) * 0.01,
      swayPhase: Math.random() * Math.PI * 2,
      swayAmp: 0.5 + Math.random(),
      swaySpeed: 0.001 + Math.random() * 0.002,
      color: pickColor(),
      baseAlpha: 0.35 + Math.random() * 0.3,
      ring: false,
    })
  }

  function stepParticle(p: HeartParticle, dt: number): void {
    p.age += dt
    if (p.ring) {
      return
    }
    p.vy += 0.028 * (dt / 16.7)
    p.vx *= 0.986
    p.vy *= 0.992
    p.x += p.vx * (dt / 16.7) + Math.sin(p.age * p.swaySpeed + p.swayPhase) * p.swayAmp
    p.y += p.vy * (dt / 16.7)
    p.rotation += p.spin * (dt / 16.7)
  }

  function drawParticle(p: HeartParticle): void {
    if (!ctx || p.age < 0) {
      return
    }
    const alpha = alphaFor(p.age, p.ttl, p.baseAlpha)
    if (alpha <= 0.01) {
      return
    }
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)
    ctx.globalAlpha = alpha
    if (p.ring) {
      const grown = p.size + (p.age / p.ttl) * 130
      traceHeart(ctx, grown)
      ctx.lineWidth = 3
      ctx.strokeStyle = p.color
      ctx.stroke()
    } else {
      traceHeart(ctx, p.size)
      ctx.fillStyle = p.color
      ctx.fill()
    }
    ctx.restore()
  }

  function frame(now: number): void {
    if (!running) {
      return
    }
    const dt = Math.min(now - lastAt || 16.7, 50)
    lastAt = now
    if (ambientEnabled && !reducedMotion() && now - ambientAt > 130 && particles.length < MAX_PARTICLES) {
      ambientAt = now
      spawnAmbient()
    }
    particles.forEach((p) => stepParticle(p, dt))
    particles = particles.filter((p) => p.age < p.ttl)
    ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight)
    particles.forEach(drawParticle)
    rafId = requestAnimationFrame(frame)
  }

  /**
   * Запустить сплеш: залп из центра + цикл анимации.
   * На телефоне добавляет лёгкий вибро-акцент (если разрешён).
   */
  function play(): void {
    const canvas = canvasRef.value
    if (!canvas || typeof window === 'undefined') {
      return
    }
    fitCanvas()
    particles = []
    burst()
    try {
      navigator.vibrate?.([40, 60, 40])
    } catch { /* noop */ }
    if (running) {
      return
    }
    running = true
    lastAt = performance.now()
    ambientAt = lastAt
    window.addEventListener('resize', onResize)
    rafId = requestAnimationFrame(frame)
  }

  /**
   * Остановить цикл, снять слушатели и очистить canvas.
   */
  function stop(): void {
    running = false
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', onResize)
    }
    particles = []
    ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight)
  }

  onBeforeUnmount(stop)

  return { play, stop }
}
