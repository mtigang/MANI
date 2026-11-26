import { settings, GameSettings } from './Settings'

/**
 * Lightweight ambient loop using Web Audio API (no external file dependency).
 * Soft low drone + gentle high pad – works offline and under GitHub Pages.
 */
export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private started = false
  private nodes: AudioNode[] = []

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
    this.musicGain.gain.value = s.musicVolume * 0.35
    this.sfxGain.gain.value = s.sfxVolume
  }

  async startAmbient() {
    this.ensure()
    if (!this.ctx || !this.musicGain || this.started) return
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    this.started = true

    const t = this.ctx.currentTime

    // Low soft drone
    const osc1 = this.ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.value = 55
    const g1 = this.ctx.createGain()
    g1.gain.value = 0.22
    osc1.connect(g1)
    g1.connect(this.musicGain)
    osc1.start(t)

    // Gentle fifth
    const osc2 = this.ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = 82.5
    const g2 = this.ctx.createGain()
    g2.gain.value = 0.12
    osc2.connect(g2)
    g2.connect(this.musicGain)
    osc2.start(t)

    // Soft high pad
    const osc3 = this.ctx.createOscillator()
    osc3.type = 'triangle'
    osc3.frequency.value = 220
    const g3 = this.ctx.createGain()
    g3.gain.value = 0.04
    osc3.connect(g3)
    g3.connect(this.musicGain)
    osc3.start(t)

    // Slow LFO on high pad volume
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.08
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = 0.03
    lfo.connect(lfoGain)
    lfoGain.connect(g3.gain)
    lfo.start(t)

    this.nodes = [osc1, osc2, osc3, lfo, g1, g2, g3, lfoGain]
  }

  stopAmbient() {
    this.nodes.forEach(n => {
      try {
        if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') {
          ;(n as OscillatorNode).stop()
        }
        n.disconnect()
      } catch { /* ignore */ }
    })
    this.nodes = []
    this.started = false
  }

  playClick() {
    this.ensure()
    if (!this.ctx || !this.sfxGain) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = 660
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.15, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    o.connect(g)
    g.connect(this.sfxGain)
    o.start(t)
    o.stop(t + 0.13)
  }
}

export const audio = new AudioManager()
