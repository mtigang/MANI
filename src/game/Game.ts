import * as THREE from 'three'
import { InputManager } from './systems/InputManager'
import { PlayerController } from './systems/PlayerController'
import { resolveAABB, AABB } from './systems/Collision'
import { Door } from './systems/Door'
import { createRealisticBed, createRealisticSofa, createRealisticTV, createRealisticWardrobe, createRealisticChair } from './systems/Furniture'
import { createPoliceSamand, createPoliceOfficer, createSirenLights } from './systems/Police'
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
    // Wide street + sidewalks both sides
    const streetMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.92 })
    const street = new THREE.Mesh(new THREE.PlaneGeometry(70, 16), streetMat)
    street.rotation.x = -Math.PI / 2
    street.position.set(0, 0, 14)
    street.receiveShadow = true
    this.scene.add(street)

    const sideMat = new THREE.MeshStandardMaterial({ color: 0x5c5852, roughness: 0.85 })
    // Sidewalk near house
    this.addBox(0, 0.06, 8.2, 40, 0.12, 3.6, sideMat)
    // Far sidewalk
    this.addBox(0, 0.06, 20.5, 40, 0.12, 3.0, sideMat)

    // Road markings
    const markMat = new THREE.MeshStandardMaterial({ color: 0xb0a870, roughness: 0.9 })
    for (let i = -5; i <= 5; i++) {
      this.addBox(i * 5, 0.03, 14, 2.2, 0.02, 0.28, markMat)
    }

    // Dense tall buildings – opposite side (z high)
    const colors = [0x6a5a4c, 0x4a4038, 0x5a4e44, 0x3e3830, 0x7a6a5a, 0x554840]
    for (let i = -5; i <= 5; i++) {
      const x = i * 5.5
      const h = 8 + (Math.abs(i) % 4) * 2.2
      const mat = new THREE.MeshStandardMaterial({ color: colors[(i + 5) % colors.length], roughness: 0.82 })
      this.addBox(x, h / 2, 24, 5.3, h, 6, mat)
      this.addCollider(x, 24, 2.7, 3.2)
      // Windows grid
      const winMat = new THREE.MeshStandardMaterial({
        color: 0x1a2230, emissive: 0x3a4a20, emissiveIntensity: 0.25 + (i % 3) * 0.15
      })
      for (let wy = 1.5; wy < h - 1; wy += 2.0) {
        for (const wx of [-1.4, 0, 1.4]) {
          this.addBox(x + wx, wy, 20.95, 0.7, 0.9, 0.06, winMat)
        }
      }
    }

    // Our side buildings (taller, leave gap for house)
    for (let i = -5; i <= 5; i++) {
      if (Math.abs(i) <= 1) continue
      const x = i * 5.8
      const h = 7 + (Math.abs(i) % 3) * 2.5
      const mat = new THREE.MeshStandardMaterial({ color: colors[(i + 6) % colors.length], roughness: 0.84 })
      this.addBox(x, h / 2, 1.0, 5.5, h, 7, mat)
      this.addCollider(x, 1.0, 2.85, 3.6)
      const winMat = new THREE.MeshStandardMaterial({
        color: 0x1a2030, emissive: 0x2a3550, emissiveIntensity: 0.3
      })
      for (let wy = 1.4; wy < h - 1; wy += 1.9) {
        this.addBox(x - 1.2, wy, 4.4, 0.75, 0.85, 0.06, winMat)
        this.addBox(x + 1.2, wy, 4.4, 0.75, 0.85, 0.06, winMat)
      }
    }

    // Street lamps BOTH sidewalks – fewer, stronger (perf: max 8 lights)
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, metalness: 0.5, roughness: 0.45 })
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffe8b0, emissive: 0xffd080, emissiveIntensity: 2.2, roughness: 0.25
    })
    const lampXs = [-18, -9, 0, 9, 18]
    for (const x of lampXs) {
      // Near sidewalk (not in front of door – offset z)
      const zNear = 7.0
      if (Math.abs(x) > 3) { // skip center so door exit is clear
        this.addBox(x, 2.5, zNear, 0.1, 5.0, 0.1, poleMat)
        this.addBox(x + 0.35, 4.9, zNear, 0.7, 0.06, 0.06, poleMat)
        const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), bulbMat)
        b1.position.set(x + 0.6, 4.8, zNear)
        this.scene.add(b1)
        const pl = new THREE.PointLight(0xffe2b0, 2.0, 16, 1.4)
        pl.position.set(x + 0.6, 4.7, zNear)
        this.scene.add(pl)
      }
      // Far sidewalk
      const zFar = 20.2
      this.addBox(x, 2.5, zFar, 0.1, 5.0, 0.1, poleMat)
      this.addBox(x - 0.35, 4.9, zFar, 0.7, 0.06, 0.06, poleMat)
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), bulbMat)
      b2.position.set(x - 0.6, 4.8, zFar)
      this.scene.add(b2)
      const pl2 = new THREE.PointLight(0xffe2b0, 1.8, 14, 1.4)
      pl2.position.set(x - 0.6, 4.7, zFar)
      this.scene.add(pl2)
    }
  }



  private createPoliceBlockade() {
    // TWO police cars fully blocking the LEFT end of the street – face toward player (house)
    // Cars angled across road at negative X
    createPoliceSamand(this.scene, -16, 13.5, 0.55)
    createPoliceSamand(this.scene, -15.5, 16.0, 0.85)

    // Officers face the player (toward +X / house side) → rotY ≈ Math.PI / 2 or face center
    createPoliceOfficer(this.scene, -13.5, 13.0, Math.PI * 0.5)
    createPoliceOfficer(this.scene, -13.2, 15.5, Math.PI * 0.45)
    createPoliceOfficer(this.scene, -14.0, 14.2, Math.PI * 0.55)

    const s1 = createSirenLights(this.scene, -16, 1.8, 13.5)
    const s2 = createSirenLights(this.scene, -15.5, 1.8, 16.0)
    this.sirenMeshes.push(...s1.meshes, ...s2.meshes)
    this.sirenLights.push(...s1.lights, ...s2.lights)

    // Solid wall of colliders – cannot go around
    this.addCollider(-16, 14.5, 5.5, 6.0)
    this.addCollider(-18, 14.5, 3.0, 8.0)
    this.addCollider(-14, 12.0, 3.0, 2.5)
    this.addCollider(-14, 17.5, 3.0, 2.5)
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
    // Close the map completely – no void visible
    const walls: Array<[number, number, number, number]> = [
      // Left blockade (behind police)
      [-22, 14, 2.0, 14],
      // Right end of street
      [24, 14, 2.0, 14],
      // Far behind opposite buildings
      [0, 30, 50, 2.0],
      // Behind house
      [0, -9, 20, 1.5],
      // Side walls full length
      [-22, 0, 2.0, 20],
      [24, 0, 2.0, 20],
    ]
    for (const [x, z, hw, hd] of walls) {
      this.addCollider(x, z, hw, hd)
    }

    // End-cap buildings so void is not visible at street ends
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 0.85 })
    this.addBox(-24, 6, 14, 8, 12, 20, mat)
    this.addBox(26, 6, 14, 8, 12, 20, mat)
    this.addBox(0, 5, 32, 55, 10, 6, mat)
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
      const surface = this.player.position.z < 6.8 ? 'wood' as const : 'street' as const
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
