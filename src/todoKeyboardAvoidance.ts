export const TODO_EDIT_KEYBOARD_GAP = 16

export interface TodoKeyboardAvoidanceGeometry {
  rootBottom: number
  viewportBottom: number
  inputBottom: number
  scrollY: number
  keyboardHeight: number
  gap?: number
}

export interface TodoKeyboardAvoidancePlan {
  spacerHeight: number
  visibleBottom: number
  overlap: number
  targetScrollY: number | null
}

export function calculateTodoKeyboardAvoidance(
  geometry: TodoKeyboardAvoidanceGeometry,
): TodoKeyboardAvoidancePlan {
  const {
    rootBottom,
    viewportBottom,
    inputBottom,
    scrollY,
    keyboardHeight,
    gap = TODO_EDIT_KEYBOARD_GAP,
  } = geometry

  if (!Number.isFinite(keyboardHeight) || keyboardHeight <= 0) {
    return {
      spacerHeight: 0,
      visibleBottom: viewportBottom,
      overlap: 0,
      targetScrollY: null,
    }
  }

  const viewportBottomGap = Math.max(0, rootBottom - viewportBottom)
  const spacerHeight = Math.max(0, keyboardHeight - viewportBottomGap)
  const visibleBottom = Math.min(
    viewportBottom,
    rootBottom - keyboardHeight,
  )
  const overlap = Math.max(0, inputBottom + gap - visibleBottom)

  return {
    spacerHeight,
    visibleBottom,
    overlap,
    targetScrollY:
      overlap > 0
        ? Math.max(0, Number.isFinite(scrollY) ? scrollY : 0) + overlap
        : null,
  }
}

type NativeInvokeOptions = {
  method: string
  params?: Record<string, unknown>
  success: (value: unknown) => void
  fail: (error: unknown) => void
}

type NativeSelectedElement = {
  invoke: (options: NativeInvokeOptions) => NativeSelectedElement
  exec: () => void
}

type NativeSelectorQuery = {
  select: (selector: string) => NativeSelectedElement
}

export interface KeepTodoEditAboveKeyboardOptions {
  inputId: string
  keyboardHeight: number
  createSelectorQuery: () => NativeSelectorQuery
  nextTick: () => Promise<void>
  onSpacerHeight: (height: number) => void
  isCurrent?: () => boolean
  rootSelector?: string
  scrollSelector?: string
}

const SCREEN_RECT_PARAMS = {
  relativeTo: 'screen',
  androidEnableTransformProps: true,
  iosEnableTransformProps: true,
  harmonyEnableTransformProps: true,
} as const

function invokeNative<T>(
  createSelectorQuery: () => NativeSelectorQuery,
  selector: string,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const invokeOptions: NativeInvokeOptions = {
      method,
      success: (value) => resolve(value as T),
      fail: reject,
    }
    if (params) invokeOptions.params = params

    createSelectorQuery()
      .select(selector)
      .invoke(invokeOptions)
      .exec()
  })
}

export async function keepTodoEditAboveKeyboard(
  options: KeepTodoEditAboveKeyboardOptions,
): Promise<TodoKeyboardAvoidancePlan | null> {
  const {
    inputId,
    keyboardHeight,
    createSelectorQuery,
    nextTick,
    onSpacerHeight,
    isCurrent = () => true,
    rootSelector = '#app-root',
    scrollSelector = '#timeline-scroll',
  } = options

  await nextTick()
  if (!isCurrent()) return null

  const [rootRect, viewportRect, inputRect, scrollInfo] = await Promise.all([
    invokeNative<{ bottom: number }>(
      createSelectorQuery,
      rootSelector,
      'boundingClientRect',
      SCREEN_RECT_PARAMS,
    ),
    invokeNative<{ bottom: number }>(
      createSelectorQuery,
      scrollSelector,
      'boundingClientRect',
      SCREEN_RECT_PARAMS,
    ),
    invokeNative<{ bottom: number }>(
      createSelectorQuery,
      `#edit-${inputId}`,
      'boundingClientRect',
      SCREEN_RECT_PARAMS,
    ),
    invokeNative<{ scrollY?: number; scrollTop?: number }>(
      createSelectorQuery,
      scrollSelector,
      'getScrollInfo',
    ),
  ])

  if (!isCurrent()) return null

  const plan = calculateTodoKeyboardAvoidance({
    rootBottom: rootRect.bottom,
    viewportBottom: viewportRect.bottom,
    inputBottom: inputRect.bottom,
    scrollY: scrollInfo.scrollY ?? scrollInfo.scrollTop ?? 0,
    keyboardHeight,
  })

  onSpacerHeight(plan.spacerHeight)
  await nextTick()
  if (!isCurrent()) return null

  if (plan.targetScrollY !== null) {
    await invokeNative(createSelectorQuery, scrollSelector, 'scrollTo', {
      offset: plan.targetScrollY,
      smooth: true,
    })
  }

  return plan
}
