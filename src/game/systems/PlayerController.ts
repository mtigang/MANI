import * as THREE from 'three'
import { InputManager } from './InputManager'

export class PlayerController {
  position = new THREE.Vector3(0, 1.6, 3)
  velocity = new THREE.Vector3()
  yaw = 0
  pitch = 0
  speed = 4.2
  runMultiplier = 1.75
  height = 1.6
  private sensitivity = 1.0

  private gravity = 20
  private jumpForce = 7.2
  private isGrounded = true
  private groundY = 0

  sitting = false
  private sitHeight = 1.05

  /** pixels-to-radians base scale */
  private readonly lookScale = 0.0022

  constructor(private input: InputManager) {}

  setSensitivity(s: number) {
    this.sensitivity = Math.max(0.3, Math.min(2.5, s))
  }

  setGroundY(y: number) {
    this.groundY = y
  }

  standUp() {
    this.sitting = false
    this.position.y = this.groundY + this.height
  }

  sitAt(x: number, z: number, yaw = 0) {
    this.sitting = true
    this.position.set(x, this.groundY + this.sitHeight, z)
    this.yaw = yaw
    this.pitch = 0.12
    this.velocity.set(0, 0, 0)
  }

  update(dt: number) {
    this.input.update()

    // Direct, lag-free look
    const s = this.lookScale * this.sensitivity
    this.yaw -= this.input.state.lookX * s
    this.pitch -= this.input.state.lookY * s
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch))
    this.input.state.lookX = 0
    this.input.state.lookY = 0

    if (this.sitting) {
      this.position.y = this.groundY + this.sitHeight
      this.velocity.set(0, 0, 0)
      return
    }

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))

    const move = new THREE.Vector3()
    move.addScaledVector(forward, this.input.state.forward)
    move.addScaledVector(right, this.input.state.right)
    if (move.lengthSq() > 0) move.normalize()

    const spd = this.speed * (this.input.state.run ? this.runMultiplier : 1)
    this.velocity.x = move.x * spd
    this.velocity.z = move.z * spd

    if (this.input.state.jump && this.isGrounded) {
      this.velocity.y = this.jumpForce
      this.isGrounded = false
    }

    if (!this.isGrounded) this.velocity.y -= this.gravity * dt

    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    this.position.y += this.velocity.y * dt

    const feetY = this.position.y - this.height
    if (feetY <= this.groundY) {
      this.position.y = this.groundY + this.height
      this.velocity.y = 0
      this.isGrounded = true
    } else {
      this.isGrounded = false
    }
  }

  applyToCamera(camera: THREE.PerspectiveCamera) {
    camera.position.copy(this.position)
    camera.rotation.order = 'YXZ'
    camera.rotation.y = this.yaw
    camera.rotation.x = this.pitch
  }

  get isMoving() {
    return !this.sitting && (Math.abs(this.velocity.x) + Math.abs(this.velocity.z)) > 0.4
  }

  get isRunning() {
    return this.input.state.run && this.isMoving
  }
}
