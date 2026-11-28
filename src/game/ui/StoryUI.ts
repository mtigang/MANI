import { story, OBJECTIVE_TEXT, ObjectiveId } from '../core/StoryManager'
import { audio } from '../core/AudioManager'

export class StoryUI {
  private root: HTMLDivElement
  private phoneEl: HTMLDivElement
  private objectiveEl: HTMLDivElement
  private subtitleEl: HTMLDivElement
  private endEl: HTMLDivElement
  private onPhoneAck: () => void

  constructor(container: HTMLElement, onPhoneAck: () => void) {
    this.onPhoneAck = onPhoneAck
    this.root = document.createElement('div')
    this.root.id = 'story-ui'
    this.root.innerHTML = `
      <div class="phone-overlay hidden" id="phone-overlay">
        <div class="phone-frame">
          <div class="phone-notch"></div>
          <div class="phone-screen">
            <div class="phone-status">۹:۱۲ &nbsp; ۱۸ دی ۱۴۰۴</div>
            <div class="phone-chat-header">سامان</div>
            <div class="phone-bubble">
              سلام مانی<br/>
              امروز ساعت ۸ فراخوانه<br/>
              بیا بریم
            </div>
            <button class="phone-close" type="button">بستن</button>
          </div>
        </div>
      </div>
      <div class="objective-toast hidden" id="objective-toast"></div>
      <div class="subtitle-line hidden" id="subtitle-line"></div>
      <div class="chapter-end hidden" id="chapter-end">
        <div class="chapter-end-inner">
          <p class="chapter-end-label">پایان فصل اول</p>
        </div>
      </div>
    `
    container.appendChild(this.root)
    this.phoneEl = this.root.querySelector('#phone-overlay')!
    this.objectiveEl = this.root.querySelector('#objective-toast')!
    this.subtitleEl = this.root.querySelector('#subtitle-line')!
    this.endEl = this.root.querySelector('#chapter-end')!

    this.root.querySelector('.phone-close')!.addEventListener('click', () => {
      this.hidePhone()
      this.onPhoneAck()
    })

    story.onChange((_s, obj) => this.refreshObjective(obj))
  }

  showPhone() {
    this.phoneEl.classList.remove('hidden')
    audio.playClick()
  }

  hidePhone() {
    this.phoneEl.classList.add('hidden')
  }

  isPhoneOpen() {
    return !this.phoneEl.classList.contains('hidden')
  }

  private refreshObjective(obj: ObjectiveId) {
    if (!obj) {
      this.objectiveEl.classList.add('hidden')
      return
    }
    this.objectiveEl.textContent = OBJECTIVE_TEXT[obj]
    this.objectiveEl.classList.remove('hidden')
  }

  showSubtitle(text: string, ms = 3200) {
    this.subtitleEl.textContent = text
    this.subtitleEl.classList.remove('hidden')
    window.setTimeout(() => this.subtitleEl.classList.add('hidden'), ms)
  }

  showChapterEnd() {
    this.endEl.classList.remove('hidden')
  }

  destroy() {
    this.root.remove()
  }
}
