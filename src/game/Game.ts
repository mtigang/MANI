import * as THREE from 'three'
import { InputManager } from './systems/InputManager'
import { PlayerController } from './systems/PlayerController'
import { resolveAABB, AABB } from './systems/Collision'
import { Door } from './systems/Door'
import { createRealisticBed, createRealisticSofa, createRealisticTV, createRealisticWardrobe, createRealisticChair } from './systems/Furniture'
import { settings } from './core/Settings'
import { detectDevice } from './core/Device'
import { audio } from './core/AudioManager'
import { saveSystem } from './core/SaveSystem'
import { IntroScreen } from './ui/IntroScreen'
import { MainMenu } from './ui/MainMenu'
import { SettingsPanel } from './ui/SettingsPanel'
import { InGameHUD } from './ui/InGameHUD'
import { OrientationGate } from './ui/OrientationGate'
import { IntroVideo } from './ui/IntroVideo'
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
  private introVideo!: IntroVideo
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
  private renderingPaused = false
  private leftHouseSaved = false
  private streetSaved = false

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
    this.renderer.toneMappingExposure = 1.35

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a32)
    this.scene.fog = new THREE.FogExp2(0x1a1a32, 0.008)

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
      onContinue: () => this.continueGame(),
      onStart: () => this.startGame(),
      onSettings: () => this.goToSettings(),
      onExit: () => this.handleExit()
    })
    this.settingsPanel = new SettingsPanel(this.uiRoot, () => this.goToMenu())
    this.hud = new InGameHUD(this.uiRoot, () => this.togglePause())
    this.orientation = new OrientationGate(this.uiRoot)
    this.introVideo = new IntroVideo(this.uiRoot, () => this.afterIntroVideo(), () => { this.renderingPaused = true })
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
    this.menu.hide()
    this.settingsPanel.hide()
    this.intro.hide()
    this.hidePauseOverlay()
    this.input.setEnabled(false)
    // Play intro video then enter game
    this.introVideo.play()
  }

  private afterIntroVideo() {
    this.renderingPaused = false
    this.state = 'playing'
    this.hud.show()
    this.input.setEnabled(true)
    this.player.sitAt(-3.5, -3.4, Math.PI * 0.15)
    this.player.setGroundY(0)
    this.showStandHint()
    saveSystem.save({
      checkpoint: 'start',
      position: { x: -3.5, y: 1.05, z: -3.4 },
      yaw: Math.PI * 0.15,
      completed: { introSeen: true, leftHouse: false, reachedStreet: false }
    })
  }

  private continueGame() {
    if (this.orientation.isBlocking()) return
    const s = saveSystem.load()
    if (!s) {
      this.startGame()
      return
    }
    this.menu.hide()
    this.settingsPanel.hide()
    this.intro.hide()
    this.hidePauseOverlay()
    this.renderingPaused = false
    this.state = 'playing'
    this.hud.show()
    this.input.setEnabled(true)
    this.player.sitting = false
    this.player.position.set(s.position.x, s.position.y, s.position.z)
    this.player.yaw = s.yaw
    this.player.pitch = 0
    this.player.setGroundY(0)
    this.hideStandHint()
    this.leftHouseSaved = s.completed.leftHouse
    this.streetSaved = s.completed.reachedStreet
    if (s.completed.leftHouse) {
      // Door should be open if already left
      if (!this.door.isOpened) this.door.toggle()
    }
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
    const ambient = new THREE.AmbientLight(0x6a7090, 0.65)
    this.scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xc0d0e8, 0.7)
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

    const hemi = new THREE.HemisphereLight(0x5a6a90, 0x3a3040, 0.5)
    this.scene.add(hemi)

    this.createRoom()
    this.createStreet()
    this.createDoor()
    this.createFlag()
    this.createPoliceBlockade()
    this.createStars()
    this.createWorldBounds()

    this.player.position.set(0, 1.6, 1.2)
    this.input.setEnabled(false)
  }


  private createRoom() {
    // Larger house ~12 x 12
    const roomSize = 12
    const half = roomSize / 2

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.7, metalness: 0.04 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomSize), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0.01, 0)
    floor.receiveShadow = true
    this.scene.add(floor)

    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf5eee4, roughness: 0.9 })
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomSize + 0.2, roomSize + 0.2), ceilMat)
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = 4.2
    this.scene.add(ceiling)

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe0d4c4, roughness: 0.88, metalness: 0.02 })
    const wallH = 4.2
    const wallT = 0.22

    // Back / sides
    this.addWall(0, wallH / 2, -half, roomSize + 0.3, wallH, wallT, wallMat)
    this.addWall(-half, wallH / 2, 0, wallT, wallH, roomSize + 0.3, wallMat)
    this.addWall(half, wallH / 2, 0, wallT, wallH, roomSize + 0.3, wallMat)
    // Front with door gap |x| < 0.85
    this.addBox(-3.5, wallH / 2, half, 5.0, wallH, wallT, wallMat)
    this.addCollider(-3.5, half, 2.4, 0.14)
    this.addBox(3.5, wallH / 2, half, 5.0, wallH, wallT, wallMat)
    this.addCollider(3.5, half, 2.4, 0.14)

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a3224, roughness: 0.55 })
    this.addBox(-0.75, 1.25, half - 0.05, 0.18, 2.5, 0.22, frameMat)
    this.addBox(0.75, 1.25, half - 0.05, 0.18, 2.5, 0.22, frameMat)
    this.addBox(0, 2.55, half - 0.05, 1.7, 0.18, 0.22, frameMat)

    // Living area – sofa facing TV
    createRealisticSofa(this.scene, 3.2, 1.5)
    this.addCollider(3.2, 1.5, 1.15, 0.55)
    createRealisticTV(this.scene, 3.2, -4.5)
    this.addCollider(3.2, -4.5, 0.9, 0.4)
    this.addNewsScreen(3.2, 0.95, -4.42)

    // Bedroom corner
    createRealisticBed(this.scene, -3.5, -3.5)
    this.addCollider(-3.5, -3.5, 1.2, 0.85)
    createRealisticWardrobe(this.scene, -5.0, -1.0)
    this.addCollider(-5.0, -1.0, 0.7, 0.4)

    // Desk + chair
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.6 })
    this.addBox(-3.5, 0.4, 3.5, 1.4, 0.08, 0.6, wood)
    this.addBox(-4.1, 0.2, 3.5, 0.07, 0.4, 0.07, wood)
    this.addBox(-2.9, 0.2, 3.5, 0.07, 0.4, 0.07, wood)
    this.addCollider(-3.5, 3.5, 0.8, 0.4)
    createRealisticChair(this.scene, -3.5, 2.8, 0)

    // === Kitchen (left-front) ===
    this.createKitchen(-4.2, 4.2)

    // Window
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88aacc, roughness: 0.25, metalness: 0.05,
      emissive: 0x445566, emissiveIntensity: 0.2, transparent: true, opacity: 0.5, depthWrite: false
    })
    this.addBox(-half + 0.08, 1.8, -1.5, 0.06, 1.4, 2.2, glassMat)

    // Ceiling lamp – strong actual illumination
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd8d0b0, metalness: 0.65, roughness: 0.3 })
    this.addBox(0, 3.95, 0, 0.08, 0.25, 0.08, chrome)
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffe8b0, emissiveIntensity: 1.4, roughness: 0.35 })
    )
    bulb.position.set(0, 3.65, 0)
    this.scene.add(bulb)
    const mainLight = new THREE.PointLight(0xfff2dc, 2.8, 18, 1.2)
    mainLight.position.set(0, 3.5, 0)
    mainLight.castShadow = true
    this.scene.add(mainLight)
    // Secondary fill so corners are lit
    const fill = new THREE.PointLight(0xffe8c8, 1.2, 14, 1.5)
    fill.position.set(3, 3.2, -2)
    this.scene.add(fill)
    const fill2 = new THREE.PointLight(0xffe8c8, 1.0, 12, 1.5)
    fill2.position.set(-3, 3.2, 2)
    this.scene.add(fill2)
  }

  private createKitchen(cx: number, cz: number) {
    const counter = new THREE.MeshStandardMaterial({ color: 0xd8d0c4, roughness: 0.55 })
    const cabinet = new THREE.MeshStandardMaterial({ color: 0x6a5040, roughness: 0.6 })
    const steel = new THREE.MeshStandardMaterial({ color: 0xb0b8c0, metalness: 0.65, roughness: 0.3 })
    // Counter L-shape
    this.addBox(cx, 0.45, cz, 2.8, 0.9, 0.65, cabinet)
    this.addCollider(cx, cz, 1.5, 0.4)
    this.addBox(cx, 0.92, cz, 2.8, 0.06, 0.68, counter)
    // Upper cabinets
    this.addBox(cx, 2.4, cz - 0.1, 2.8, 0.7, 0.4, cabinet)
    // Sink
    this.addBox(cx - 0.6, 0.95, cz + 0.05, 0.5, 0.08, 0.4, steel)
    // Stove
    this.addBox(cx + 0.7, 0.96, cz + 0.05, 0.55, 0.05, 0.45, steel)
    for (const ox of [-0.12, 0.12]) {
      for (const oz of [-0.1, 0.1]) {
        const burner = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12),
          new THREE.MeshStandardMaterial({ color: 0x222228 })
        )
        burner.position.set(cx + 0.7 + ox, 1.0, cz + 0.05 + oz)
        this.scene.add(burner)
      }
    }
    // Fridge
    this.addBox(cx - 1.8, 1.0, cz + 0.9, 0.7, 2.0, 0.7, steel)
    this.addCollider(cx - 1.8, cz + 0.9, 0.45, 0.45)
  }

  private addNewsScreen(x: number, y: number, z: number) {
    // Procedural "شبکه خبر" style screen
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 288
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#0a1a30'
    ctx.fillRect(0, 0, 512, 288)
    ctx.fillStyle = '#c41e3a'
    ctx.fillRect(0, 0, 512, 42)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px Tahoma, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('شبکه خبر', 256, 30)
    ctx.fillStyle = '#1a3050'
    ctx.fillRect(20, 60, 300, 180)
    ctx.fillStyle = '#2a5080'
    ctx.fillRect(340, 60, 150, 80)
    ctx.fillStyle = '#e8e8f0'
    ctx.font = '18px Tahoma, sans-serif'
    ctx.fillText('اخبار ساعت ۲۱', 256, 270)
    ctx.fillStyle = '#8899aa'
    ctx.font = '14px Tahoma, sans-serif'
    ctx.fillText('IRINN', 410, 105)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.55,
      roughness: 0.35
    })
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.7), mat)
    screen.position.set(x, y, z)
    this.scene.add(screen)
  }


  private createStreet() {
    // Wider street extending further left (negative X) and right
    const streetMat = new THREE.MeshStandardMaterial({ color: 0x2e2e32, roughness: 0.92, metalness: 0.06 })
    const street = new THREE.Mesh(new THREE.PlaneGeometry(120, 20), streetMat)
    street.rotation.x = -Math.PI / 2
    street.position.set(-10, 0, 11)
    street.receiveShadow = true
    this.scene.add(street)

    const sideMat = new THREE.MeshStandardMaterial({ color: 0x5a5650, roughness: 0.85 })
    this.addBox(0, 0.05, 7.8, 28, 0.1, 3.5, sideMat)

    const colors = [0x6a5a4a, 0x4a3a35, 0x5a4a40, 0x3a3028, 0x7a6a58]

    // Opposite side dense buildings
    for (let i = -6; i <= 6; i++) {
      const x = i * 5.2
      const h = 4.5 + (Math.abs(i) % 3) * 1.2
      const mat = new THREE.MeshStandardMaterial({ color: colors[(i + 6) % colors.length], roughness: 0.85 })
      this.addBox(x, h / 2, 17, 5.0, h, 5.5, mat)
      this.addCollider(x, 17, 2.6, 2.9)
      const winMat = new THREE.MeshStandardMaterial({
        color: 0x1a2230, emissive: 0x334455, emissiveIntensity: 0.45 + (i % 2) * 0.2
      })
      for (let wy = 1.3; wy < h - 0.7; wy += 1.5) {
        this.addBox(x - 1.2, wy, 14.2, 0.9, 0.85, 0.08, winMat)
        this.addBox(x + 1.2, wy, 14.2, 0.9, 0.85, 0.08, winMat)
      }
    }

    // Our side buildings (dense, gap only for our house)
    for (let i = -5; i <= 5; i++) {
      if (Math.abs(i) <= 1) continue
      const x = i * 5.5
      const h = 3.5 + (Math.abs(i) % 2) * 1.5
      const mat = new THREE.MeshStandardMaterial({ color: colors[(i + 5) % colors.length], roughness: 0.85 })
      this.addBox(x, h / 2, 0.5, 5.2, h, 5, mat)
      this.addCollider(x, 0.5, 2.7, 2.6)
    }

    // Road markings
    const markMat = new THREE.MeshStandardMaterial({ color: 0xa09860, roughness: 0.9 })
    for (let i = -7; i <= 7; i++) {
      this.addBox(i * 5.5, 0.03, 10, 2.0, 0.02, 0.3, markMat)
    }

    // Street lights – warm glow that actually lights the road
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, metalness: 0.5, roughness: 0.45 })
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffe8b0, emissive: 0xffd080, emissiveIntensity: 2.0, roughness: 0.25
    })
    for (let i = -6; i <= 5; i++) {
      const x = i * 7
      this.addBox(x, 2.4, 7.5, 0.12, 4.8, 0.12, poleMat)
      this.addBox(x + 0.4, 4.7, 7.5, 0.85, 0.07, 0.07, poleMat)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), bulbMat)
      bulb.position.set(x + 0.75, 4.55, 7.5)
      this.scene.add(bulb)
      // Stronger lights to illuminate street naturally
      const pl = new THREE.PointLight(0xffe2b0, 2.4, 18, 1.3)
      pl.position.set(x + 0.75, 4.4, 7.5)
      this.scene.add(pl)
      // Soft ground bounce feel
      const pl2 = new THREE.PointLight(0xffd8a0, 0.7, 10, 1.8)
      pl2.position.set(x + 0.75, 1.5, 9)
      this.scene.add(pl2)
    }
  }


  private createPoliceBlockade() {
    // Iranian police Samand angled to fully block the RIGHT side of the street
    createPoliceSamand(this.scene, 13, 10, -1.05)
    // Two NAJA-style officers in front of the car
    createPoliceOfficer(this.scene, 10.5, 9.2, Math.PI * 0.85)
    createPoliceOfficer(this.scene, 11.2, 11.0, Math.PI * 1.1)
    const sirens = createSirenLights(this.scene, 13, 1.75, 10)
    this.sirenMeshes.push(...sirens.meshes)
    this.sirenLights.push(...sirens.lights)
    // Wide collider blocking right road
    this.addCollider(13, 10, 5.0, 4.0)
    this.addCollider(11, 10, 2.5, 3.5)
  }

  private createStars() {
    const count = 600
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.45 // upper hemisphere
      const r = 40 + Math.random() * 50
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 8
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.18,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    })
    const stars = new THREE.Points(geo, mat)
    this.scene.add(stars)

    // Soft moon
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe8e0c8 })
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), moonMat)
    moon.position.set(-18, 28, -25)
    this.scene.add(moon)
    const moonLight = new THREE.DirectionalLight(0xaabbdd, 0.25)
    moonLight.position.copy(moon.position)
    this.scene.add(moonLight)
  }


  private createWorldBounds() {
    // Only outer map edges – do NOT block left street travel
    const walls: Array<[number, number, number, number]> = [
      [-40, 10, 1.5, 24],   // far left outer
      [28, 10, 1.5, 24],    // far right (past police)
      [0, 24, 45, 1.5],     // behind opposite buildings
      [0, -8, 18, 1.0],     // behind house
    ]
    for (const [x, z, hw, hd] of walls) {
      this.addCollider(x, z, hw, hd)
    }
  }

  private createDoor() {
    this.door = new Door(this.scene, 0, 0, 6.0, 2.5)
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
        flag.position.set(0, 2.5, -5.88)
        this.scene.add(flag)
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8),
          new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.5 })
        )
        rod.rotation.z = Math.PI / 2
        rod.position.set(0, 3.05, -5.88)
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
    if (this.renderingPaused) return
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

      // Auto-save checkpoints
      const pz = this.player.position.z
      const px = this.player.position.x
      if (!this.leftHouseSaved && pz > 7.0) {
        this.leftHouseSaved = true
        saveSystem.save({
          checkpoint: 'left_house',
          position: { x: px, y: this.player.position.y, z: pz },
          yaw: this.player.yaw,
          completed: { introSeen: true, leftHouse: true, reachedStreet: false }
        })
      }
      if (!this.streetSaved && pz > 10.0) {
        this.streetSaved = true
        saveSystem.save({
          checkpoint: 'street',
          position: { x: px, y: this.player.position.y, z: pz },
          yaw: this.player.yaw,
          completed: { introSeen: true, leftHouse: true, reachedStreet: true }
        })
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
    this.introVideo.destroy()
    this.hidePauseOverlay()
    this.hideInteractHint()
    this.hideStandHint()
    audio.stopAmbient()
    this.renderer.dispose()
  }
}
