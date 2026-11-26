import * as THREE from 'three'

export class Door {
  mesh: THREE.Group
  private hinge: THREE.Group
  private isOpen = false
  private targetAngle = 0
  private currentAngle = 0
  private openSpeed = 3.5
  interactionDistance = 3.0
  position: THREE.Vector3

  constructor(scene: THREE.Scene, x: number, y: number, z: number, height = 2.5) {
    this.position = new THREE.Vector3(x, y, z)
    this.hinge = new THREE.Group()
    this.hinge.position.set(x - 0.6, y, z)

    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a22,
      roughness: 0.65,
      metalness: 0.05
    })
    const doorW = 1.2
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW, height, 0.07), doorMat)
    doorMesh.position.set(doorW / 2, height / 2, 0)
    doorMesh.castShadow = true
    doorMesh.receiveShadow = true
    this.hinge.add(doorMesh)

    const handleMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.7, roughness: 0.3 })
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), handleMat)
    handle.rotation.z = Math.PI / 2
    handle.position.set(doorW - 0.15, height * 0.48, 0.05)
    this.hinge.add(handle)

    this.mesh = this.hinge
    scene.add(this.hinge)
  }

  canInteract(playerPos: THREE.Vector3): boolean {
    const dx = playerPos.x - this.position.x
    const dz = playerPos.z - this.position.z
    return Math.sqrt(dx * dx + dz * dz) <= this.interactionDistance
  }

  toggle() {
    this.isOpen = !this.isOpen
    this.targetAngle = this.isOpen ? Math.PI / 2 : 0
  }

  get isOpened() {
    return this.isOpen
  }

  get isFullyOpen() {
    return this.isOpen && Math.abs(this.currentAngle - this.targetAngle) < 0.08
  }

  update(dt: number) {
    if (Math.abs(this.currentAngle - this.targetAngle) > 0.01) {
      const dir = Math.sign(this.targetAngle - this.currentAngle)
      this.currentAngle += dir * this.openSpeed * dt
      if ((dir > 0 && this.currentAngle > this.targetAngle) ||
          (dir < 0 && this.currentAngle < this.targetAngle)) {
        this.currentAngle = this.targetAngle
      }
      this.hinge.rotation.y = this.currentAngle
    }
  }

  getCollisionAABB() {
    // No collision once door is opening past ~25°
    if (this.isOpen && Math.abs(this.currentAngle) > 0.4) return null
    if (!this.isOpen && Math.abs(this.currentAngle) > 0.4) return null
    return {
      minX: this.position.x - 0.5,
      maxX: this.position.x + 0.5,
      minZ: this.position.z - 0.1,
      maxZ: this.position.z + 0.1
    }
  }
}
