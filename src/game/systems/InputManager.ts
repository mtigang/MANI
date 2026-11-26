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

  constructor(private canvas: HTMLCanvasElement) {
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    this.bindDesktop()
    if (this.isMobile) this.bindMobile()
  }

  private bindDesktop() {
    window.addEventListener('keydown', e => {
      this.keys.add(e.code)
      if (e.code === 'Escape') this.state.pause = true
      if (e.code === 'KeyE') this.state.interact = true
    })
    window.addEventListener('keyup', e => {
      this.keys.delete(e.code)
      if (e.code === 'KeyE') this.state.interact = false
    })
    this.canvas.addEventListener('click', () => {
      if (!this.isMobile) this.canvas.requestPointerLock()
    })
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas
    })
    document.addEventListener('mousemove', e => {
      if (this.pointerLocked) {
        this.state.lookX += e.movementX * 0.002
        this.state.lookY += e.movementY * 0.002
        this.state.lookY = Math.max(-1.2, Math.min(1.2, this.state.lookY))
      }
    })
  }

  private bindMobile() {
    // Placeholder – virtual joystick & buttons will be added in UI phase
  }

  update() {
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
