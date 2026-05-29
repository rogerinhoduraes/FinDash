import { useEffect, useRef, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAccounts } from '@/hooks/useAccounts'
import { useInvestments } from '@/hooks/useInvestments'

/* ─── Vertex shader ─────────────────────────────────────────── */
const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

/* ─── Fragment shader ───────────────────────────────────────── */
const FRAG = `
precision mediump float;

uniform float uTime;
uniform float uWarmth;
uniform float uVitality;
uniform vec2  uResolution;
uniform float uDark;

/* 2D simplex noise -------------------------------------------- */
vec3 permute3(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1  = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy  -= i1;
  i = mod(i, 289.0);
  vec3 p = permute3(permute3(i.y + vec3(0.0, i1.y, 1.0))
                             + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                           dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

/* Fractal Brownian Motion ------------------------------------- */
float fbm(vec2 p) {
  float v   = 0.0;
  float amp = 0.5;
  mat2  rot = mat2(0.8776, 0.4794, -0.4794, 0.8776); /* ~28.8 deg */
  for (int i = 0; i < 4; i++) {
    v   += amp * snoise(p);
    p    = rot * p * 2.1 + vec2(100.0);
    amp *= 0.48;
  }
  return v;
}

void main() {
  vec2  uv = gl_FragCoord.xy / uResolution;
  float ar = uResolution.x / uResolution.y;

  /* Base coordinate space — large blobs, slow drift */
  vec2 p = (uv - 0.5) * vec2(ar, 1.0) * 1.6;
  float t = uTime * 0.048;

  /* Domain warp: feed one FBM into the coords of another for
     organic, cloudy shapes rather than uniform noise texture   */
  vec2 q = vec2(
    fbm(p + vec2(0.0,  t)),
    fbm(p + vec2(5.23, t + 1.3))
  );
  float f = fbm(p + 1.6 * q + vec2(1.72 + t * 0.12, 9.2 + t * 0.09));
  f = clamp(f * 0.5 + 0.5, 0.0, 1.0);

  vec3 color;

  if (uDark > 0.5) {
    /* Dark mode —————————————————————————————————————————————
       base:      #0a0a0b, almost-black neutral
       vitColor:  deep indigo-violet (Nubank heritage at darkness)
       warmColor: burnt amber (financial stress warning)        */
    vec3 base      = vec3(0.0392, 0.0392, 0.0431);
    vec3 vitColor  = vec3(0.1050, 0.0620, 0.2250);
    vec3 warmColor = vec3(0.2050, 0.0980, 0.0350);

    vec3  hue      = mix(vitColor, warmColor, uWarmth);
    float strength = f * clamp(uVitality * 0.78 + 0.18, 0.18, 0.96);
    color          = mix(base, hue, strength);
  } else {
    /* Light mode ————————————————————————————————————————————
       base:      #f5f5f3
       vitColor:  faint lavender wash
       warmColor: faint warm sand wash                         */
    vec3 base      = vec3(0.9608, 0.9608, 0.9490);
    vec3 vitColor  = vec3(0.9300, 0.9240, 0.9780);
    vec3 warmColor = vec3(0.9840, 0.9460, 0.9040);

    vec3  hue      = mix(vitColor, warmColor, uWarmth);
    float strength = f * clamp(uVitality * 0.60 + 0.30, 0.30, 0.90) * 0.50;
    color          = mix(base, hue, strength);
  }

  gl_FragColor = vec4(color, 1.0);
}
`

