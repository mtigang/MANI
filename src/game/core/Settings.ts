export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra'

export interface GameSettings {
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  graphicsQuality: GraphicsQuality
  mouseSensitivity: number
  touchSensitivity: number
  fullscreen: boolean
}

const DEFAULTS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  graphicsQuality: 'high',
  mouseSensitivity: 1.0,
  touchSensitivity: 1.0,
  fullscreen: false
}

const STORAGE_KEY = 'mani-settings-v1'

export class SettingsManager {
  private settings: GameSettings
  private listeners: Array<(s: GameSettings) => void> = []

  constructor() {
    this.settings = this.load()
  }

  private load(): GameSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return { ...DEFAULTS }
      const parsed = JSON.parse(raw) as Partial<GameSettings>
      return { ...DEFAULTS, ...parsed }
    } catch {
      return { ...DEFAULTS }
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings))
    } catch (e) {
      console.warn('Could not save settings', e)
    }
  }

  get(): GameSettings {
    return { ...this.settings }
  }

  set<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    this.settings[key] = value
    this.save()
    this.notify()
  }

  update(partial: Partial<GameSettings>) {
    Object.assign(this.settings, partial)
    this.save()
    this.notify()
  }

  reset() {
    this.settings = { ...DEFAULTS }
    this.save()
    this.notify()
  }

  onChange(cb: (s: GameSettings) => void) {
    this.listeners.push(cb)
  }

  private notify() {
    const snap = this.get()
    this.listeners.forEach(l => l(snap))
  }

  /** Apply graphics quality to a Three.js renderer */
  applyToRenderer(renderer: import('three').WebGLRenderer) {
    const q = this.settings.graphicsQuality
    const dpr = window.devicePixelRatio || 1
    switch (q) {
      case 'low':
        renderer.setPixelRatio(Math.min(dpr, 1))
        renderer.shadowMap.enabled = false
        break
      case 'medium':
        renderer.setPixelRatio(Math.min(dpr, 1.25))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = 1 // PCF
        break
      case 'high':
        renderer.setPixelRatio(Math.min(dpr, 1.75))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = 2 // PCFSoft
        break
      case 'ultra':
        renderer.setPixelRatio(Math.min(dpr, 2))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = 2
        break
    }
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
}

export const settings = new SettingsManager()
