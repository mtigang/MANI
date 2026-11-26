export class InGameHUD {
  private root: HTMLDivElement
  private onMenu: () => void

  constructor(container: HTMLElement, onMenu: () => void) {
    this.onMenu = onMenu
    this.root = document.createElement('div')
    this.root.className = 'in-game-hud hidden'
    this.root.innerHTML = `
      <button class="hud-menu-btn" type="button" aria-label="Menu" title="منو">
        <span class="hud-menu-icon">
          <span></span><span></span><span></span>
        </span>
        <span class="hud-menu-label">منو</span>
      </button>
    `
    container.appendChild(this.root)

    const btn = this.root.querySelector('.hud-menu-btn') as HTMLButtonElement
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.onMenu()
    })
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
