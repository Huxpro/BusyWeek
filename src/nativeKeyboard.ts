export interface NativeKeyboardEvent {
  detail?: {
    show?: boolean
    keyboardHeight?: number
    safeAreaBottom?: number
    height?: number
  }
}

/**
 * Normalize the two keyboard events emitted directly by Lynx input elements.
 *
 * Older iOS hosts emit `keyboard` with `show` and `keyboardHeight`; newer
 * hosts can additionally emit `keyboardheightchange` with `height`.
 */
export function getElementKeyboardHeight(event: NativeKeyboardEvent): number {
  const detail = event.detail
  if (!detail || detail.show === false) return 0

  const height = detail.keyboardHeight ?? detail.height ?? 0
  return Number.isFinite(height) && height > 0 ? height : 0
}
