const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined'

const coarse =
  isBrowser && typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)').matches : false
const noHover =
  isBrowser && typeof window.matchMedia === 'function' ? window.matchMedia('(hover: none)').matches : false
const hasTouch = isBrowser ? navigator.maxTouchPoints > 0 : false

export const isTouch = isBrowser && ((coarse && hasTouch) || (noHover && hasTouch))
