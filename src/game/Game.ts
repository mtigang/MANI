import * as THREE from 'three'
import { InputManager } from './systems/InputManager'
import { PlayerController } from './systems/PlayerController'

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private clock = new THREE.Clock()
  private running = false
  private input: InputManager
  private player: PlayerController

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
    this.scene.background = new THREE.Color(0x1a1a2e)
    this.scene.fog = new THREE.Fog(0x1a1a2e, 15, 60)

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200)

    this.input = new InputManager(canvas)
    this.player = new PlayerController(this.input)

    window.addEventListener('resize', this.onResize)
  }

  async init() {
    // Lighting
    const ambient = new THREE.AmbientLight(0x404060, 0.5)
    this.scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xfff0d0, 1.1)
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

    // Mani's room (simple box room)
    this.createRoom()

    // Ground outside
    const groundGeo = new THREE.PlaneGeometry(100, 100)
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3d3d3d, roughness: 0.95 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = 0
    ground.receiveShadow = true
    this.scene.add(ground)

    this.player.position.set(0, 1.6, 2)
  }

  private createRoom() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 })
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.7 })

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0.01, 0)
    floor.receiveShadow = true
    this.scene.add(floor)

    // Walls
    const wallH = 3
    const wallT = 0.2
    const walls = [
      { pos: [0, wallH/2, -4], size: [8, wallH, wallT] },
      { pos: [0, wallH/2, 4], size: [8, wallH, wallT] },
      { pos: [-4, wallH/2, 0], size: [wallT, wallH, 8] },
      { pos: [4, wallH/2, 0], size: [wallT, wallH, 8] },
    ]
    for (const w of walls) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...w.size as [number,number,number]), wallMat)
      mesh.position.set(...w.pos as [number,number,number])
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.scene.add(mesh)
    }

    // Simple bed / furniture markers
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.4, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x4a90a4 })
    )
    bed.position.set(-2, 0.2, -2)
    bed.castShadow = true
    this.scene.add(bed)

    // Door opening (remove part of wall conceptually by not placing full wall)
    // For now leave a gap indicator
    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.2, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
    )
    doorFrame.position.set(0, 1.1, 3.9)
    this.scene.add(doorFrame)
  }

  start() {
    this.running = true
    this.animate()
  }

  private animate = () => {
    if (!this.running) return
    requestAnimationFrame(this.animate)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.player.update(dt)
    this.player.applyToCamera(this.camera)
    this.renderer.render(this.scene, this.camera)
  }

  private onResize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  dispose() {
    this.running = false
    window.removeEventListener('resize', this.onResize)
    this.renderer.dispose()
  }
}
