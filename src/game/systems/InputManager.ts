export type InputState = {
  forward: number
  right: number
  run: boolean
  jump: boolean
  interact: boolean
  pause: boolean
  lookX: number
  lookY: number
}

export class InputManager {
  state: InputState = {
    forward: 0, right: 0, run: false, jump: false,
    interact: false, pause: false, lookX: 0, lookY: 0
  }

  private keys = new Set<string>()
  private pointerLocked = false
  private isMobile = false
  private enabled = false

  constructor(private canvas: HTMLCanvasElement) {
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    this.bindDesktop()
  }

  /** Enable gameplay input and try to lock pointer (hide cursor) */
  setEnabled(v: boolean) {
    this.enabled = v
    if (v) {
      this.lockPointer()
    } else {
      this.unlockPointer()
    }
  }

  /** Request pointer lock so cursor disappears and mouse moves the camera */
  lockPointer() {
    if (this.isMobile || !this.enabled) return
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock?.()
    }
  }

  /** Release pointer lock so cursor becomes visible again */
  unlockPointer() {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock?.()
    }
  }

  isPointerLocked() {
    return this.pointerLocked
  }

  private bindDesktop() {
    window.addEventListener('keydown', e => {
      if (!this.enabled) return
      // Prevent browser from scrolling on Space
      if (e.code === 'Space') e.preventDefault()
      this.keys.add(e.code)
      if (e.code === 'Escape') this.state.pause = true
      if (e.code === 'KeyE') this.state.interact = true
    })
    window.addEventListener('keyup', e => {
      this.keys.delete(e.code)
      if (e.code === 'KeyE') this.state.interact = false
    })

    // Click on canvas also re-locks if user clicked away
    this.canvas.addEventListener('click', () => {
      if (this.enabled && !this.isMobile) this.lockPointer()
    })

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas
      // CSS backup: hide system cursor while locked
      this.canvas.style.cursor = this.pointerLocked ? 'none' : 'default'
    })

    document.addEventListener('mousemove', e => {
      if (this.enabled && this.pointerLocked) {
        this.state.lookX += e.movementX * 0.0016
        this.state.lookY += e.movementY * 0.0016
        // clamp pitch
        this.state.lookY = Math.max(-1.25, Math.min(1.25, this.state.lookY))
      }
    })
  }

  update() {
    if (!this.enabled) {
      this.state.forward = 0
      this.state.right = 0
      this.state.run = false
      this.state.jump = false
      return
    }
    this.state.forward = 0
    this.state.right = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.state.forward += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.state.forward -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.state.right += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.state.right -= 1
    this.state.run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    this.state.jump = this.keys.has('Space')
  }

  consumePause() {
    const p = this.state.pause
    this.state.pause = false
    return p
  }

  consumeInteract() {
    const i = this.state.interact
    this.state.interact = false
    return i
  }
}
