export class MainMenu {
  private root: HTMLDivElement
  private onStart: () => void
  private onSettings: () => void
  private onExit: () => void

  constructor(
    container: HTMLElement,
    handlers: { onStart: () => void; onSettings: () => void; onExit: () => void }
  ) {
    this.onStart = handlers.onStart
    this.onSettings = handlers.onSettings
    this.onExit = handlers.onExit

    this.root = document.createElement('div')
    this.root.className = 'mani-ui main-menu hidden'
    this.root.innerHTML = `
      <div class="ui-vignette"></div>
      <div class="menu-logo">MANI</div>
      <div class="menu-options">
        <button class="mani-btn primary" data-action="start" type="button">Start Game</button>
        <button class="mani-btn" data-action="settings" type="button">Settings</button>
        <button class="mani-btn" data-action="exit" type="button">Exit</button>
      </div>
    `
    container.appendChild(this.root)

    this.root.querySelector('[data-action="start"]')!.addEventListener('click', () => this.onStart())
    this.root.querySelector('[data-action="settings"]')!.addEventListener('click', () => this.onSettings())
    this.root.querySelector('[data-action="exit"]')!.addEventListener('click', () => this.onExit())
  }

  show() {
    this.root.classList.remove('hidden')
  }

  hide() {
    this.root.classList.add('hidden')
  }

  destroy() {
    this.root.remove()
  }
}
