import * as THREE from 'three'
import { InputManager } from './systems/InputManager'
import { PlayerController } from './systems/PlayerController'
import { resolveAABB, AABB } from './systems/Collision'
import { Door } from './systems/Door'
import { createRealisticBed, createRealisticSofa, createRealisticTV, createRealisticWardrobe, createRealisticChair } from './systems/Furniture'
import { createPoliceSamand, createPoliceOfficer, createSirenLights, updateOfficer, OfficerHandle } from './systems/Police'
import { addDetailedBuilding } from './systems/Buildings'
import { settings } from './core/Settings'
import { detectDevice } from './core/Device'
import { audio, FootSurface } from './core/AudioManager'
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
  private officers: OfficerHandle[] = []
  private policeWarned = false
  private policeHint: HTMLDivElement | null = null
  private renderingPaused = false
  private leftHouseSaved = false
  private streetSaved = false

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.device === 'mobile' ? 1.25 : 1.5))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = this.device !== 'mobile'
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.35

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x12122a)
    this.scene.fog = new THREE.FogExp2(0x12122a, 0.022)

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 80)

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
    audio.stopAmbient()
    this.state = 'playing'
    this.hud.show()
    this.input.setEnabled(true)
    this.player.sitAt(-3.8, -3.7, Math.PI * 0.15)
    this.player.setGroundY(0)
    this.showStandHint()
    saveSystem.save({
      checkpoint: 'start',
      position: { x: -3.8, y: 1.05, z: -3.7 },
      yaw: Math.PI * 0.15,
      completed: { introSeen: true, leftHouse: false, reachedStreet: false }
    })
  }

  private continueGame() {
    if (this.orientation.isBlocking()) return
    audio.stopAmbient()
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
    const ambient = new THREE.AmbientLight(0x5a6080, 0.55)
    this.scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xc0d0e8, 0.7)
    dir.position.set(10, 20, 8)
    dir.castShadow = true
    dir.shadow.mapSize.set(this.device === 'mobile' ? 512 : 1024, this.device === 'mobile' ? 512 : 1024)
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
    const roomSize = 12
    const half = roomSize / 2

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x8b6b48, roughness: 0.68, metalness: 0.04 })
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

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.88 })
    const wallH = 4.2
    const wallT = 0.22

    this.addWall(0, wallH / 2, -half, roomSize + 0.3, wallH, wallT, wallMat)
    this.addWall(-half, wallH / 2, 0, wallT, wallH, roomSize + 0.3, wallMat)
    this.addWall(half, wallH / 2, 0, wallT, wallH, roomSize + 0.3, wallMat)
    this.addBox(-3.5, wallH / 2, half, 5.0, wallH, wallT, wallMat)
    this.addCollider(-3.5, half, 2.4, 0.14)
    this.addBox(3.5, wallH / 2, half, 5.0, wallH, wallT, wallMat)
    this.addCollider(3.5, half, 2.4, 0.14)

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a3224, roughness: 0.55 })
    this.addBox(-0.75, 1.25, half - 0.05, 0.18, 2.5, 0.22, frameMat)
    this.addBox(0.75, 1.25, half - 0.05, 0.18, 2.5, 0.22, frameMat)
    this.addBox(0, 2.55, half - 0.05, 1.7, 0.18, 0.22, frameMat)

    // Living: 4 sofas around center coffee table
    createRealisticSofa(this.scene, 1.8, 0.2)
    this.addCollider(1.8, 0.2, 1.1, 0.55)
    createRealisticSofa(this.scene, -1.8, 0.2)
    this.addCollider(-1.8, 0.2, 1.1, 0.55)
    // rotate two sofas via nested groups would need API – place facing table as side seats using chairs+sofa mix
    createRealisticSofa(this.scene, 0, 2.0)
    this.addCollider(0, 2.0, 1.1, 0.55)
    createRealisticSofa(this.scene, 0, -1.6)
    this.addCollider(0, -1.6, 1.1, 0.55)
    // Coffee table center
    const tableWood = new THREE.MeshStandardMaterial({ color: 0x5a3e2b, roughness: 0.5 })
    this.addBox(0, 0.35, 0.2, 1.4, 0.08, 0.9, tableWood)
    this.addBox(0, 0.18, 0.2, 0.12, 0.35, 0.12, tableWood)
    this.addCollider(0, 0.2, 0.8, 0.55)

    // TV wall
    createRealisticTV(this.scene, 4.2, -2.5)
    this.addCollider(4.2, -2.5, 0.9, 0.4)
    this.addNewsScreen(4.2, 0.95, -2.42)

    // Bedroom
    createRealisticBed(this.scene, -3.8, -3.8)
    this.addCollider(-3.8, -3.8, 1.2, 0.85)
    createRealisticWardrobe(this.scene, -5.2, -1.2)
    this.addCollider(-5.2, -1.2, 0.7, 0.4)

    // Desk
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.6 })
    this.addBox(-4.0, 0.4, 3.8, 1.4, 0.08, 0.6, wood)
    this.addCollider(-4.0, 3.8, 0.8, 0.4)
    createRealisticChair(this.scene, -4.0, 3.1, 0)

    this.createKitchen(-4.5, 4.5)

    // Window
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88aacc, roughness: 0.25, emissive: 0x445566, emissiveIntensity: 0.25,
      transparent: true, opacity: 0.5, depthWrite: false
    })
    this.addBox(-half + 0.08, 1.9, -1.2, 0.06, 1.5, 2.4, glassMat)

    // Ceiling lamp – one strong light only (perf)
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd8d0b0, metalness: 0.65, roughness: 0.3 })
    this.addBox(0, 3.95, 0, 0.08, 0.25, 0.08, chrome)
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffe8b0, emissiveIntensity: 1.6, roughness: 0.3 })
    )
    bulb.position.set(0, 3.6, 0)
    this.scene.add(bulb)
    const mainLight = new THREE.PointLight(0xfff2dc, 3.2, 20, 1.15)
    mainLight.position.set(0, 3.45, 0)
    mainLight.castShadow = this.device !== 'mobile'
    this.scene.add(mainLight)
  }

  private createKitchen(cx: number, cz: number) {
    const counter = new THREE.MeshStandardMaterial({ color: 0xe0d8cc, roughness: 0.5 })
    const cabinet = new THREE.MeshStandardMaterial({ color: 0x6b5344, roughness: 0.58 })
    const steel = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.7, roughness: 0.28 })
    // Counter run
    this.addBox(cx, 0.45, cz, 3.2, 0.9, 0.7, cabinet)
    this.addCollider(cx, cz, 1.7, 0.45)
    this.addBox(cx, 0.92, cz, 3.2, 0.06, 0.72, counter)
    // Upper cabinets
    this.addBox(cx, 2.5, cz - 0.12, 3.2, 0.75, 0.42, cabinet)
    // Sink
    this.addBox(cx - 0.8, 0.95, cz + 0.05, 0.55, 0.08, 0.42, steel)
    // Faucet
    this.addBox(cx - 0.8, 1.15, cz - 0.1, 0.05, 0.35, 0.05, steel)
    // Stove
    this.addBox(cx + 0.6, 0.96, cz + 0.05, 0.6, 0.05, 0.48, steel)
    for (const ox of [-0.14, 0.14]) {
      for (const oz of [-0.1, 0.1]) {
        const burner = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10),
          new THREE.MeshStandardMaterial({ color: 0x222228 })
        )
        burner.position.set(cx + 0.6 + ox, 1.0, cz + 0.05 + oz)
        this.scene.add(burner)
      }
    }
    // Fridge
    this.addBox(cx - 2.0, 1.05, cz + 1.0, 0.75, 2.1, 0.75, steel)
    this.addCollider(cx - 2.0, cz + 1.0, 0.48, 0.48)
    // Fridge handle
    this.addBox(cx - 1.6, 1.1, cz + 1.38, 0.04, 0.35, 0.04, new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 }))
  }

  private addNewsScreen(x: number, y: number, z: number) {
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
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.35
    })
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.7), mat)
    screen.position.set(x, y, z)
    this.scene.add(screen)
  }



  private createStreet() {
    // Continuous ground plane – no holes
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a3834, roughness: 0.95 })
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 60), groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.set(5, -0.02, 12)
    ground.receiveShadow = true
    this.scene.add(ground)

    // Wide asphalt street running left–right (X axis)
    const streetMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.92 })
    const street = new THREE.Mesh(new THREE.PlaneGeometry(90, 14), streetMat)
    street.rotation.x = -Math.PI / 2
    street.position.set(5, 0.01, 14)
    street.receiveShadow = true
    this.scene.add(street)

    // Sidewalks both sides full length
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x6a6660, roughness: 0.85 })
    this.addBox(5, 0.07, 8.5, 90, 0.12, 3.2, sideMat)   // near house
    this.addBox(5, 0.07, 20.2, 90, 0.12, 3.0, sideMat)  // far side

    // Center road dashes
    const markMat = new THREE.MeshStandardMaterial({ color: 0xb0a870, roughness: 0.9 })
    for (let i = -6; i <= 8; i++) {
      this.addBox(i * 5, 0.04, 14, 2.2, 0.02, 0.28, markMat)
    }

    // === Opposite side (north) dense buildings – continuous row ===
    for (let i = -6; i <= 8; i++) {
      const x = i * 5.6
      const floors = 3 + (Math.abs(i) % 4)
      addDetailedBuilding(this.scene, this.colliders, x, 24.5, 5.2, 6.5, floors, i + 3)
    }

    // === Our side buildings – continuous except house gap ===
    for (let i = -6; i <= 8; i++) {
      if (i >= -1 && i <= 1) continue // player house gap
      const x = i * 5.8
      const floors = 2 + (Math.abs(i) % 3)
      addDetailedBuilding(this.scene, this.colliders, x, 0.8, 5.4, 6.5, floors, i + 5)
    }

    // Fill alley gaps between our house (±6) and neighbors with courtyard walls / small structures
    // Left neighbor courtyard wall
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.85 })
    this.addBox(-8.5, 1.2, 3.5, 0.25, 2.4, 8, wallMat)
    this.addCollider(-8.5, 3.5, 0.25, 4.2)
    this.addBox(8.5, 1.2, 3.5, 0.25, 2.4, 8, wallMat)
    this.addCollider(8.5, 3.5, 0.25, 4.2)
    // Small yard sheds
    this.addBox(-7.2, 0.9, 2.0, 2.0, 1.8, 2.5, wallMat)
    this.addCollider(-7.2, 2.0, 1.1, 1.4)
    this.addBox(7.2, 0.9, 2.0, 2.0, 1.8, 2.5, wallMat)
    this.addCollider(7.2, 2.0, 1.1, 1.4)

    // Street lamps both sidewalks (not blocking door at x≈0)
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, metalness: 0.5, roughness: 0.45 })
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffe8b0, emissive: 0xffd080, emissiveIntensity: 2.0, roughness: 0.25
    })
    for (const x of [-20, -12, -6, 6, 12, 20, 28]) {
      for (const [z, side] of [[7.2, 1], [20.0, -1]] as const) {
        this.addBox(x, 2.5, z, 0.1, 5.0, 0.1, poleMat)
        this.addBox(x + side * 0.4, 4.9, z, 0.7, 0.06, 0.06, poleMat)
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), bulbMat)
        bulb.position.set(x + side * 0.65, 4.8, z)
        this.scene.add(bulb)
        const pl = new THREE.PointLight(0xffe2b0, 1.7, 14, 1.45)
        pl.position.set(x + side * 0.65, 4.7, z)
        this.scene.add(pl)
      }
    }

    // LEFT path continues toward crowd gathering (negative X open)
    this.createCrowdArea(-32, 14)
  }

  private createCrowdArea(cx: number, cz: number) {
    // Open plaza / gathering zone to the left
    const plaza = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 16),
      new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.88 })
    )
    plaza.rotation.x = -Math.PI / 2
    plaza.position.set(cx, 0.02, cz)
    plaza.receiveShadow = true
    this.scene.add(plaza)

    // Simple crowd silhouettes (low-poly people)
    const bodyM = new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.8 })
    const skinM = new THREE.MeshStandardMaterial({ color: 0xb09070, roughness: 0.7 })
    for (let i = 0; i < 14; i++) {
      const px = cx + (Math.random() - 0.5) * 14
      const pz = cz + (Math.random() - 0.5) * 10
      const h = 1.55 + Math.random() * 0.25
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, h * 0.45, 4, 6), bodyM)
      body.position.set(px, h * 0.55, pz)
      this.scene.add(body)
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), skinM)
      head.position.set(px, h * 0.95, pz)
      this.scene.add(head)
    }

    // Backdrop buildings around plaza so no void
    for (let i = 0; i < 5; i++) {
      addDetailedBuilding(this.scene, this.colliders, cx - 12, cz - 8 + i * 5, 5, 5, 3 + (i % 2), i)
      addDetailedBuilding(this.scene, this.colliders, cx + 10, cz - 8 + i * 5, 5, 5, 4, i + 2)
    }
    addDetailedBuilding(this.scene, this.colliders, cx, cz - 12, 8, 5, 3, 1)
  }



  private createPoliceBlockade() {
    // RIGHT side of street – officers + cars block path, street continues behind them visually
    // Cars parked across the road facing player (toward -X / house)
    createPoliceSamand(this.scene, 18, 13.2, -Math.PI * 0.5 + 0.15)
    createPoliceSamand(this.scene, 18.5, 16.0, -Math.PI * 0.5 - 0.2)

    // Officers face the player (looking toward negative X ≈ rotY = -PI/2 or PI/2)
    // Player comes from smaller X, so officers should face -X direction → rotation.y = Math.PI / 2
    this.officers = [
      createPoliceOfficer(this.scene, 15.5, 12.8, Math.PI * 0.5),
      createPoliceOfficer(this.scene, 15.8, 14.5, Math.PI * 0.5),
      createPoliceOfficer(this.scene, 15.2, 16.2, Math.PI * 0.55),
      createPoliceOfficer(this.scene, 16.5, 15.0, Math.PI * 0.45),
    ]

    const s1 = createSirenLights(this.scene, 18, 1.8, 13.2)
    const s2 = createSirenLights(this.scene, 18.5, 1.8, 16.0)
    this.sirenMeshes.push(...s1.meshes, ...s2.meshes)
    this.sirenLights.push(...s1.lights, ...s2.lights)

    // Collision ONLY around officers/cars – tight, no giant invisible wall
    this.addCollider(18, 14.5, 3.2, 4.5)   // cars
    this.addCollider(15.8, 14.5, 1.4, 3.2) // officers line
  }


  private createStars() {
    const count = 500
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.4
      const r = 55 + Math.random() * 40
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 35
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.22, sizeAttenuation: true,
      transparent: true, opacity: 0.9, depthWrite: false
    })
    this.scene.add(new THREE.Points(geo, mat))
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xe8e0c8 })
    )
    moon.position.set(-20, 45, -30)
    this.scene.add(moon)
  }




  private createWorldBounds() {
    // Soft outer limits only – no giant walls visible on street
    // Left is OPEN toward crowd; only far beyond plaza
    const walls: Array<[number, number, number, number]> = [
      [-48, 14, 2.0, 20],  // far past crowd
      [28, 14, 2.0, 12],   // past police (soft)
      [0, 32, 55, 1.5],    // behind north buildings
      [0, -10, 25, 1.5],   // behind house
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


  private updatePoliceProximity() {
    if (!this.officers.length) return
    let minDist = Infinity
    for (const o of this.officers) {
      const dx = this.player.position.x - o.group.position.x
      const dz = this.player.position.z - o.group.position.z
      minDist = Math.min(minDist, Math.sqrt(dx * dx + dz * dz))
    }
    if (minDist < 6) {
      this.showPoliceHint('ایست! این مسیر مسدود است')
      if (!this.policeWarned && minDist < 4.5) {
        this.policeWarned = true
        audio.playPoliceWarn()
      }
    } else {
      this.hidePoliceHint()
      if (minDist > 10) this.policeWarned = false
    }
  }

  private showPoliceHint(msg: string) {
    if (!this.policeHint) {
      this.policeHint = document.createElement('div')
      this.policeHint.style.cssText = `
        position:absolute;bottom:22%;left:50%;transform:translateX(-50%);
        background:rgba(20,10,10,0.82);border:1px solid rgba(230,57,70,0.55);
        border-radius:10px;padding:12px 24px;color:#f0e0e0;font-size:1rem;
        letter-spacing:0.04em;pointer-events:none;z-index:170;text-align:center;
      `
      this.uiRoot.appendChild(this.policeHint)
    }
    this.policeHint.textContent = msg
    this.policeHint.style.display = 'block'
  }

  private hidePoliceHint() {
    if (this.policeHint) this.policeHint.style.display = 'none'
  }

  private getFootSurface(): FootSurface {
    const { x, z } = this.player.position
    if (z < 6.5 && Math.abs(x) < 6.5) return 'ceramic'
    if (z > 6.8 && z < 10.2) return 'sidewalk'
    if (z > 18.5 && z < 22) return 'sidewalk'
    if (z >= 10.2 && z <= 18.5) return 'asphalt'
    return 'concrete'
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

    // Police idle + look-at
    if (this.state === 'playing') {
      for (const o of this.officers) updateOfficer(o, t, this.player.position)
      this.updatePoliceProximity()
    }

    // Siren animation
    if (this.sirenLights.length >= 2) {
      const pulse = (Math.sin(t * 8) + 1) * 0.5
      this.sirenLights[0].intensity = 2.5 + pulse * 4.5
      this.sirenLights[1].intensity = 2.5 + (1 - pulse) * 4.5
      if (this.sirenMeshes[0]) {
        (this.sirenMeshes[0].material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + pulse * 2.0
      }
      if (this.sirenMeshes[1]) {
        (this.sirenMeshes[1].material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + (1 - pulse) * 2.0
      }
    }

    if (this.state === 'playing' && !this.orientation.isBlocking()) {
      this.player.update(dt)
      // Footsteps: wood indoors (z < 6.5), street outside
      const surface = this.getFootSurface()
      audio.updateFootsteps(dt, this.player.isMoving, this.player.isRunning, surface)

      // Stand up from bed
      if (this.player.sitting) {
        if (this.input.state.jump) {
          this.player.standUp()
          this.hideStandHint()
          audio.playStand()
        }
      } else {
        resolveAABB(this.player.position, this.playerRadius, this.colliders)
        const doorBox = this.door.getCollisionAABB()
        if (doorBox) resolveAABB(this.player.position, this.playerRadius, [doorBox])

        this.door.update(dt)

        if (this.door.canInteract(this.player.position)) {
          const label = this.door.isOpened ? 'E  ·  بستن در' : 'E  ·  باز کردن در'
          this.showInteractHint(label)
          if (this.input.consumeInteract()) { this.door.toggle(); audio.playDoor() }
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
