type InvokeOptions = {
  method: 'setValue' | 'focus'
  params?: { value: string }
  fail: () => void
}

type SelectedElement = {
  invoke: (options: InvokeOptions) => SelectedElement
  exec: () => void
}

type SelectorQuery = {
  select: (selector: string) => SelectedElement
}

type SyncNativeInputOptions = {
  el: { focus?: () => void }
  id: string
  value: string
  nextTick: () => Promise<void>
  createSelectorQuery?: () => SelectorQuery
  fail?: () => void
}

export async function syncNativeInputOnMount(
  options: SyncNativeInputOptions,
): Promise<void> {
  const { el, id, value, nextTick, createSelectorQuery } = options
  const fail = options.fail ?? (() => {})

  await nextTick()

  if (createSelectorQuery && id) {
    createSelectorQuery()
      .select(`#${id}`)
      .invoke({ method: 'setValue', params: { value }, fail })
      .exec()
  }

  el.focus?.()

  if (createSelectorQuery && id) {
    createSelectorQuery()
      .select(`#${id}`)
      .invoke({ method: 'focus', fail })
      .exec()
  }
}
