import { audio } from '../core/AudioManager'
import { saveSystem } from '../core/SaveSystem'

export class MainMenu {
  private root: HTMLDivElement
  private handlers: {
    onContinue: () => void
    onStart: () => void
    onSettings: () => void
    onExit: () => void
  }

  constructor(
    container: HTMLElement,
    handlers: {
      onContinue: () => void
      onStart: () => void
      onSettings: () => void
      onExit: () => void
    }
  ) {
    this.handlers = handlers
    this.root = document.createElement('div')
    this.root.className = 'mani-ui main-menu hidden'
    container.appendChild(this.root)
    this.render()
  }

  private render() {
    const hasSave = saveSystem.hasSave()
    this.root.innerHTML = `
      <div class="ui-vignette"></div>
      <div class="menu-glow"></div>
      <div class="menu-logo">MANI</div>
      <p class="menu-tagline">داستان از جایی شروع می‌شود که انتظارش را نداری</p>
      <div class="menu-options">
        ${hasSave ? `<button class="mani-btn primary menu-btn-start" data-action="continue" type="button">Continue</button>` : ''}
        <button class="mani-btn ${hasSave ? '' : 'primary'} menu-btn-start" data-action="start" type="button">
          ${hasSave ? 'Start New Game' : '<span class="btn-icon">▶</span> Start Game'}
        </button>
        <button class="mani-btn" data-action="settings" type="button">Settings</button>
        <button class="mani-btn" data-action="exit" type="button">Exit</button>
      </div>
      <p class="powered-by menu-powered">Powered by Mehti karimi</p>
    `

    this.root.querySelector('[data-action="continue"]')?.addEventListener('click', () => {
      audio.playClick()
      this.handlers.onContinue()
    })
    this.root.querySelector('[data-action="start"]')!.addEventListener('click', () => {
      audio.playClick()
      if (hasSave) {
        if (confirm('بازی جدید شروع شود و ذخیره قبلی پاک شود؟')) {
          saveSystem.clear()
          this.handlers.onStart()
        }
      } else {
        this.handlers.onStart()
      }
    })
    this.root.querySelector('[data-action="settings"]')!.addEventListener('click', () => {
      audio.playClick()
      this.handlers.onSettings()
    })
    this.root.querySelector('[data-action="exit"]')!.addEventListener('click', () => {
      audio.playClick()
      this.handlers.onExit()
    })
  }

  show() {
    this.render() // refresh Continue visibility
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
