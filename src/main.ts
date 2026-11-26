import './style.css'
import { Game } from './game/Game'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const loading = document.getElementById('loading-screen') as HTMLDivElement

async function bootstrap() {
  try {
    const game = new Game(canvas)
    await game.init()
    loading.style.opacity = '0'
    setTimeout(() => loading.remove(), 500)
    game.start()
  } catch (err) {
    console.error('Failed to start MANI:', err)
    loading.innerHTML = `<p style="color:#e63946">خطا در بارگذاری بازی</p><pre>${String(err)}</pre>`
  }
}

bootstrap()
