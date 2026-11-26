import * as THREE from 'three'
import { InputManager } from './systems/InputManager'
import { PlayerController } from './systems/PlayerController'
import { settings } from './core/Settings'
import { IntroScreen } from './ui/IntroScreen'
import { MainMenu } from './ui/MainMenu'
import { SettingsPanel } from './ui/SettingsPanel'
import './ui/ui.css'

type GameState = 'intro' | 'menu' | 'settings' | 'playing'

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
  private uiRoot: HTMLElement

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

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a0f)
    this.scene.fog = new THREE.Fog(0x0a0a0f, 12, 50)

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200)

    this.input = new InputManager(canvas)
    this.player = new PlayerController(this.input)

    // Apply saved graphics settings immediately
    settings.applyToRenderer(this.renderer)
    settings.onChange(() => settings.applyToRenderer(this.renderer))

    // Sensitivity
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
  }

  private goToMenu() {
    this.state = 'menu'
    this.intro.hide()
    this.settingsPanel.hide()
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
    this.input.setEnabled(true)
    // Reset player to room start
    this.player.position.set(0, 1.6, 2)
    this.player.yaw = 0
    this.player.pitch = 0
  }

  private handleExit() {
    // Browsers prevent closing the tab; return to intro instead
    this.state = 'intro'
    this.menu.hide()
    this.settingsPanel.hide()
    this.intro.show()
    this.input.setEnabled(false)
  }

  async init() {
    // Lighting
    const ambient = new THREE.AmbientLight(0x404060, 0.45)
    this.scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xfff0d0, 1.05)
    dir.position.set(8, 18, 6)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.near = 1
    dir.shadow.camera.far = 50
    dir.shadow.camera.left = -20
    dir.shadow.camera.right = 20
    dir.shadow.camera.top = 20
    dir.shadow.camera.bottom = -20
    this.scene.add(dir)

    this.createRoom()

    // Outside ground
    const groundGeo = new THREE.PlaneGeometry(80, 80)
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.95 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = 0
    ground.receiveShadow = true
    this.scene.add(ground)

    this.player.position.set(0, 1.6, 2)
    this.input.setEnabled(false) // disabled until Start Game
  }

  private createRoom() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.82 })
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.7 })

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0.01, 0)
    floor.receiveShadow = true
    this.scene.add(floor)

    const wallH = 3
    const wallT = 0.2
    const walls = [
      { pos: [0, wallH / 2, -4], size: [8, wallH, wallT] },
      { pos: [0, wallH / 2, 4], size: [8, wallH, wallT] },
      { pos: [-4, wallH / 2, 0], size: [wallT, wallH, 8] },
      { pos: [4, wallH / 2, 0], size: [wallT, wallH, 8] }
    ]
    for (const w of walls) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(...(w.size as [number, number, number])),
        wallMat
      )
      mesh.position.set(...(w.pos as [number, number, number]))
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.scene.add(mesh)
    }

    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.4, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x4a90a4 })
    )
    bed.position.set(-2, 0.2, -2)
    bed.castShadow = true
    this.scene.add(bed)

    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.2, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
    )
    doorFrame.position.set(0, 1.1, 3.9)
    this.scene.add(doorFrame)
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
      this.player.applyToCamera(this.camera)
    } else {
      // Subtle idle camera for menu/intro
      const t = this.clock.elapsedTime
      this.camera.position.set(
        Math.sin(t * 0.15) * 0.4,
        1.7 + Math.sin(t * 0.2) * 0.05,
        4.5
      )
      this.camera.lookAt(0, 1.2, 0)
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
    this.renderer.dispose()
  }
}
