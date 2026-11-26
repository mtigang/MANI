import * as THREE from 'three'
import { InputManager } from './InputManager'

export class PlayerController {
  position = new THREE.Vector3(0, 1.6, 3)
  velocity = new THREE.Vector3()
  yaw = 0
  pitch = 0
  speed = 4.0
  runMultiplier = 1.7
  height = 1.6
  private sensitivity = 1.0
  private lookSmooth = 0.18

  private gravity = 18
  private jumpForce = 7.0
  private isGrounded = true
  private groundY = 0

  /** When true, player is sitting – no move, lower camera */
  sitting = false
  private sitHeight = 1.05

  constructor(private input: InputManager) {}

  setSensitivity(s: number) {
    this.sensitivity = Math.max(0.25, Math.min(2.2, s))
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
    this.pitch = 0.15
    this.velocity.set(0, 0, 0)
  }

  update(dt: number) {
    this.input.update()

    // Smooth mouse look
    const targetYawDelta = -this.input.state.lookX * this.sensitivity
    const targetPitchDelta = -this.input.state.lookY * this.sensitivity
    this.yaw += targetYawDelta
    this.pitch += targetPitchDelta
    this.pitch = Math.max(-1.15, Math.min(1.15, this.pitch))
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

    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * dt
    }

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
}
