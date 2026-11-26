import * as THREE from 'three'

/** Iranian-style police Samand-like sedan – green/white NAJA look */
export function createPoliceSamand(scene: THREE.Scene, x: number, z: number, rotY: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY

  const white = new THREE.MeshStandardMaterial({ color: 0xf0f0f2, roughness: 0.45, metalness: 0.15 })
  const green = new THREE.MeshStandardMaterial({ color: 0x1a4a2a, roughness: 0.5, metalness: 0.1 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.4, metalness: 0.2 })
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2838, transparent: true, opacity: 0.55, roughness: 0.15 })
  const chrome = new THREE.MeshStandardMaterial({ color: 0xccccdd, metalness: 0.7, roughness: 0.3 })

  // Lower body (Samand proportions – longer sedan)
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.7, 1.85), white)
  body.position.y = 0.55
  body.castShadow = true
  g.add(body)
  // Green stripe / door panel
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.28, 1.88), green)
  stripe.position.y = 0.55
  g.add(stripe)
  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.7, 1.75), white)
  cabin.position.set(-0.15, 1.2, 0)
  cabin.castShadow = true
  g.add(cabin)
  // Windows
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.78), glass)
  win.position.set(-0.15, 1.25, 0)
  g.add(win)
  // Hood slope hint
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 1.8), white)
  hood.position.set(1.5, 0.85, 0)
  g.add(hood)
  // Trunk
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 1.8), white)
  trunk.position.set(-1.7, 0.9, 0)
  g.add(trunk)
  // Light bar
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.45), dark)
  bar.position.set(-0.1, 1.6, 0)
  g.add(bar)
  // Wheels
  for (const [wx, wz] of [[1.4, 0.85], [1.4, -0.85], [-1.4, 0.85], [-1.4, -0.85]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.28, 12), dark)
    w.rotation.z = Math.PI / 2
    w.position.set(wx, 0.32, wz)
    g.add(w)
  }
  // Bumper
  const bump = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 1.9), chrome)
  bump.position.set(2.35, 0.4, 0)
  g.add(bump)

  // "پلیس" panel (simple dark plate on door)
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.02), green)
  plate.position.set(0.3, 0.7, 0.94)
  g.add(plate)

  scene.add(g)
  return g
}

/** Simple humanoid in dark-green NAJA-style uniform */
export function createPoliceOfficer(scene: THREE.Scene, x: number, z: number, rotY: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY

  const uniform = new THREE.MeshStandardMaterial({ color: 0x1e3d28, roughness: 0.75 })
  const pants = new THREE.MeshStandardMaterial({ color: 0x1a3222, roughness: 0.8 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xc4a07a, roughness: 0.7 })
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })
  const badge = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.6, roughness: 0.35 })

  // Legs
  for (const lx of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 4, 8), pants)
    leg.position.set(lx, 0.45, 0)
    g.add(leg)
  }
  // Boots
  for (const lx of [-0.12, 0.12]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.28), black)
    boot.position.set(lx, 0.08, 0.04)
    g.add(boot)
  }
  // Torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 4, 8), uniform)
  torso.position.y = 1.15
  torso.castShadow = true
  g.add(torso)
  // Arms
  for (const ax of [-0.32, 0.32]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 4, 6), uniform)
    arm.position.set(ax, 1.15, 0)
    g.add(arm)
  }
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), skin)
  head.position.y = 1.65
  g.add(head)
  // Cap
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.12, 12), uniform)
  cap.position.y = 1.78
  g.add(cap)
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.18), black)
  brim.position.set(0, 1.74, 0.12)
  g.add(brim)
  // Shoulder badge
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.02), badge)
  b.position.set(0.22, 1.35, 0.18)
  g.add(b)

  scene.add(g)
  return g
}

export function createSirenLights(scene: THREE.Scene, x: number, y: number, z: number) {
  const redMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.2 })
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x0044ff, emissive: 0x0044ff, emissiveIntensity: 1.2 })
  const redMesh = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.35), redMat)
  redMesh.position.set(x - 0.4, y, z)
  scene.add(redMesh)
  const blueMesh = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.35), blueMat)
  blueMesh.position.set(x + 0.4, y, z)
  scene.add(blueMesh)
  const redL = new THREE.PointLight(0xff2200, 3, 14, 1.4)
  redL.position.set(x - 0.4, y + 0.2, z)
  scene.add(redL)
  const blueL = new THREE.PointLight(0x2244ff, 3, 14, 1.4)
  blueL.position.set(x + 0.4, y + 0.2, z)
  scene.add(blueL)
  return { meshes: [redMesh, blueMesh], lights: [redL, blueL] }
}
