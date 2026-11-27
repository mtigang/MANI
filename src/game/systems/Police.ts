import * as THREE from 'three'

/** Iranian-style police Samand sedan */
export function createPoliceSamand(scene: THREE.Scene, x: number, z: number, rotY: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY

  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f4, roughness: 0.42, metalness: 0.18 })
  const green = new THREE.MeshStandardMaterial({ color: 0x1b4d2e, roughness: 0.5, metalness: 0.08 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.4, metalness: 0.25 })
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2838, transparent: true, opacity: 0.55, roughness: 0.15 })
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc8c8d4, metalness: 0.75, roughness: 0.28 })

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.72, 1.9), white)
  body.position.y = 0.56
  body.castShadow = true
  g.add(body)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.3, 1.93), green)
  stripe.position.y = 0.56
  g.add(stripe)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.72, 1.78), white)
  cabin.position.set(-0.15, 1.22, 0)
  cabin.castShadow = true
  g.add(cabin)
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.52, 1.8), glass)
  win.position.set(-0.15, 1.26, 0)
  g.add(win)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.16, 1.85), white)
  hood.position.set(1.5, 0.88, 0)
  g.add(hood)
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.22, 1.85), white)
  trunk.position.set(-1.7, 0.92, 0)
  g.add(trunk)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.14, 0.48), dark)
  bar.position.set(-0.1, 1.62, 0)
  g.add(bar)
  for (const [wx, wz] of [[1.4, 0.88], [1.4, -0.88], [-1.4, 0.88], [-1.4, -0.88]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.3, 10), dark)
    w.rotation.z = Math.PI / 2
    w.position.set(wx, 0.33, wz)
    g.add(w)
  }
  const bump = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 1.95), chrome)
  bump.position.set(2.38, 0.42, 0)
  g.add(bump)

  scene.add(g)
  return g
}

export type OfficerHandle = {
  group: THREE.Group
  head: THREE.Object3D
  leftArm: THREE.Object3D
  rightArm: THREE.Object3D
  baseYaw: number
  phase: number
  alert: boolean
}

/** NAJA-style officer with animatable head/arms */
export function createPoliceOfficer(scene: THREE.Scene, x: number, z: number, rotY: number): OfficerHandle {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY

  const uniform = new THREE.MeshStandardMaterial({ color: 0x1a4030, roughness: 0.7 })
  const pants = new THREE.MeshStandardMaterial({ color: 0x143528, roughness: 0.75 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xc4a07a, roughness: 0.62 })
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.48 })
  const badge = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.65, roughness: 0.3 })
  const shirt = new THREE.MeshStandardMaterial({ color: 0x245c3e, roughness: 0.65 })

  for (const lx of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.58, 4, 8), pants)
    leg.position.set(lx, 0.48, 0)
    g.add(leg)
  }
  for (const lx of [-0.13, 0.13]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.34), black)
    boot.position.set(lx, 0.09, 0.06)
    g.add(boot)
  }

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.52, 4, 8), uniform)
  torso.position.y = 1.18
  torso.castShadow = true
  g.add(torso)

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.3), black)
  collar.position.set(0, 1.46, 0.04)
  g.add(collar)

  // Arms as separate groups for idle sway
  const leftArm = new THREE.Group()
  leftArm.position.set(-0.34, 1.35, 0)
  const leftMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 6), shirt)
  leftMesh.position.y = -0.22
  leftArm.add(leftMesh)
  g.add(leftArm)

  const rightArm = new THREE.Group()
  rightArm.position.set(0.34, 1.35, 0)
  const rightMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 6), shirt)
  rightMesh.position.y = -0.22
  rightArm.add(rightMesh)
  g.add(rightArm)

  // Head group for look-at
  const head = new THREE.Group()
  head.position.y = 1.68
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), skin)
  head.add(headMesh)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), skin)
  nose.position.set(0, -0.02, 0.16)
  head.add(nose)
  // Simple eyes
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
  for (const ex of [-0.05, 0.05]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), eyeM)
    eye.position.set(ex, 0.02, 0.15)
    head.add(eye)
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.13, 12), uniform)
  cap.position.y = 0.14
  head.add(cap)
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.2), black)
  brim.position.set(0, 0.09, 0.14)
  head.add(brim)
  const capBadge = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), badge)
  capBadge.position.set(0, 0.16, 0.17)
  head.add(capBadge)
  g.add(head)

  const b = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.02), badge)
  b.position.set(0.24, 1.38, 0.2)
  g.add(b)
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.44), black)
  belt.position.set(0, 0.92, 0)
  g.add(belt)

  scene.add(g)
  return {
    group: g,
    head,
    leftArm,
    rightArm,
    baseYaw: rotY,
    phase: Math.random() * Math.PI * 2,
    alert: false
  }
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

/** Idle sway + look toward player when close */
export function updateOfficer(o: OfficerHandle, t: number, playerPos: THREE.Vector3) {
  const dx = playerPos.x - o.group.position.x
  const dz = playerPos.z - o.group.position.z
  const dist = Math.sqrt(dx * dx + dz * dz)

  // Idle arm sway
  o.leftArm.rotation.x = Math.sin(t * 1.2 + o.phase) * 0.08
  o.rightArm.rotation.x = Math.sin(t * 1.2 + o.phase + 1) * 0.08

  if (dist < 10) {
    // Turn head toward player
    const targetYaw = Math.atan2(dx, dz) - o.group.rotation.y
    o.head.rotation.y = THREE.MathUtils.lerp(o.head.rotation.y, targetYaw, 0.05)
    o.head.rotation.x = THREE.MathUtils.lerp(o.head.rotation.x, -0.1, 0.04)
    o.alert = dist < 5
    if (o.alert) {
      o.rightArm.rotation.x = -0.6
    }
  } else {
    o.head.rotation.y = THREE.MathUtils.lerp(o.head.rotation.y, Math.sin(t * 0.4 + o.phase) * 0.25, 0.03)
    o.head.rotation.x = THREE.MathUtils.lerp(o.head.rotation.x, 0, 0.03)
    o.alert = false
  }
}
