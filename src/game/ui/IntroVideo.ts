export class IntroVideo {
  private root: HTMLDivElement
  private video: HTMLVideoElement
  private onEnded: () => void
  private onPlaying?: () => void
  private finished = false
  private ready = false

  constructor(container: HTMLElement, onEnded: () => void, onPlaying?: () => void) {
    this.onEnded = onEnded
    this.onPlaying = onPlaying
    this.root = document.createElement('div')
    this.root.className = 'intro-video-overlay hidden'
    this.root.innerHTML = `
      <video class="intro-video" playsinline webkit-playsinline muted></video>
      <div class="intro-video-loading">در حال آماده‌سازی ویدیو...</div>
      <button class="intro-video-skip" type="button">رد کردن ⏭</button>
    `
    container.appendChild(this.root)
    this.video = this.root.querySelector('.intro-video') as HTMLVideoElement
    // Optimized file under public/assets
    this.video.src = `${import.meta.env.BASE_URL}assets/intro.mp4`
    this.video.preload = 'auto'
    this.video.playsInline = true
    this.video.muted = true // helps autoplay policies; user can unmute if needed
    this.video.setAttribute('playsinline', '')
    this.video.setAttribute('webkit-playsinline', '')

    this.video.addEventListener('canplaythrough', () => {
      this.ready = true
      const loading = this.root.querySelector('.intro-video-loading') as HTMLElement
      if (loading) loading.style.display = 'none'
    })
    this.video.addEventListener('playing', () => {
      const loading = this.root.querySelector('.intro-video-loading') as HTMLElement
      if (loading) loading.style.display = 'none'
      this.onPlaying?.()
    })
    this.video.addEventListener('ended', () => this.finish())
    this.video.addEventListener('error', () => {
      console.warn('Video error, skipping')
      this.finish()
    })
    this.root.querySelector('.intro-video-skip')!.addEventListener('click', () => this.finish())

    // Start loading immediately
    this.video.load()
  }

  async play() {
    this.finished = false
    this.root.classList.remove('hidden')
    const loading = this.root.querySelector('.intro-video-loading') as HTMLElement
    if (loading && !this.ready) loading.style.display = 'block'

    this.video.currentTime = 0
    // Unmute after user gesture (Start Game click counts)
    this.video.muted = false
    try {
      await this.video.play()
    } catch {
      // Retry muted if needed
      try {
        this.video.muted = true
        await this.video.play()
      } catch {
        console.warn('Video play failed; skip available')
      }
    }
  }

  private finish() {
    if (this.finished) return
    this.finished = true
    this.video.pause()
    this.video.removeAttribute('src')
    this.video.load() // release decode resources
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
    this.video.load()
    this.root.remove()
  }
}
