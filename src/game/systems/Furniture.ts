import * as THREE from 'three'

/** Build more realistic furniture from multiple meshes – mobile-friendly */
export function createRealisticBed(scene: THREE.Scene, x: number, z: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)

  const wood = new THREE.MeshStandardMaterial({ color: 0x5c4030, roughness: 0.55, metalness: 0.05 })
  const sheet = new THREE.MeshStandardMaterial({ color: 0xece4d8, roughness: 0.85 })
  const pillowM = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.8 })

  // Frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 1.5), wood)
  frame.position.y = 0.25
  frame.castShadow = true
  g.add(frame)
  // Legs
  for (const [lx, lz] of [[-0.95, -0.6], [-0.95, 0.6], [0.95, -0.6], [0.95, 0.6]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), wood)
    leg.position.set(lx, 0.12, lz)
    g.add(leg)
  }
  // Mattress
  const mat = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.18, 1.35), sheet)
  mat.position.y = 0.52
  mat.castShadow = true
  g.add(mat)
  // Pillow
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.75), pillowM)
  pillow.position.set(-0.7, 0.68, 0)
  g.add(pillow)
  // Headboard
  const hb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.1), wood)
  hb.position.set(0, 0.7, -0.7)
  hb.castShadow = true
  g.add(hb)

  scene.add(g)
  return g
}

export function createRealisticSofa(scene: THREE.Scene, x: number, z: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const fabric = new THREE.MeshStandardMaterial({ color: 0x3d4f5f, roughness: 0.78, metalness: 0.02 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3540, roughness: 0.8 })

  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.35, 0.9), fabric)
  seat.position.y = 0.35
  seat.castShadow = true
  g.add(seat)
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 0.22), fabric)
  back.position.set(0, 0.75, -0.38)
  back.castShadow = true
  g.add(back)
  for (const sx of [-1.05, 1.05]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.9), dark)
    arm.position.set(sx, 0.5, 0)
    g.add(arm)
  }
  // Cushions
  for (const cx of [-0.5, 0.5]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.7), fabric)
    c.position.set(cx, 0.58, 0.05)
    g.add(c)
  }
  scene.add(g)
  return g
}

export function createRealisticTV(scene: THREE.Scene, x: number, z: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const black = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.4, metalness: 0.3 })
  const screenM = new THREE.MeshStandardMaterial({
    color: 0x0a1525,
    emissive: 0x1a3050,
    emissiveIntensity: 0.4,
    roughness: 0.25
  })
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2e24, roughness: 0.6 })

  // Stand
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.5), wood)
  stand.position.y = 0.25
  stand.castShadow = true
  g.add(stand)
  // TV body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.85, 0.08), black)
  body.position.set(0, 0.95, 0)
  body.castShadow = true
  g.add(body)
  // Screen
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.75, 0.02), screenM)
  screen.position.set(0, 0.95, 0.05)
  g.add(screen)
  // Stand neck
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.08), black)
  neck.position.set(0, 0.55, 0)
  g.add(neck)

  scene.add(g)
  return g
}

export function createRealisticWardrobe(scene: THREE.Scene, x: number, z: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4e35, roughness: 0.55, metalness: 0.05 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.55), wood)
  body.position.y = 1.1
  body.castShadow = true
  g.add(body)
  // Doors seam
  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 2.0, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
  )
  seam.position.set(0, 1.1, 0.28)
  g.add(seam)
  // Handles
  const hm = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.6, roughness: 0.3 })
  for (const hx of [-0.2, 0.2]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), hm)
    h.position.set(hx, 1.1, 0.3)
    g.add(h)
  }
  scene.add(g)
  return g
}

export function createRealisticChair(scene: THREE.Scene, x: number, z: number, rotY = 0): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.6 })
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), wood)
  seat.position.y = 0.45
  seat.castShadow = true
  g.add(seat)
  for (const [lx, lz] of [[-0.2, -0.2], [-0.2, 0.2], [0.2, -0.2], [0.2, 0.2]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), wood)
    leg.position.set(lx, 0.22, lz)
    g.add(leg)
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.05), wood)
  back.position.set(0, 0.75, -0.22)
  g.add(back)
  scene.add(g)
  return g
}
