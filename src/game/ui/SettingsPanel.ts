import { settings, GameSettings, GraphicsQuality } from '../core/Settings'

export class SettingsPanel {
  private root: HTMLDivElement
  private onBack: () => void

  constructor(container: HTMLElement, onBack: () => void) {
    this.onBack = onBack
    this.root = document.createElement('div')
    this.root.className = 'mani-ui settings-panel hidden'
    this.root.innerHTML = `
      <div class="ui-vignette"></div>
      <div class="settings-card">
        <h2 class="settings-title">Settings</h2>

        <div class="setting-row">
          <label>Master Volume <span id="val-master">80%</span></label>
          <input type="range" id="master" min="0" max="100" value="80" />
        </div>

        <div class="setting-row">
          <label>Music Volume <span id="val-music">60%</span></label>
          <input type="range" id="music" min="0" max="100" value="60" />
        </div>

        <div class="setting-row">
          <label>Sound Effects <span id="val-sfx">80%</span></label>
          <input type="range" id="sfx" min="0" max="100" value="80" />
        </div>

        <div class="setting-row">
          <label>Graphics Quality</label>
          <select id="graphics">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="ultra">Ultra</option>
          </select>
        </div>

        <div class="setting-row">
          <label>Mouse Sensitivity <span id="val-mouse">1.0</span></label>
          <input type="range" id="mouse" min="20" max="200" value="100" />
        </div>

        <div class="setting-row">
          <label>Touch Sensitivity <span id="val-touch">1.0</span></label>
          <input type="range" id="touch" min="20" max="200" value="100" />
        </div>

        <div class="setting-row toggle-row">
          <label>Fullscreen</label>
          <div class="toggle" id="fullscreen" role="switch" aria-checked="false"></div>
        </div>

        <div class="settings-actions">
          <button class="mani-btn" id="reset" type="button">Reset Settings</button>
          <button class="mani-btn primary" id="back" type="button">Back to Main Menu</button>
        </div>
      </div>
    `
    container.appendChild(this.root)
    this.bind()
    this.syncFromSettings()
  }

  private bind() {
    const master = this.root.querySelector('#master') as HTMLInputElement
    const music = this.root.querySelector('#music') as HTMLInputElement
    const sfx = this.root.querySelector('#sfx') as HTMLInputElement
    const graphics = this.root.querySelector('#graphics') as HTMLSelectElement
    const mouse = this.root.querySelector('#mouse') as HTMLInputElement
    const touch = this.root.querySelector('#touch') as HTMLInputElement
    const fullscreen = this.root.querySelector('#fullscreen') as HTMLDivElement
    const resetBtn = this.root.querySelector('#reset') as HTMLButtonElement
    const backBtn = this.root.querySelector('#back') as HTMLButtonElement

    master.addEventListener('input', () => {
      const v = Number(master.value) / 100
      settings.set('masterVolume', v)
      this.root.querySelector('#val-master')!.textContent = `${master.value}%`
    })
    music.addEventListener('input', () => {
      const v = Number(music.value) / 100
      settings.set('musicVolume', v)
      this.root.querySelector('#val-music')!.textContent = `${music.value}%`
    })
    sfx.addEventListener('input', () => {
      const v = Number(sfx.value) / 100
      settings.set('sfxVolume', v)
      this.root.querySelector('#val-sfx')!.textContent = `${sfx.value}%`
    })
    graphics.addEventListener('change', () => {
      settings.set('graphicsQuality', graphics.value as GraphicsQuality)
    })
    mouse.addEventListener('input', () => {
      const v = Number(mouse.value) / 100
      settings.set('mouseSensitivity', v)
      this.root.querySelector('#val-mouse')!.textContent = v.toFixed(1)
    })
    touch.addEventListener('input', () => {
      const v = Number(touch.value) / 100
      settings.set('touchSensitivity', v)
      this.root.querySelector('#val-touch')!.textContent = v.toFixed(1)
    })
    fullscreen.addEventListener('click', () => {
      const next = !settings.get().fullscreen
      settings.set('fullscreen', next)
      fullscreen.classList.toggle('on', next)
      fullscreen.setAttribute('aria-checked', String(next))
      this.applyFullscreen(next)
    })
    resetBtn.addEventListener('click', () => {
      settings.reset()
      this.syncFromSettings()
    })
    backBtn.addEventListener('click', () => this.onBack())
  }

  private applyFullscreen(on: boolean) {
    if (on) {
      document.documentElement.requestFullscreen?.().catch(() => {
        settings.set('fullscreen', false)
        this.syncFromSettings()
      })
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.()
    }
  }

  private syncFromSettings() {
    const s = settings.get()
    const master = this.root.querySelector('#master') as HTMLInputElement
    const music = this.root.querySelector('#music') as HTMLInputElement
    const sfx = this.root.querySelector('#sfx') as HTMLInputElement
    const graphics = this.root.querySelector('#graphics') as HTMLSelectElement
    const mouse = this.root.querySelector('#mouse') as HTMLInputElement
    const touch = this.root.querySelector('#touch') as HTMLInputElement
    const fullscreen = this.root.querySelector('#fullscreen') as HTMLDivElement

    master.value = String(Math.round(s.masterVolume * 100))
    music.value = String(Math.round(s.musicVolume * 100))
    sfx.value = String(Math.round(s.sfxVolume * 100))
    graphics.value = s.graphicsQuality
    mouse.value = String(Math.round(s.mouseSensitivity * 100))
    touch.value = String(Math.round(s.touchSensitivity * 100))
    fullscreen.classList.toggle('on', s.fullscreen)
    fullscreen.setAttribute('aria-checked', String(s.fullscreen))

    this.root.querySelector('#val-master')!.textContent = `${master.value}%`
    this.root.querySelector('#val-music')!.textContent = `${music.value}%`
    this.root.querySelector('#val-sfx')!.textContent = `${sfx.value}%`
    this.root.querySelector('#val-mouse')!.textContent = s.mouseSensitivity.toFixed(1)
    this.root.querySelector('#val-touch')!.textContent = s.touchSensitivity.toFixed(1)
  }

  show() {
    this.syncFromSettings()
    this.root.classList.remove('hidden')
  }

  hide() {
    this.root.classList.add('hidden')
  }

  destroy() {
    this.root.remove()
  }
}
