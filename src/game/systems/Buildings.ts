import * as THREE from 'three'
import type { AABB } from './Collision'

const COLORS = [0x8a7a68, 0x6b5e52, 0x9a8a78, 0x5c5048, 0x7a6c5c, 0xa09080, 0x4a4038]

function mat(color: number, rough = 0.82) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.04 })
}

export function addDetailedBuilding(
  scene: THREE.Scene,
  colliders: AABB[],
  x: number,
  z: number,
  w: number,
  d: number,
  floors: number,
  colorIdx: number
) {
  const h = floors * 2.8 + 0.4
  const bodyMat = mat(COLORS[colorIdx % COLORS.length])
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat)
  body.position.set(x, h / 2, z)
  body.castShadow = true
  body.receiveShadow = true
  scene.add(body)

  colliders.push({
    minX: x - w / 2 - 0.05,
    maxX: x + w / 2 + 0.05,
    minZ: z - d / 2 - 0.05,
    maxZ: z + d / 2 + 0.05
  })

  // Roof edge
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.15, 0.25, d + 0.15),
    mat(0x3a3530, 0.9)
  )
  roof.position.set(x, h + 0.1, z)
  scene.add(roof)

  // Windows on +Z and -Z and sides
  const winLit = new THREE.MeshStandardMaterial({
    color: 0x1a2230,
    emissive: 0x3a4520,
    emissiveIntensity: 0.35 + (colorIdx % 3) * 0.12,
    roughness: 0.4
  })
  const winDark = new THREE.MeshStandardMaterial({ color: 0x0e1218, roughness: 0.5 })
  const frames = new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.7 })

  const placeWins = (face: 'n' | 's' | 'e' | 'w') => {
    for (let f = 0; f < floors; f++) {
      const wy = 1.2 + f * 2.8
      const cols = Math.max(2, Math.floor(w / 1.6))
      for (let c = 0; c < cols; c++) {
        const wx = x - w / 2 + 0.9 + c * ((w - 1.6) / Math.max(1, cols - 1))
        const lit = ((f + c + colorIdx) % 3) !== 0
        const m = lit ? winLit : winDark
        let px = wx, pz = z, sx = 0.7, sz = 0.06
        if (face === 'n') { pz = z + d / 2 + 0.03 }
        else if (face === 's') { pz = z - d / 2 - 0.03 }
        else if (face === 'e') { px = x + w / 2 + 0.03; pz = z - d / 2 + 0.9 + c * 1.2; sx = 0.06; sz = 0.7 }
        else { px = x - w / 2 - 0.03; pz = z - d / 2 + 0.9 + c * 1.2; sx = 0.06; sz = 0.7 }
        if (face === 'e' || face === 'w') {
          if (c >= Math.floor(d / 1.5)) continue
        }
        const win = new THREE.Mesh(new THREE.BoxGeometry(sx, 1.0, sz), m)
        win.position.set(px, wy, pz)
        scene.add(win)
      }
    }
  }
  placeWins('n')
  placeWins('s')
  placeWins('e')
  placeWins('w')

  // Ground floor door on north or south
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.6 })
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.08), doorMat)
  door.position.set(x - w * 0.15, 1.05, z + d / 2 + 0.04)
  scene.add(door)

  // Balcony on one floor
  if (floors >= 2) {
    const bal = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 0.1, 0.7), mat(0x5a5a58, 0.7))
    bal.position.set(x + w * 0.15, 2.8 + 0.3, z + d / 2 + 0.35)
    scene.add(bal)
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 0.4, 0.05), mat(0x888888, 0.5))
    rail.position.set(x + w * 0.15, 2.8 + 0.55, z + d / 2 + 0.65)
    scene.add(rail)
  }

  // AC unit
  const ac = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.4), mat(0xb0b0b0, 0.55))
  ac.position.set(x + w / 2 - 0.5, h * 0.55, z + d / 2 + 0.25)
  scene.add(ac)

  // Vertical pipe
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, h * 0.7, 6),
    mat(0x6a6a6a, 0.5)
  )
  pipe.position.set(x - w / 2 + 0.2, h * 0.4, z + d / 2 + 0.08)
  scene.add(pipe)
}
