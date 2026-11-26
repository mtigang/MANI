import * as THREE from 'three'
import { InputManager } from './systems/InputManager'
import { PlayerController } from './systems/PlayerController'
import { resolveAABB, AABB } from './systems/Collision'
import { Door } from './systems/Door'
import { settings } from './core/Settings'
import { detectDevice } from './core/Device'
import { audio } from './core/AudioManager'
import { IntroScreen } from './ui/IntroScreen'
import { MainMenu } from './ui/MainMenu'
import { SettingsPanel } from './ui/SettingsPanel'
import { InGameHUD } from './ui/InGameHUD'
import { OrientationGate } from './ui/OrientationGate'
import './ui/ui.css'

type GameState = 'intro' | 'menu' | 'settings' | 'playing' | 'paused'

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private clock = new THREE.Clock()
  private running = false
  private state: GameState = 'intro'
  private input: InputManager
  private player: PlayerController

  private intro!: IntroScreen
  private menu!: MainMenu
  private settingsPanel!: SettingsPanel
  private hud!: InGameHUD
  private orientation!: OrientationGate
  private uiRoot: HTMLElement
  private pauseOverlay: HTMLDivElement | null = null
  private interactHint: HTMLDivElement | null = null
  private standHint: HTMLDivElement | null = null

  private colliders: AABB[] = []
  private door!: Door
  private playerRadius = 0.38
  private device = detectDevice()

  // Siren lights
  private sirenLights: THREE.PointLight[] = []
  private sirenMeshes: THREE.Mesh[] = []

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.device === 'mobile' ? 1.5 : 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.25

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x2a2535)
    this.scene.fog = new THREE.FogExp2(0x2a2535, 0.012)

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200)

    this.input = new InputManager(canvas)
    this.player = new PlayerController(this.input)

    settings.applyToRenderer(this.renderer)
    settings.onChange(s => {
      settings.applyToRenderer(this.renderer)
      this.player.setSensitivity(s.mouseSensitivity)
      this.renderer.toneMappingExposure = s.graphicsQuality === 'low' ? 1.1 : 1.25
    })
    this.player.setSensitivity(settings.get().mouseSensitivity)

    this.uiRoot = document.getElementById('ui-overlay')!
    this.buildUI()
    window.addEventListener('resize', this.onResize)
  }

  private buildUI() {
    this.intro = new IntroScreen(this.uiRoot, () => this.goToMenu())
    this.menu = new MainMenu(this.uiRoot, {
      onStart: () => this.startGame(),
      onSettings: () => this.goToSettings(),
      onExit: () => this.handleExit()
    })
    this.settingsPanel = new SettingsPanel(this.uiRoot, () => this.goToMenu())
    this.hud = new InGameHUD(this.uiRoot, () => this.togglePause())
    this.orientation = new OrientationGate(this.uiRoot)
  }

  private goToMenu() {
    this.state = 'menu'
    this.intro.hide()
    this.settingsPanel.hide()
    this.hud.hide()
    this.hidePauseOverlay()
    this.hideInteractHint()
    this.hideStandHint()
    this.menu.show()
    this.input.setEnabled(false)
  }

  private goToSettings() {
    this.state = 'settings'
    this.menu.hide()
    this.settingsPanel.show()
  }

  private startGame() {
    if (this.orientation.isBlocking()) return
    this.state = 'playing'
    this.menu.hide()
    this.settingsPanel.hide()
    this.intro.hide()
    this.hidePauseOverlay()
    this.hud.show()
    this.input.setEnabled(true)
    // Sit on bed
    this.player.sitAt(-2.2, -2.35, Math.PI * 0.15)
    this.player.setGroundY(0)
    this.showStandHint()
  }

  private handleExit() {
    this.state = 'intro'
    this.menu.hide()
    this.settingsPanel.hide()
    this.hud.hide()
    this.hidePauseOverlay()
    this.hideInteractHint()
    this.hideStandHint()
    this.intro.show()
    this.input.setEnabled(false)
  }

  private togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused'
      this.input.setEnabled(false)
      this.hideInteractHint()
      this.showPauseOverlay()
    } else if (this.state === 'paused') {
      this.state = 'playing'
      this.input.setEnabled(true)
      this.hidePauseOverlay()
    }
  }

  private showPauseOverlay() {
    if (this.pauseOverlay) return
    this.pauseOverlay = document.createElement('div')
    this.pauseOverlay.className = 'mani-ui'
    this.pauseOverlay.style.background = 'rgba(5,5,10,0.72)'
    this.pauseOverlay.innerHTML = `
      <div style="text-align:center;display:flex;flex-direction:column;gap:1rem;align-items:center">
        <h2 style="letter-spacing:0.25em;font-size:1.6rem;margin-bottom:0.5rem">PAUSED</h2>
        <button class="mani-btn primary" id="resume-btn" type="button">ادامه بازی</button>
        <button class="mani-btn" id="to-menu-btn" type="button">منوی اصلی</button>
      </div>
    `
    this.uiRoot.appendChild(this.pauseOverlay)
    this.pauseOverlay.querySelector('#resume-btn')!.addEventListener('click', () => this.togglePause())
    this.pauseOverlay.querySelector('#to-menu-btn')!.addEventListener('click', () => {
      this.hidePauseOverlay()
      this.goToMenu()
    })
  }

  private hidePauseOverlay() {
    if (this.pauseOverlay) {
      this.pauseOverlay.remove()
      this.pauseOverlay = null
    }
  }

  private showInteractHint(text: string) {
    if (!this.interactHint) {
      this.interactHint = document.createElement('div')
      this.interactHint.style.cssText = `
        position:absolute;bottom:14%;left:50%;transform:translateX(-50%);
        background:rgba(10,10,18,0.75);backdrop-filter:blur(10px);
        border:1px solid rgba(230,57,70,0.45);border-radius:10px;
        padding:10px 22px;color:#f0f0f5;font-size:0.95rem;
        letter-spacing:0.04em;pointer-events:none;z-index:160;
      `
      this.uiRoot.appendChild(this.interactHint)
    }
    this.interactHint.textContent = text
    this.interactHint.style.display = 'block'
  }

  private hideInteractHint() {
    if (this.interactHint) this.interactHint.style.display = 'none'
  }

  private showStandHint() {
    if (!this.standHint) {
      this.standHint = document.createElement('div')
      this.standHint.style.cssText = `
        position:absolute;bottom:18%;left:50%;transform:translateX(-50%);
        background:rgba(10,10,18,0.8);backdrop-filter:blur(12px);
        border:1px solid rgba(230,57,70,0.5);border-radius:12px;
        padding:14px 28px;color:#f0f0f5;font-size:1.05rem;
        letter-spacing:0.04em;pointer-events:none;z-index:165;
        text-align:center;
      `
      this.uiRoot.appendChild(this.standHint)
    }
    this.standHint.textContent = 'با Space بلند شوید'
    this.standHint.style.display = 'block'
  }

  private hideStandHint() {
    if (this.standHint) this.standHint.style.display = 'none'
  }

  async init() {
    // Brighter lighting
    const ambient = new THREE.AmbientLight(0x6a6080, 0.55)
    this.scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xfff0d8, 1.0)
    dir.position.set(10, 20, 8)
    dir.castShadow = true
    dir.shadow.mapSize.set(this.device === 'mobile' ? 1024 : 2048, this.device === 'mobile' ? 1024 : 2048)
    dir.shadow.camera.near = 1
    dir.shadow.camera.far = 55
    dir.shadow.camera.left = -22
    dir.shadow.camera.right = 22
    dir.shadow.camera.top = 22
    dir.shadow.camera.bottom = -22
    dir.shadow.bias = -0.0003
    this.scene.add(dir)

    const hemi = new THREE.HemisphereLight(0xb0c4e0, 0x4a3a30, 0.45)
    this.scene.add(hemi)

    this.createRoom()
    this.createStreet()
    this.createDoor()
    this.createFlag()
    this.createPoliceBlockade()

    this.player.position.set(0, 1.6, 1.2)
    this.input.setEnabled(false)
  }

  private createRoom() {
    // Floor wood
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.72, metalness: 0.04 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0.01, 0)
    floor.receiveShadow = true
    this.scene.add(floor)

    // Natural ceiling (slight warm off-white, not pure flat)
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf0e8dc, roughness: 0.92, metalness: 0 })
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(8.1, 8.1), ceilMat)
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = 3.15
    this.scene.add(ceiling)

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd4c4b0, roughness: 0.9, metalness: 0.02 })
    const wallH = 3.15
    const wallT = 0.2

    this.addWall(0, wallH / 2, -4, 8.2, wallH, wallT, wallMat)
    this.addWall(-2.65, wallH / 2, 4, 2.7, wallH, wallT, wallMat)
    this.addWall(2.65, wallH / 2, 4, 2.7, wallH, wallT, wallMat)
    this.addWall(-4, wallH / 2, 0, wallT, wallH, 8.2, wallMat)
    this.addWall(4, wallH / 2, 0, wallT, wallH, 8.2, wallMat)

    // Door frame (solid, no black gap)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a3224, roughness: 0.55 })
    this.addBox(-0.7, 1.15, 3.95, 0.18, 2.3, 0.22, frameMat)
    this.addBox(0.7, 1.15, 3.95, 0.18, 2.3, 0.22, frameMat)
    this.addBox(0, 2.35, 3.95, 1.6, 0.18, 0.22, frameMat)

    // === Bed ===
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.6 })
    this.addBox(-2.2, 0.18, -2.4, 2.2, 0.36, 1.4, wood)
    this.addCollider(-2.2, -2.4, 1.2, 0.8)
    const sheet = new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.85 })
    this.addBox(-2.2, 0.42, -2.4, 2.05, 0.1, 1.25, sheet)
    const pillow = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.8 })
    this.addBox(-2.7, 0.52, -2.4, 0.45, 0.14, 0.7, pillow)

    // === Sofa ===
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x4a5a6a, roughness: 0.75 })
    this.addBox(2.3, 0.28, 1.5, 2.0, 0.4, 0.85, sofaMat)
    this.addBox(2.3, 0.7, 1.85, 2.0, 0.55, 0.18, sofaMat) // back
    this.addBox(1.4, 0.55, 1.5, 0.18, 0.35, 0.85, sofaMat)
    this.addBox(3.2, 0.55, 1.5, 0.18, 0.35, 0.85, sofaMat)
    this.addCollider(2.3, 1.5, 1.1, 0.55)

    // === TV stand + TV ===
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.55 })
    this.addBox(2.4, 0.3, -2.8, 1.5, 0.5, 0.45, darkWood)
    this.addCollider(2.4, -2.8, 0.85, 0.35)
    // TV screen (stable emissive – no flicker)
    const tvMat = new THREE.MeshStandardMaterial({
      color: 0x1a2030,
      emissive: 0x1a3050,
      emissiveIntensity: 0.35,
      roughness: 0.3
    })
    this.addBox(2.4, 0.95, -2.85, 1.3, 0.75, 0.08, tvMat)
    // TV frame
    this.addBox(2.4, 0.95, -2.88, 1.4, 0.85, 0.05, new THREE.MeshStandardMaterial({ color: 0x111114 }))

    // === Desk ===
    this.addBox(-0.3, 0.4, -3.2, 1.4, 0.08, 0.6, wood)
    this.addBox(-0.9, 0.2, -3.2, 0.07, 0.4, 0.07, wood)
    this.addBox(0.3, 0.2, -3.2, 0.07, 0.4, 0.07, wood)
    this.addCollider(-0.3, -3.2, 0.8, 0.4)

    // === Window (stable, no flicker) ===
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88aacc,
      roughness: 0.25,
      metalness: 0.05,
      emissive: 0x335566,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    })
    this.addBox(-3.92, 1.65, -0.8, 0.06, 1.3, 1.6, glassMat)
    // Window frame
    const wframe = new THREE.MeshStandardMaterial({ color: 0xeee8e0, roughness: 0.7 })
    this.addBox(-3.9, 1.65, -0.8, 0.08, 1.4, 0.06, wframe)
    this.addBox(-3.9, 1.65, -1.55, 0.08, 1.4, 0.06, wframe)
    this.addBox(-3.9, 1.65, -0.05, 0.08, 1.4, 0.06, wframe)
    this.addBox(-3.9, 2.3, -0.8, 0.08, 0.06, 1.6, wframe)
    this.addBox(-3.9, 1.0, -0.8, 0.08, 0.06, 1.6, wframe)

    // === Chandelier ===
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd0c8a0, metalness: 0.7, roughness: 0.3 })
    this.addBox(0, 2.95, 0, 0.08, 0.25, 0.08, chrome)
    const chandelier = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfff5e0,
        emissive: 0xffe8b0,
        emissiveIntensity: 0.8,
        roughness: 0.4
      })
    )
    chandelier.position.set(0, 2.7, 0)
    this.scene.add(chandelier)
    const chandelierLight = new THREE.PointLight(0xfff0d0, 1.4, 12, 1.6)
    chandelierLight.position.set(0, 2.55, 0)
    chandelierLight.castShadow = this.device !== 'mobile'
    this.scene.add(chandelierLight)

    // Desk lamp
    const lampLight = new THREE.PointLight(0xffcc88, 0.7, 6, 1.8)
    lampLight.position.set(-0.3, 1.1, -3.0)
    this.scene.add(lampLight)
  }

  private createStreet() {
    // Street along X (left → right), building faces Z-
    const streetMat = new THREE.MeshStandardMaterial({ color: 0x3e3e42, roughness: 0.9, metalness: 0.06 })
    const street = new THREE.Mesh(new THREE.PlaneGeometry(70, 18), streetMat)
    street.rotation.x = -Math.PI / 2
    street.position.set(5, 0, 10)
    street.receiveShadow = true
    this.scene.add(street)

    // Sidewalk in front of our building
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x6e6a64, roughness: 0.85 })
    this.addBox(0, 0.05, 5.8, 16, 0.1, 3.2, sideMat)

    // Dense continuous row of buildings – same side (behind player / +Z relative to street)
    const colors = [0x8a7a6a, 0x6a5a50, 0x7a6a5a, 0x5a4a42, 0x9a8a78]
    // Our house is around z≈0; street centers at z=10, buildings on far side z≈16–18 and near side
    // Buildings on the opposite side of the street (dense)
    for (let i = -4; i <= 5; i++) {
      const x = i * 5.2
      const h = 4.5 + (Math.abs(i) % 3) * 1.2
      const mat = new THREE.MeshStandardMaterial({
        color: colors[(i + 4) % colors.length],
        roughness: 0.82
      })
      this.addBox(x, h / 2, 17, 5.0, h, 5.5, mat)
      this.addCollider(x, 17, 2.6, 2.9)
      // Windows
      const winMat = new THREE.MeshStandardMaterial({
        color: 0x1a2230,
        emissive: 0x223344,
        emissiveIntensity: 0.35 + (i % 2) * 0.2
      })
      for (let wy = 1.3; wy < h - 0.7; wy += 1.5) {
        this.addBox(x - 1.2, wy, 14.2, 0.9, 0.85, 0.08, winMat)
        this.addBox(x + 1.2, wy, 14.2, 0.9, 0.85, 0.08, winMat)
      }
    }

    // Buildings on our side of the street (left and right of our house), stuck together
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue // our house gap
      const x = i * 5.5
      const h = 3.5 + (Math.abs(i) % 2) * 1.5
      const mat = new THREE.MeshStandardMaterial({
        color: colors[(i + 5) % colors.length],
        roughness: 0.85
      })
      this.addBox(x, h / 2, 1.5, 5.2, h, 6, mat)
      this.addCollider(x, 1.5, 2.7, 3.1)
    }

    // Road markings along X
    const markMat = new THREE.MeshStandardMaterial({ color: 0xd0c890, roughness: 0.9 })
    for (let i = -5; i <= 6; i++) {
      this.addBox(i * 5.5, 0.03, 10, 2.0, 0.02, 0.3, markMat)
    }

    // Street lights
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.5, roughness: 0.45 })
    for (let i = -3; i <= 4; i++) {
      const x = i * 8
      this.addBox(x, 2.3, 7.2, 0.1, 4.6, 0.1, poleMat)
      const pl = new THREE.PointLight(0xffe8b0, 1.1, 12, 1.7)
      pl.position.set(x, 4.5, 7.2)
      this.scene.add(pl)
    }
  }

  private createPoliceBlockade() {
    // Police car blocking the right side of the street (positive X)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.45, metalness: 0.3 })
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe8e8f0, roughness: 0.5 })

    // Car body
    this.addBox(12, 0.55, 10, 4.2, 0.7, 1.9, bodyMat)
    this.addBox(12, 1.15, 10, 2.4, 0.65, 1.7, whiteMat)
    // Windows
    const glass = new THREE.MeshStandardMaterial({
      color: 0x223344,
      transparent: true,
      opacity: 0.6,
      roughness: 0.2
    })
    this.addBox(12, 1.2, 10, 2.0, 0.5, 1.75, glass)

    // Light bar
    this.addBox(12, 1.55, 10, 1.6, 0.12, 0.5, new THREE.MeshStandardMaterial({ color: 0x222228 }))

    // Siren lights (animated)
    const redMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 1.2
    })
    const blueMat = new THREE.MeshStandardMaterial({
      color: 0x0044ff,
      emissive: 0x0044ff,
      emissiveIntensity: 1.2
    })
    const redMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.4), redMat)
    redMesh.position.set(11.5, 1.7, 10)
    this.scene.add(redMesh)
    const blueMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.4), blueMat)
    blueMesh.position.set(12.5, 1.7, 10)
    this.scene.add(blueMesh)
    this.sirenMeshes.push(redMesh, blueMesh)

    const redL = new THREE.PointLight(0xff2200, 2.5, 10, 1.5)
    redL.position.set(11.5, 1.8, 10)
    this.scene.add(redL)
    const blueL = new THREE.PointLight(0x2244ff, 2.5, 10, 1.5)
    blueL.position.set(12.5, 1.8, 10)
    this.scene.add(blueL)
    this.sirenLights.push(redL, blueL)

    // Blockade collider
    this.addCollider(12, 10, 2.5, 1.5)
  }

  private createDoor() {
    this.door = new Door(this.scene, 0, 0, 4.0)
  }

  private createFlag() {
    const loader = new THREE.TextureLoader()
    loader.load(
      `${import.meta.env.BASE_URL}assets/flag-lion-sun.png`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        const flagMat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.75,
          metalness: 0.02,
          side: THREE.DoubleSide
        })
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), flagMat)
        flag.position.set(0, 2.05, -3.88)
        this.scene.add(flag)
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8),
          new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.5 })
        )
        rod.rotation.z = Math.PI / 2
        rod.position.set(0, 2.58, -3.88)
        this.scene.add(rod)
      },
      undefined,
      () => console.warn('Flag texture failed')
    )
  }

  private addWall(x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) {
    this.addBox(x, y, z, w, h, d, mat)
    this.addCollider(x, z, w / 2 + 0.06, d / 2 + 0.06)
  }

  private addBox(x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.scene.add(mesh)
    return mesh
  }

  private addCollider(x: number, z: number, halfW: number, halfD: number) {
    this.colliders.push({
      minX: x - halfW,
      maxX: x + halfW,
      minZ: z - halfD,
      maxZ: z + halfD
    })
  }

  start() {
    this.running = true
    this.intro.show()
    this.animate()
  }

  private animate = () => {
    if (!this.running) return
    requestAnimationFrame(this.animate)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const t = this.clock.elapsedTime

    // Siren animation
    if (this.sirenLights.length >= 2) {
      const pulse = (Math.sin(t * 8) + 1) * 0.5
      this.sirenLights[0].intensity = 1.2 + pulse * 2.2
      this.sirenLights[1].intensity = 1.2 + (1 - pulse) * 2.2
      if (this.sirenMeshes[0]) {
        (this.sirenMeshes[0].material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + pulse * 1.2
      }
      if (this.sirenMeshes[1]) {
        (this.sirenMeshes[1].material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + (1 - pulse) * 1.2
      }
    }

    if (this.state === 'playing' && !this.orientation.isBlocking()) {
      this.player.update(dt)

      // Stand up from bed
      if (this.player.sitting) {
        if (this.input.state.jump) {
          this.player.standUp()
          this.hideStandHint()
        }
      } else {
        resolveAABB(this.player.position, this.playerRadius, this.colliders)
        const doorBox = this.door.getCollisionAABB()
        if (doorBox) resolveAABB(this.player.position, this.playerRadius, [doorBox])

        this.door.update(dt)

        if (this.door.canInteract(this.player.position)) {
          const label = this.door.isOpened ? 'E  ·  بستن در' : 'E  ·  باز کردن در'
          this.showInteractHint(label)
          if (this.input.consumeInteract()) this.door.toggle()
        } else {
          this.hideInteractHint()
        }
      }

      this.player.applyToCamera(this.camera)

      if (this.input.consumePause()) this.togglePause()
    } else if (this.state === 'intro' || this.state === 'menu' || this.state === 'settings') {
      this.camera.position.set(
        Math.sin(t * 0.1) * 0.4,
        1.7 + Math.sin(t * 0.15) * 0.05,
        4.6
      )
      this.camera.lookAt(0, 1.25, 0)
    }

    this.renderer.render(this.scene, this.camera)
  }

  private onResize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    settings.applyToRenderer(this.renderer)
    this.orientation.update()
  }

  dispose() {
    this.running = false
    window.removeEventListener('resize', this.onResize)
    this.intro.destroy()
    this.menu.destroy()
    this.settingsPanel.destroy()
    this.hud.destroy()
    this.orientation.destroy()
    this.hidePauseOverlay()
    this.hideInteractHint()
    this.hideStandHint()
    audio.stopAmbient()
    this.renderer.dispose()
  }
}
