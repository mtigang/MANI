import * as THREE from 'three'

export class Door {
  mesh: THREE.Group
  private hinge: THREE.Group
  private isOpen = false
  private targetAngle = 0
  private currentAngle = 0
  private openSpeed = 2.8
  interactionDistance = 2.4
  position: THREE.Vector3

  constructor(scene: THREE.Scene, x: number, y: number, z: number) {
    this.position = new THREE.Vector3(x, y, z)
    this.hinge = new THREE.Group()
    this.hinge.position.set(x - 0.55, y, z) // hinge on left side of door

    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a22,
      roughness: 0.65,
      metalness: 0.05
    })
    const doorGeo = new THREE.BoxGeometry(1.1, 2.2, 0.08)
    const doorMesh = new THREE.Mesh(doorGeo, doorMat)
    doorMesh.position.set(0.55, 1.1, 0) // offset so hinge is at edge
    doorMesh.castShadow = true
    doorMesh.receiveShadow = true
    this.hinge.add(doorMesh)

    // Simple handle
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.7, roughness: 0.3 })
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), handleMat)
    handle.rotation.z = Math.PI / 2
    handle.position.set(0.95, 1.05, 0.06)
    this.hinge.add(handle)

    this.mesh = this.hinge
    scene.add(this.hinge)
  }

  /** Returns true if player is close enough to interact */
  canInteract(playerPos: THREE.Vector3): boolean {
    const dx = playerPos.x - this.position.x
    const dz = playerPos.z - this.position.z
    return Math.sqrt(dx * dx + dz * dz) <= this.interactionDistance
  }

  toggle() {
    this.isOpen = !this.isOpen
    this.targetAngle = this.isOpen ? -Math.PI / 2 : 0
  }

  get isOpened() {
    return this.isOpen
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

  /** Collision box – only active when closed */
  getCollisionAABB() {
    if (this.isOpen) return null
    return {
      minX: this.position.x - 0.6,
      maxX: this.position.x + 0.6,
      minZ: this.position.z - 0.15,
      maxZ: this.position.z + 0.15
    }
  }
}
