import { audio } from '../core/AudioManager'

export class MainMenu {
  private root: HTMLDivElement

  constructor(
    container: HTMLElement,
    handlers: { onStart: () => void; onSettings: () => void; onExit: () => void }
  ) {
    this.root = document.createElement('div')
    this.root.className = 'mani-ui main-menu hidden'
    this.root.innerHTML = `
      <div class="ui-vignette"></div>
      <div class="menu-glow"></div>
      <div class="menu-logo">MANI</div>
      <p class="menu-tagline">داستان از جایی شروع می‌شود که انتظارش را نداری</p>
      <div class="menu-options">
        <button class="mani-btn primary menu-btn-start" data-action="start" type="button">
          <span class="btn-icon">▶</span> Start Game
        </button>
        <button class="mani-btn" data-action="settings" type="button">Settings</button>
        <button class="mani-btn" data-action="exit" type="button">Exit</button>
      </div>
      <p class="powered-by menu-powered">Powered by Mehti karimi</p>
    `
    container.appendChild(this.root)

    this.root.querySelector('[data-action="start"]')!.addEventListener('click', () => {
      audio.playClick()
      handlers.onStart()
    })
    this.root.querySelector('[data-action="settings"]')!.addEventListener('click', () => {
      audio.playClick()
      handlers.onSettings()
    })
    this.root.querySelector('[data-action="exit"]')!.addEventListener('click', () => {
      audio.playClick()
      handlers.onExit()
    })
  }

  show() {
    this.root.classList.remove('hidden')
    audio.startAmbient()
  }

  hide() {
    this.root.classList.add('hidden')
  }

  destroy() {
    this.root.remove()
  }
}
