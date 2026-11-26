export class IntroVideo {
  private root: HTMLDivElement
  private video: HTMLVideoElement
  private onEnded: () => void
  private finished = false

  constructor(container: HTMLElement, onEnded: () => void) {
    this.onEnded = onEnded
    this.root = document.createElement('div')
    this.root.className = 'intro-video-overlay hidden'
    this.root.innerHTML = `
      <video class="intro-video" playsinline webkit-playsinline></video>
      <button class="intro-video-skip" type="button">رد کردن ⏭</button>
    `
    container.appendChild(this.root)
    this.video = this.root.querySelector('.intro-video') as HTMLVideoElement
    this.video.src = `${import.meta.env.BASE_URL}assets/intro.mp4`
    this.video.preload = 'auto'
    this.video.playsInline = true

    this.video.addEventListener('ended', () => this.finish())
    this.root.querySelector('.intro-video-skip')!.addEventListener('click', () => this.finish())
  }

  async play() {
    this.finished = false
    this.root.classList.remove('hidden')
    this.video.currentTime = 0
    try {
      await this.video.play()
    } catch {
      // Autoplay blocked – show skip so user can continue
      console.warn('Video autoplay blocked; user can skip')
    }
  }

  private finish() {
    if (this.finished) return
    this.finished = true
    this.video.pause()
    this.root.classList.add('hidden')
    this.onEnded()
  }

  hide() {
    this.video.pause()
    this.root.classList.add('hidden')
  }

  destroy() {
    this.video.pause()
    this.video.removeAttribute('src')
    this.root.remove()
  }
}
