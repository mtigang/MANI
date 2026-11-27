import * as THREE from 'three'

/** Iranian-style police Samand-like sedan */
export function createPoliceSamand(scene: THREE.Scene, x: number, z: number, rotY: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY

  const white = new THREE.MeshStandardMaterial({ color: 0xf0f0f2, roughness: 0.45, metalness: 0.15 })
  const green = new THREE.MeshStandardMaterial({ color: 0x1a4a2a, roughness: 0.5, metalness: 0.1 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.4, metalness: 0.2 })
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2838, transparent: true, opacity: 0.55, roughness: 0.15 })
  const chrome = new THREE.MeshStandardMaterial({ color: 0xccccdd, metalness: 0.7, roughness: 0.3 })

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.7, 1.85), white)
  body.position.y = 0.55
  body.castShadow = true
  g.add(body)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.28, 1.88), green)
  stripe.position.y = 0.55
  g.add(stripe)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.7, 1.75), white)
  cabin.position.set(-0.15, 1.2, 0)
  cabin.castShadow = true
  g.add(cabin)
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.78), glass)
  win.position.set(-0.15, 1.25, 0)
  g.add(win)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 1.8), white)
  hood.position.set(1.5, 0.85, 0)
  g.add(hood)
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 1.8), white)
  trunk.position.set(-1.7, 0.9, 0)
  g.add(trunk)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.45), dark)
  bar.position.set(-0.1, 1.6, 0)
  g.add(bar)
  for (const [wx, wz] of [[1.4, 0.85], [1.4, -0.85], [-1.4, 0.85], [-1.4, -0.85]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.28, 10), dark)
    w.rotation.z = Math.PI / 2
    w.position.set(wx, 0.32, wz)
    g.add(w)
  }
  const bump = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 1.9), chrome)
  bump.position.set(2.35, 0.4, 0)
  g.add(bump)
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.02), green)
  plate.position.set(0.3, 0.7, 0.94)
  g.add(plate)

  scene.add(g)
  return g
}

/** Better NAJA-style officer facing a direction */
export function createPoliceOfficer(scene: THREE.Scene, x: number, z: number, rotY: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY

  const uniform = new THREE.MeshStandardMaterial({ color: 0x1a3d28, roughness: 0.72 })
  const pants = new THREE.MeshStandardMaterial({ color: 0x152e20, roughness: 0.78 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xc4a07a, roughness: 0.65 })
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })
  const badge = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.65, roughness: 0.3 })
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 })

  // Legs
  for (const lx of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.58, 4, 8), pants)
    leg.position.set(lx, 0.48, 0)
    g.add(leg)
  }
  for (const lx of [-0.13, 0.13]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.14, 0.32), black)
    boot.position.set(lx, 0.09, 0.05)
    g.add(boot)
  }
  // Torso with slight chest
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 8), uniform)
  torso.position.y = 1.18
  torso.castShadow = true
  g.add(torso)
  // Collar strip
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.28), black)
  collar.position.set(0, 1.45, 0.05)
  g.add(collar)
  // Arms
  for (const ax of [-0.34, 0.34]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 6), uniform)
    arm.position.set(ax, 1.15, 0)
    g.add(arm)
  }
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), skin)
  head.position.y = 1.68
  g.add(head)
  // Face hint (nose)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), skin)
  nose.position.set(0, 1.66, 0.16)
  g.add(nose)
  // Cap with visor
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.13, 12), uniform)
  cap.position.y = 1.82
  g.add(cap)
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.2), black)
  brim.position.set(0, 1.77, 0.14)
  g.add(brim)
  // Cap badge
  const capBadge = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), badge)
  capBadge.position.set(0, 1.84, 0.17)
  g.add(capBadge)
  // Shoulder badge
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.02), badge)
  b.position.set(0.24, 1.38, 0.2)
  g.add(b)
  // Belt
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.42), black)
  belt.position.set(0, 0.92, 0)
  g.add(belt)

  scene.add(g)
  return g
}

export function createSirenLights(scene: THREE.Scene, x: number, y: number, z: number) {
  const redMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2.5 })
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x0044ff, emissive: 0x0044ff, emissiveIntensity: 2.5 })
  const redMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4), redMat)
  redMesh.position.set(x - 0.45, y, z)
  scene.add(redMesh)
  const blueMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4), blueMat)
  blueMesh.position.set(x + 0.45, y, z)
  scene.add(blueMesh)
  const redL = new THREE.PointLight(0xff2200, 5, 16, 1.2)
  redL.position.set(x - 0.45, y + 0.25, z)
  scene.add(redL)
  const blueL = new THREE.PointLight(0x2244ff, 5, 16, 1.2)
  blueL.position.set(x + 0.45, y + 0.25, z)
  scene.add(blueL)
  return { meshes: [redMesh, blueMesh], lights: [redL, blueL] }
}
