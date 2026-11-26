import { detectDevice, isLandscape } from '../core/Device'

export class OrientationGate {
  private root: HTMLDivElement
  private active = false

  constructor(container: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'orientation-gate hidden'
    this.root.innerHTML = `
      <div class="orientation-card">
        <div class="orientation-icon">📱↻</div>
        <p class="orientation-title">گوشی را افقی بگیرید</p>
        <p class="orientation-desc">برای بازی کردن، صفحه باید در حالت افقی (Landscape) باشد.</p>
      </div>
    `
    container.appendChild(this.root)
    window.addEventListener('resize', () => this.update())
    window.addEventListener('orientationchange', () => this.update())
    this.update()
  }

  update() {
    if (detectDevice() !== 'mobile') {
      this.root.classList.add('hidden')
      this.active = false
      return
    }
    if (!isLandscape()) {
      this.root.classList.remove('hidden')
      this.active = true
    } else {
      this.root.classList.add('hidden')
      this.active = false
    }
  }

  isBlocking() {
    return this.active
  }

  destroy() {
    this.root.remove()
  }
}
