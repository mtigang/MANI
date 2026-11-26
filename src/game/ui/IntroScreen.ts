export class IntroScreen {
  private root: HTMLDivElement
  private onContinue: () => void

  constructor(container: HTMLElement, onContinue: () => void) {
    this.onContinue = onContinue
    this.root = document.createElement('div')
    this.root.className = 'mani-ui intro-screen'
    this.root.innerHTML = `
      <div class="ui-vignette"></div>
      <h1 class="intro-title">MANI</h1>
      <p class="intro-subtitle">Chapter One</p>
      <p class="intro-desc">
        در سکوت یک اتاق، داستان آغاز می‌شود.<br>
        قدم‌هایی که می‌گذاری، انتخاب‌هایی که می‌کنی،<br>
        همه به جایی می‌رسند که انتظارش را نداری.
      </p>
      <button class="mani-btn primary intro-btn" type="button">ورود</button>
    `
    container.appendChild(this.root)
    const btn = this.root.querySelector('.intro-btn') as HTMLButtonElement
    btn.addEventListener('click', () => this.onContinue())
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
