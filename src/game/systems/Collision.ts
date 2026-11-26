import * as THREE from 'three'

export type AABB = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  minY?: number
  maxY?: number
}

export function resolveAABB(
  pos: THREE.Vector3,
  radius: number,
  boxes: AABB[]
): void {
  for (const b of boxes) {
    const nearestX = Math.max(b.minX, Math.min(pos.x, b.maxX))
    const nearestZ = Math.max(b.minZ, Math.min(pos.z, b.maxZ))
    const dx = pos.x - nearestX
    const dz = pos.z - nearestZ
    const distSq = dx * dx + dz * dz
    if (distSq < radius * radius) {
      if (distSq === 0) {
        // Centered inside – push out along shortest axis
        const left = pos.x - b.minX
        const right = b.maxX - pos.x
        const back = pos.z - b.minZ
        const front = b.maxZ - pos.z
        const m = Math.min(left, right, back, front)
        if (m === left) pos.x = b.minX - radius
        else if (m === right) pos.x = b.maxX + radius
        else if (m === back) pos.z = b.minZ - radius
        else pos.z = b.maxZ + radius
      } else {
        const dist = Math.sqrt(distSq)
        const push = (radius - dist) / dist
        pos.x += dx * push
        pos.z += dz * push
      }
    }
  }
}
