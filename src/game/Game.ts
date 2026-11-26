import * as THREE from 'three'
import { InputManager } from './systems/InputManager'
import { PlayerController } from './systems/PlayerController'
import { resolveAABB, AABB } from './systems/Collision'
import { Door } from './systems/Door'
import { settings } from './core/Settings'
import { IntroScreen } from './ui/IntroScreen'
import { MainMenu } from './ui/MainMenu'
import { SettingsPanel } from './ui/SettingsPanel'
import { InGameHUD } from './ui/InGameHUD'
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
  private uiRoot: HTMLElement
  private pauseOverlay: HTMLDivElement | null = null
  private interactHint: HTMLDivElement | null = null

  private colliders: AABB[] = []
  private door!: Door
  private playerRadius = 0.35

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1520)
    this.scene.fog = new THREE.FogExp2(0x1a1520, 0.018)

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200)

    this.input = new InputManager(canvas)
    this.player = new PlayerController(this.input)

    settings.applyToRenderer(this.renderer)
    settings.onChange(() => settings.applyToRenderer(this.renderer))
    this.player.setSensitivity(settings.get().mouseSensitivity)
    settings.onChange(s => this.player.setSensitivity(s.mouseSensitivity))

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
  }

  private goToMenu() {
    this.state = 'menu'
    this.intro.hide()
    this.settingsPanel.hide()
    this.hud.hide()
    this.hidePauseOverlay()
    this.hideInteractHint()
    this.menu.show()
    this.input.setEnabled(false)
  }

  private goToSettings() {
    this.state = 'settings'
    this.menu.hide()
    this.settingsPanel.show()
  }

  private startGame() {
    this.state = 'playing'
    this.menu.hide()
    this.settingsPanel.hide()
    this.intro.hide()
    this.hidePauseOverlay()
    this.hud.show()
    this.input.setEnabled(true)
    this.player.position.set(0, 1.6, 1.2)
    this.player.yaw = 0
    this.player.pitch = 0
    this.player.setGroundY(0)
  }

  private handleExit() {
    this.state = 'intro'
    this.menu.hide()
    this.settingsPanel.hide()
    this.hud.hide()
    this.hidePauseOverlay()
    this.hideInteractHint()
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
        position:absolute;bottom:12%;left:50%;transform:translateX(-50%);
        background:rgba(10,10,18,0.7);backdrop-filter:blur(10px);
        border:1px solid rgba(230,57,70,0.4);border-radius:10px;
        padding:10px 20px;color:#f0f0f5;font-size:0.95rem;
        letter-spacing:0.05em;pointer-events:none;z-index:160;
      `
      this.uiRoot.appendChild(this.interactHint)
    }
    this.interactHint.textContent = text
    this.interactHint.style.display = 'block'
  }

  private hideInteractHint() {
    if (this.interactHint) this.interactHint.style.display = 'none'
  }

  async init() {
    const ambient = new THREE.AmbientLight(0x4a4058, 0.4)
    this.scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xffe8c8, 1.15)
    dir.position.set(12, 22, 8)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.near = 1
    dir.shadow.camera.far = 60
    dir.shadow.camera.left = -25
    dir.shadow.camera.right = 25
    dir.shadow.camera.top = 25
    dir.shadow.camera.bottom = -25
    dir.shadow.bias = -0.0003
    this.scene.add(dir)

    const hemi = new THREE.HemisphereLight(0x87a0c8, 0x3a2a20, 0.35)
    this.scene.add(hemi)

    this.createRoom()
    this.createStreet()
    this.createDoor()
    this.createFlag()

    this.player.position.set(0, 1.6, 1.2)
    this.input.setEnabled(false)
  }

  private createRoom() {
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x6b4e31, roughness: 0.75, metalness: 0.05 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0.01, 0)
    floor.receiveShadow = true
    this.scene.add(floor)

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xc4b09a, roughness: 0.88, metalness: 0.02 })
    const wallH = 3.2
    const wallT = 0.18

    // Walls + colliders
    // Back
    this.addWall(0, wallH / 2, -4, 8.2, wallH, wallT, wallMat)
    // Front left of door
    this.addWall(-2.6, wallH / 2, 4, 2.8, wallH, wallT, wallMat)
    // Front right of door
    this.addWall(2.6, wallH / 2, 4, 2.8, wallH, wallT, wallMat)
    // Left / Right
    this.addWall(-4, wallH / 2, 0, wallT, wallH, 8.2, wallMat)
    this.addWall(4, wallH / 2, 0, wallT, wallH, 8.2, wallMat)

    // Ceiling
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d5, roughness: 0.95 })
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 8.2), ceilMat)
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = wallH
    this.scene.add(ceiling)

    // Door frame (visual only)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.6 })
    this.addBox(0, 1.15, 3.92, 1.4, 2.35, 0.12, frameMat)

    // Furniture
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x3a6b7a, roughness: 0.7 })
    this.addBox(-2.2, 0.22, -2.4, 2.1, 0.44, 1.3, bedMat)
    this.addCollider(-2.2, -2.4, 1.15, 0.75)
    this.addBox(-2.2, 0.48, -2.4, 2.0, 0.12, 1.2, new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.85 }))

    const woodDark = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.65 })
    this.addBox(2.4, 0.4, -2.6, 1.6, 0.08, 0.7, woodDark)
    this.addBox(1.7, 0.2, -2.6, 0.08, 0.4, 0.08, woodDark)
    this.addBox(3.1, 0.2, -2.6, 0.08, 0.4, 0.08, woodDark)
    this.addCollider(2.4, -2.6, 0.9, 0.45)

    // Window
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xa8c8e0, roughness: 0.15, metalness: 0.1,
      emissive: 0x224466, emissiveIntensity: 0.25, transparent: true, opacity: 0.7
    })
    this.addBox(-3.95, 1.7, -1.2, 0.08, 1.4, 1.8, glassMat)

    const lamp = new THREE.PointLight(0xffcc88, 1.2, 10, 1.5)
    lamp.position.set(2.4, 1.3, -2.4)
    lamp.castShadow = true
    this.scene.add(lamp)
  }

  private createStreet() {
    const streetMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.92, metalness: 0.08 })
    const street = new THREE.Mesh(new THREE.PlaneGeometry(40, 60), streetMat)
    street.rotation.x = -Math.PI / 2
    street.position.set(0, 0, 25)
    street.receiveShadow = true
    this.scene.add(street)

    const sideMat = new THREE.MeshStandardMaterial({ color: 0x6a6660, roughness: 0.85 })
    this.addBox(0, 0.06, 6.5, 14, 0.12, 4, sideMat)

    const facadeMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.8 })
    const facadeDark = new THREE.MeshStandardMaterial({ color: 0x5a4a40, roughness: 0.85 })

    for (let i = 0; i < 5; i++) {
      const z = 12 + i * 9
      const h = 5 + (i % 3) * 1.5
      this.addBox(-9, h / 2, z, 5, h, 6, i % 2 === 0 ? facadeMat : facadeDark)
      this.addCollider(-9, z, 2.7, 3.2)
      const winMat = new THREE.MeshStandardMaterial({
        color: 0x223344, emissive: 0x112233, emissiveIntensity: 0.4 + (i % 2) * 0.3
      })
      for (let wy = 1.2; wy < h - 0.8; wy += 1.6) {
        this.addBox(-6.45, wy, z - 1.5, 0.1, 0.9, 1.1, winMat)
        this.addBox(-6.45, wy, z + 1.5, 0.1, 0.9, 1.1, winMat)
      }
    }

    for (let i = 0; i < 4; i++) {
      const z = 14 + i * 10
      const h = 4.5 + (i % 2) * 2
      this.addBox(9, h / 2, z, 5, h, 7, i % 2 === 0 ? facadeDark : facadeMat)
      this.addCollider(9, z, 2.7, 3.7)
    }

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.5, metalness: 0.6 })
    for (let i = 0; i < 4; i++) {
      const z = 10 + i * 12
      this.addBox(-5.5, 2.2, z, 0.12, 4.4, 0.12, poleMat)
      const light = new THREE.PointLight(0xffe0a0, 1.4, 14, 1.8)
      light.position.set(-5.5, 4.3, z)
      this.scene.add(light)
    }

    const markMat = new THREE.MeshStandardMaterial({ color: 0xd0c8a0, roughness: 0.9 })
    for (let i = 0; i < 8; i++) {
      this.addBox(0, 0.03, 10 + i * 6, 0.35, 0.02, 2.2, markMat)
    }
  }

  private createDoor() {
    this.door = new Door(this.scene, 0, 0, 4.0)
  }

  private createFlag() {
    const loader = new THREE.TextureLoader()
    // Path works with Vite base /MANI/
    loader.load(
      `${import.meta.env.BASE_URL}assets/flag-lion-sun.png`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        const flagMat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.7,
          metalness: 0.05,
          side: THREE.DoubleSide
        })
        // Flag hanging on the back wall of the room
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.05), flagMat)
        flag.position.set(0, 2.0, -3.88)
        flag.castShadow = true
        this.scene.add(flag)

        // Small wooden rod above flag
        const rodMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.5 })
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 8), rodMat)
        rod.rotation.z = Math.PI / 2
        rod.position.set(0, 2.55, -3.88)
        this.scene.add(rod)
      },
      undefined,
      (err) => console.warn('Flag texture failed to load', err)
    )
  }

  private addWall(x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) {
    this.addBox(x, y, z, w, h, d, mat)
    this.addCollider(x, z, w / 2 + 0.05, d / 2 + 0.05)
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

    if (this.state === 'playing') {
      this.player.update(dt)

      // Collision with static walls/furniture
      resolveAABB(this.player.position, this.playerRadius, this.colliders)

      // Door collision when closed
      const doorBox = this.door.getCollisionAABB()
      if (doorBox) {
        resolveAABB(this.player.position, this.playerRadius, [doorBox])
      }

      this.door.update(dt)

      // Interaction
      if (this.door.canInteract(this.player.position)) {
        const label = this.door.isOpened ? 'E  ·  بستن در' : 'E  ·  باز کردن در'
        this.showInteractHint(label)
        if (this.input.consumeInteract()) {
          this.door.toggle()
        }
      } else {
        this.hideInteractHint()
      }

      this.player.applyToCamera(this.camera)

      if (this.input.consumePause()) {
        this.togglePause()
      }
    } else if (this.state === 'intro' || this.state === 'menu' || this.state === 'settings') {
      const t = this.clock.elapsedTime
      this.camera.position.set(
        Math.sin(t * 0.12) * 0.5,
        1.75 + Math.sin(t * 0.18) * 0.06,
        4.8
      )
      this.camera.lookAt(0, 1.3, 0)
    }

    this.renderer.render(this.scene, this.camera)
  }

  private onResize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    settings.applyToRenderer(this.renderer)
  }

  dispose() {
    this.running = false
    window.removeEventListener('resize', this.onResize)
    this.intro.destroy()
    this.menu.destroy()
    this.settingsPanel.destroy()
    this.hud.destroy()
    this.hidePauseOverlay()
    this.hideInteractHint()
    this.renderer.dispose()
  }
}