/* ─── Component ─────────────────────────────────────────────── */
export function AmbientPresence() {
  const canvasRef = useRef(null)
  const glRef     = useRef(null)
  const uRef      = useRef(null)             /* uniform locations  */
  const animRef   = useRef(null)
  const curRef    = useRef({ warmth: 0.0, vitality: 0.45 })
  const tgtRef    = useRef({ warmth: 0.0, vitality: 0.45 })

  const { user }        = useAuth()
  const { accounts }    = useAccounts(user?.uid)
  const { investments } = useInvestments(user?.uid)

  /* Derive health signals from financial data */
  const health = useMemo(() => {
    const credit  = accounts.filter(a => a.account_type === 'CREDIT')
    const debt    = credit.reduce((s, a) => s + Math.abs(a.balance ?? 0), 0)
    const limit   = credit.reduce((s, a) => s + (a.limit ?? 0), 0)
    const util    = limit > 0 ? debt / limit : 0

    const cash    = accounts
      .filter(a => a.account_type !== 'CREDIT')
      .reduce((s, a) => s + (a.balance ?? 0), 0)
    const invested = investments
      .filter(i => !['REDEEMED', 'RESGATADO'].includes(i.status))
      .reduce((s, i) => s + (i.balance ?? i.value ?? 0), 0)
    const net = cash + invested - debt

    /* Vitality: 0.1 (zero/negative) → 1.0 (thriving)
       Threshold at R$80k net worth for full vitality.     */
    const vitality = accounts.length === 0
      ? 0.45
      : Math.max(0.10, Math.min(1.0, net / 80_000 * 0.65 + 0.35))

    return { warmth: Math.min(1, util), vitality }
  }, [accounts, investments])

  useEffect(() => { tgtRef.current = health }, [health])

  /* WebGL lifecycle */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')
    if (!gl) return /* graceful: body background remains visible */

    /* Compile a shader stage */
    function mkShader(type, src) {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('[AmbientPresence] shader:', gl.getShaderInfoLog(s))
        return null
      }
      return s
    }

    const vs = mkShader(gl.VERTEX_SHADER,   VERT)
    const fs = mkShader(gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return

    const prog = gl.createProgram()
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[AmbientPresence] link:', gl.getProgramInfoLog(prog))
      return
    }
    gl.useProgram(prog)

    /* Full-screen quad (two triangles) */
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    uRef.current = {
      uTime:       gl.getUniformLocation(prog, 'uTime'),
      uWarmth:     gl.getUniformLocation(prog, 'uWarmth'),
      uVitality:   gl.getUniformLocation(prog, 'uVitality'),
      uResolution: gl.getUniformLocation(prog, 'uResolution'),
      uDark:       gl.getUniformLocation(prog, 'uDark'),
    }
    glRef.current = gl

    /* Resize at 35% — ambient texture needs no pixel precision */
    function resize() {
      const w = Math.max(1, Math.floor(canvas.clientWidth  * 0.35))
      const h = Math.max(1, Math.floor(canvas.clientHeight * 0.35))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    /* Render loop: 30fps cap; frozen time for prefers-reduced-motion */
    const INTERVAL = 1000 / 30
    const LERP     = prefersReduced ? 1.0 : 0.016 /* ~8s convergence at 30fps */
    const t0       = performance.now()
    let   last     = 0

    function draw(now) {
      animRef.current = requestAnimationFrame(draw)
      if (document.hidden || now - last < INTERVAL) return
      last = now

      const u   = uRef.current
      const cur = curRef.current
      const tgt = tgtRef.current

      /* Slowly converge toward financial health target */
      cur.warmth   += (tgt.warmth   - cur.warmth)   * LERP
      cur.vitality += (tgt.vitality - cur.vitality) * LERP

      const dark = document.documentElement.classList.contains('dark') ? 1.0 : 0.0
      const t    = prefersReduced ? 42.0 : (now - t0) / 1000

      gl.uniform1f(u.uTime,       t)
      gl.uniform1f(u.uWarmth,     cur.warmth)
      gl.uniform1f(u.uVitality,   cur.vitality)
      gl.uniform2f(u.uResolution, canvas.width, canvas.height)
      gl.uniform1f(u.uDark,       dark)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, []) /* eslint-disable-line react-hooks/exhaustive-deps */

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  )
}
