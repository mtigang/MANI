import * as THREE from 'three'

/** Simple first-person arms (olive hoodie sleeves + hands) */
export class FirstPersonBody {
  group = new THREE.Group()
  private leftArm: THREE.Group
  private rightArm: THREE.Group
  private bob = 0

  constructor(camera: THREE.Camera) {
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.75 })
    const skin = new THREE.MeshStandardMaterial({ color: 0xc4a07a, roughness: 0.65 })

    this.leftArm = new THREE.Group()
    this.rightArm = new THREE.Group()

    const makeArm = (side: number) => {
      const g = new THREE.Group()
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), sleeve)
      upper.position.set(0, -0.15, 0)
      g.add(upper)
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.14), skin)
      hand.position.set(0, -0.38, 0.02)
      g.add(hand)
      // watch on left
      if (side < 0) {
        const watch = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 0.04, 0.08),
          new THREE.MeshStandardMaterial({ color: 0x333338, metalness: 0.4, roughness: 0.4 })
        )
        watch.position.set(0, -0.28, 0.02)
        g.add(watch)
      }
      g.position.set(side * 0.28, -0.28, -0.45)
      g.rotation.x = 0.35
      return g
    }

    this.leftArm = makeArm(-1)
    this.rightArm = makeArm(1)
    this.group.add(this.leftArm, this.rightArm)
    camera.add(this.group)
  }

  update(dt: number, moving: boolean, running: boolean) {
    if (moving) {
      this.bob += dt * (running ? 12 : 8)
      const a = Math.sin(this.bob) * (running ? 0.08 : 0.05)
      this.leftArm.rotation.x = 0.35 + a
      this.rightArm.rotation.x = 0.35 - a
    } else {
      // subtle breath
      this.bob += dt * 2
      const a = Math.sin(this.bob) * 0.012
      this.leftArm.rotation.x = 0.35 + a
      this.rightArm.rotation.x = 0.35 + a
    }
  }

  dispose(camera: THREE.Camera) {
    camera.remove(this.group)
  }
}
