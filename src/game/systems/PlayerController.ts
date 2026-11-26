import * as THREE from 'three'
import { InputManager } from './InputManager'

export class PlayerController {
  position = new THREE.Vector3(0, 1.6, 3)
  velocity = new THREE.Vector3()
  yaw = 0
  pitch = 0
  speed = 4
  runMultiplier = 1.8
  height = 1.6

  constructor(private input: InputManager) {}

  update(dt: number) {
    this.input.update()
    this.yaw -= this.input.state.lookX
    this.pitch -= this.input.state.lookY
    this.input.state.lookX = 0
    this.input.state.lookY = 0

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))

    const move = new THREE.Vector3()
    move.addScaledVector(forward, this.input.state.forward)
    move.addScaledVector(right, this.input.state.right)
    if (move.lengthSq() > 0) move.normalize()

    const spd = this.speed * (this.input.state.run ? this.runMultiplier : 1)
    this.velocity.x = move.x * spd
    this.velocity.z = move.z * spd
    this.position.addScaledVector(this.velocity, dt)
    this.position.y = this.height
  }

  applyToCamera(camera: THREE.PerspectiveCamera) {
    camera.position.copy(this.position)
    camera.rotation.order = 'YXZ'
    camera.rotation.y = this.yaw
    camera.rotation.x = this.pitch
  }
}
