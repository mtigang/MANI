export type SaveCheckpoint = 'start' | 'left_house' | 'street' | 'chapter1_end'

export interface GameSave {
  version: number
  checkpoint: SaveCheckpoint
  position: { x: number; y: number; z: number }
  yaw: number
  completed: {
    introSeen: boolean
    leftHouse: boolean
    reachedStreet: boolean
  }
  savedAt: number
}

const KEY = 'mani-save-v1'
const VERSION = 1

export class SaveSystem {
  load(): GameSave | null {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return null
      const data = JSON.parse(raw) as GameSave
      if (!data || data.version !== VERSION) return null
      if (!data.checkpoint || !data.position) return null
      return data
    } catch {
      return null
    }
  }

  hasSave(): boolean {
    return this.load() !== null
  }

  save(partial: Partial<GameSave> & { checkpoint: SaveCheckpoint }) {
    const prev = this.load()
    const next: GameSave = {
      version: VERSION,
      checkpoint: partial.checkpoint,
      position: partial.position ?? prev?.position ?? { x: 0, y: 1.6, z: 1.2 },
      yaw: partial.yaw ?? prev?.yaw ?? 0,
      completed: {
        introSeen: partial.completed?.introSeen ?? prev?.completed.introSeen ?? false,
        leftHouse: partial.completed?.leftHouse ?? prev?.completed.leftHouse ?? false,
        reachedStreet: partial.completed?.reachedStreet ?? prev?.completed.reachedStreet ?? false
      },
      savedAt: Date.now()
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch (e) {
      console.warn('Save failed', e)
    }
  }

  clear() {
    try {
      localStorage.removeItem(KEY)
    } catch { /* ignore */ }
  }
}

export const saveSystem = new SaveSystem()
