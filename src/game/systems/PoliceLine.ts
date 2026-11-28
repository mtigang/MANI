import * as THREE from 'three'
import { createPoliceOfficer, createPoliceSamand, createSirenLights, updateOfficer, OfficerHandle } from './Police'
import type { AABB } from './Collision'
import { audio } from '../core/AudioManager'

export class PoliceLine {
  officers: OfficerHandle[] = []
  private colliders: AABB[] = []
  private warned = false
  private shot = false
  private onShot?: () => void
  private sirenMeshes: THREE.Mesh[] = []
  private sirenLights: THREE.PointLight[] = []

  constructor(
    private scene: THREE.Scene,
    /** center X of the line (right side of street) */
    private lineX: number,
    private streetZ: number
  ) {}

  build(sharedColliders: AABB[]) {
    // Continuous line of officers across full street width (z span ~ sidewalk to sidewalk)
    // Street center z≈14, width ~14 → officers from z≈8.5 to z≈19.5
    const zs = [8.8, 10.0, 11.2, 12.4, 13.6, 14.8, 16.0, 17.2, 18.4, 19.4]
    const facePlayer = Math.PI * 0.5 // look toward -X

    zs.forEach((z, i) => {
      const o = createPoliceOfficer(this.scene, this.lineX, z, facePlayer + (i % 3 - 1) * 0.05)
      this.addWeapon(o)
      this.officers.push(o)
      // Tight personal collider
      const c = { minX: this.lineX - 0.45, maxX: this.lineX + 0.45, minZ: z - 0.4, maxZ: z + 0.4 }
      this.colliders.push(c)
      sharedColliders.push(c)
    })

    // Second row slightly behind
    const zs2 = [9.5, 11.5, 13.5, 15.5, 17.5]
    zs2.forEach((z, i) => {
      const o = createPoliceOfficer(this.scene, this.lineX + 1.4, z, facePlayer + (i % 2) * 0.04)
      this.addWeapon(o)
      this.officers.push(o)
      const c = { minX: this.lineX + 0.9, maxX: this.lineX + 1.9, minZ: z - 0.4, maxZ: z + 0.4 }
      this.colliders.push(c)
      sharedColliders.push(c)
    })

    // Cars at ends of line to seal sidewalk edges
    createPoliceSamand(this.scene, this.lineX + 0.5, 8.0, -Math.PI * 0.5)
    createPoliceSamand(this.scene, this.lineX + 0.5, 20.0, -Math.PI * 0.5)
    sharedColliders.push(
      { minX: this.lineX - 1.5, maxX: this.lineX + 2.5, minZ: 6.8, maxZ: 9.2 },
      { minX: this.lineX - 1.5, maxX: this.lineX + 2.5, minZ: 18.8, maxZ: 21.2 }
    )

    // Continuous collision slab across entire street so no gaps between officers
    sharedColliders.push({
      minX: this.lineX - 0.55,
      maxX: this.lineX + 2.0,
      minZ: 7.5,
      maxZ: 20.5
    })
    // Seal sidewalks so player can't sneak around
    sharedColliders.push(
      { minX: this.lineX - 0.8, maxX: this.lineX + 2.5, minZ: 6.5, maxZ: 8.0 },
      { minX: this.lineX - 0.8, maxX: this.lineX + 2.5, minZ: 19.5, maxZ: 21.5 }
    )

    const s1 = createSirenLights(this.scene, this.lineX + 0.5, 1.8, 8.0)
    const s2 = createSirenLights(this.scene, this.lineX + 0.5, 1.8, 20.0)
    this.sirenMeshes.push(...s1.meshes, ...s2.meshes)
    this.sirenLights.push(...s1.lights, ...s2.lights)
  }

  private addWeapon(o: OfficerHandle) {
    // Visible rifle-like prop in right hand
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.5, roughness: 0.4 })
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.55), gunMat)
    body.position.set(0.02, -0.15, 0.25)
    o.rightArm.add(body)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), gunMat)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0.02, -0.15, 0.55)
    o.rightArm.add(barrel)
  }

  getSirenMeshes() { return this.sirenMeshes }
  getSirenLights() { return this.sirenLights }

  update(t: number, playerPos: THREE.Vector3, onWarn: (msg: string) => void, onShot: () => void) {
    for (const o of this.officers) updateOfficer(o, t, playerPos)

    let minDist = Infinity
    for (const o of this.officers) {
      const dx = playerPos.x - o.group.position.x
      const dz = playerPos.z - o.group.position.z
      minDist = Math.min(minDist, Math.sqrt(dx * dx + dz * dz))
    }

    if (minDist < 7 && !this.warned) {
      this.warned = true
      onWarn('ایست! برگرد عقب!')
      audio.playPoliceWarn()
    }
    if (minDist < 3.2 && !this.shot) {
      this.shot = true
      this.playShotEffect(playerPos)
      onShot()
    }
    if (minDist > 12) {
      this.warned = false
    }
  }

  private playShotEffect(playerPos: THREE.Vector3) {
    // Muzzle flash near nearest officer
    let nearest = this.officers[0]
    let md = Infinity
    for (const o of this.officers) {
      const d = o.group.position.distanceTo(playerPos)
      if (d < md) { md = d; nearest = o }
    }
    const flash = new THREE.PointLight(0xffaa44, 8, 6, 2)
    flash.position.copy(nearest.group.position)
    flash.position.y = 1.4
    flash.position.x -= 0.5
    this.scene.add(flash)
    audio.playPoliceWarn()
    // Second sharper beep as shot proxy
    setTimeout(() => audio.playJump(), 50)
    setTimeout(() => {
      this.scene.remove(flash)
      flash.dispose()
    }, 120)
  }
}
