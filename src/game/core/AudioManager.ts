import { settings, GameSettings } from './Settings'

/**
 * Web-Audio ambient + procedural SFX (no large external files).
 * Works offline under GitHub Pages.
 */
export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private ambientStarted = false
  private ambientNodes: AudioNode[] = []
  private footTimer = 0

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

  playClick() {
    this.beep(660, 0.12, 0.12)
  }

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

  /** surface: 'wood' | 'street' */
  updateFootsteps(dt: number, moving: boolean, running: boolean, surface: 'wood' | 'street') {
    if (!moving) {
      this.footTimer = 0
      return
    }
    this.footTimer -= dt
    if (this.footTimer > 0) return
    this.footTimer = running ? 0.28 : 0.42
    this.playFootstep(surface)
  }

  private playFootstep(surface: 'wood' | 'street') {
    this.ensure()
    if (!this.ctx || !this.sfxGain) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    const t = this.ctx.currentTime
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.06)
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25))
    }
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    if (surface === 'wood') {
      filter.type = 'bandpass'
      filter.frequency.value = 800
      filter.Q.value = 0.8
    } else {
      filter.type = 'lowpass'
      filter.frequency.value = 400
    }
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(surface === 'wood' ? 0.22 : 0.18, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
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
