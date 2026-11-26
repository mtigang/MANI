export type DeviceKind = 'desktop' | 'mobile'

export function detectDevice(): DeviceKind {
  const ua = navigator.userAgent || ''
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|IEMobile|BlackBerry/i.test(ua)
  // Prefer UA + touch; treat large tablets with mouse as desktop if no mobile UA
  if (mobileUA || (touch && window.innerWidth < 900)) return 'mobile'
  return 'desktop'
}

export function isLandscape(): boolean {
  return window.innerWidth >= window.innerHeight
}
