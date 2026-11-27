import { settings, GameSettings } from './Settings'

export type FootSurface = 'wood' | 'ceramic' | 'asphalt' | 'sidewalk' | 'concrete'

export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private ambientStarted = false
  private ambientNodes: AudioNode[] = []
  private footTimer = 0
  private lastFootVariant = 0
  private wasMoving = false

  constructor() {
    settings.onChange(s => this.applyVolumes(s))
  }

  private ensure() {
    if (this.ctx) return
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.musicGain = this.ctx.createGain()
    this.sfxGain = this.ctx.createGain()
    this.musicGain.connect(this.master)
    this.sfxGain.connect(this.master)
    this.master.connect(this.ctx.destination)
    this.applyVolumes(settings.get())
  }

  applyVolumes(s: GameSettings) {
    if (!this.master || !this.musicGain || !this.sfxGain) return
    this.master.gain.value = s.masterVolume
    this.musicGain.gain.value = s.musicVolume * 0.4
    this.sfxGain.gain.value = s.sfxVolume
  }

  private async resume() {
    this.ensure()
    if (this.ctx?.state === 'suspended') await this.ctx.resume()
  }

  async startAmbient() {
    await this.resume()
    if (!this.ctx || !this.musicGain || this.ambientStarted) return
    this.ambientStarted = true
    const t = this.ctx.currentTime
    const makeOsc = (type: OscillatorType, freq: number, gain: number) => {
      const o = this.ctx!.createOscillator()
      o.type = type
      o.frequency.value = freq
      const g = this.ctx!.createGain()
      g.gain.value = gain
      o.connect(g)
      g.connect(this.musicGain!)
      o.start(t)
      this.ambientNodes.push(o, g)
      return g
    }
    makeOsc('sine', 55, 0.18)
    makeOsc('sine', 82.5, 0.1)
    makeOsc('triangle', 165, 0.035)
    const pad = makeOsc('sine', 220, 0.03)
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoG = this.ctx.createGain()
    lfoG.gain.value = 0.025
    lfo.connect(lfoG)
    lfoG.connect(pad.gain)
    lfo.start(t)
    this.ambientNodes.push(lfo, lfoG)
  }

  stopAmbient() {
    this.ambientNodes.forEach(n => {
      try {
        if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') {
          ;(n as OscillatorNode).stop()
        }
        n.disconnect()
      } catch { /* ignore */ }
    })
    this.ambientNodes = []
    this.ambientStarted = false
  }

  playClick() { this.beep(660, 0.12, 0.12) }
  playDoor() {
    this.beep(180, 0.25, 0.18, 'triangle')
    setTimeout(() => this.beep(140, 0.2, 0.12, 'triangle'), 80)
  }
  playStand() {
    this.beep(220, 0.08, 0.1)
    setTimeout(() => this.beep(280, 0.1, 0.08), 60)
  }
  playJump() {
    this.beep(320, 0.08, 0.1, 'square')
    setTimeout(() => this.beep(420, 0.1, 0.07, 'square'), 50)
  }

  /** Soft warning voice-like tone when approaching police */
  playPoliceWarn() {
    this.beep(340, 0.15, 0.14, 'sawtooth')
    setTimeout(() => this.beep(280, 0.2, 0.12, 'sawtooth'), 120)
    setTimeout(() => this.beep(300, 0.25, 0.1, 'triangle'), 280)
  }

  updateFootsteps(dt: number, moving: boolean, running: boolean, surface: FootSurface) {
    if (!moving) {
      this.footTimer = 0
      this.wasMoving = false
      return
    }
    // Restart phase when starting to move so first step is immediate-ish
    if (!this.wasMoving) {
      this.footTimer = 0.08
      this.wasMoving = true
    }
    this.footTimer -= dt
    if (this.footTimer > 0) return
    // Interval depends on speed
    this.footTimer = running ? 0.30 : 0.48
    const volScale = running ? 1.15 : 0.85
    this.playFootstep(surface, volScale)
  }

  private playFootstep(surface: FootSurface, volScale: number) {
    this.ensure()
    if (!this.ctx || !this.sfxGain) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    const t = this.ctx.currentTime
    // Vary duration and filter per surface + variant
    this.lastFootVariant = (this.lastFootVariant + 1 + Math.floor(Math.random() * 2)) % 4
    const variant = this.lastFootVariant

    const cfg: Record<FootSurface, { dur: number; freq: number; q: number; type: BiquadFilterType; vol: number }> = {
      wood: { dur: 0.055, freq: 700 + variant * 40, q: 0.9, type: 'bandpass', vol: 0.2 },
      ceramic: { dur: 0.04, freq: 1200 + variant * 60, q: 1.2, type: 'bandpass', vol: 0.18 },
      asphalt: { dur: 0.07, freq: 280 + variant * 30, q: 0.6, type: 'lowpass', vol: 0.22 },
      sidewalk: { dur: 0.06, freq: 450 + variant * 35, q: 0.7, type: 'bandpass', vol: 0.2 },
      concrete: { dur: 0.065, freq: 350 + variant * 25, q: 0.55, type: 'lowpass', vol: 0.21 }
    }
    const c = cfg[surface]
    const bufferSize = Math.floor(this.ctx.sampleRate * c.dur)
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    // Layered noise envelope – less mechanical
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (bufferSize * (0.18 + variant * 0.03)))
      const n = (Math.random() * 2 - 1) * 0.7 + Math.sin(i * (0.3 + variant * 0.05)) * 0.15
      data[i] = n * env
    }
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = c.type
    filter.frequency.value = c.freq
    filter.Q.value = c.q
    const g = this.ctx.createGain()
    const vol = c.vol * volScale * (0.85 + Math.random() * 0.3)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + c.dur + 0.04)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.sfxGain)
    src.start(t)
  }

  private beep(freq: number, dur: number, vol: number, type: OscillatorType = 'sine') {
    this.ensure()
    if (!this.ctx || !this.sfxGain) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g)
    g.connect(this.sfxGain)
    o.start(t)
    o.stop(t + dur + 0.02)
  }
}

export const audio = new AudioManager()
