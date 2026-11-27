import { audio } from '../core/AudioManager'

export class IntroScreen {
  private root: HTMLDivElement
  private onContinue: () => void

  constructor(container: HTMLElement, onContinue: () => void) {
    this.onContinue = onContinue
    this.root = document.createElement('div')
    this.root.className = 'mani-ui intro-screen'
    this.root.innerHTML = `
      <div class="ui-vignette"></div>
      <div class="intro-center">
        <h1 class="intro-title">MANI</h1>
        <p class="intro-subtitle">Chapter One</p>
        <button class="enter-btn" type="button">
          <span class="enter-btn-glow"></span>
          <span class="enter-btn-text">Enter the game</span>
        </button>
      </div>
      <p class="powered-by">Powered by Mehti karimi</p>
    `
    container.appendChild(this.root)
    const btn = this.root.querySelector('.enter-btn') as HTMLButtonElement
    btn.addEventListener('click', () => {
      audio.playClick()
      audio.startAmbient()
      this.onContinue()
    })
  }

  show() { this.root.classList.remove('hidden') }
  hide() { this.root.classList.add('hidden') }
  destroy() { this.root.remove() }
}
