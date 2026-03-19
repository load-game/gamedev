function isObjectLike(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function')
}

function resolvePath(root, path) {
  if (!isObjectLike(root)) {
    return {
      available: false,
      found: false,
      parent: null,
      value: undefined,
    }
  }

  let parent = null
  let value = root
  for (const segment of path) {
    if (!isObjectLike(value)) {
      return {
        available: true,
        found: false,
        parent: null,
        value: undefined,
      }
    }
    parent = value
    value = Reflect.get(value, segment)
  }

  return {
    available: true,
    found: true,
    parent,
    value,
  }
}

export function createDeferredResource(getTarget, { queueMethods = [] } = {}) {
  const pendingCalls = []
  const queueableMethods = new Set(queueMethods)

  function queuePendingCall(path, args) {
    pendingCalls.push({ path: [...path], args: [...args] })
  }

  function flushPendingCalls() {
    const root = getTarget()
    if (!isObjectLike(root) || pendingCalls.length === 0) return 0

    let flushed = 0
    const queuedCalls = pendingCalls.splice(0, pendingCalls.length)
    for (const call of queuedCalls) {
      const resolved = resolvePath(root, call.path)
      if (typeof resolved.value !== 'function') continue
      resolved.value.apply(resolved.parent, call.args)
      flushed += 1
    }
    return flushed
  }

  function makeProxy(path = []) {
    const placeholder = function deferredResourcePlaceholder() {}

    return new Proxy(placeholder, {
      get(_target, prop) {
        if (prop === 'then') return undefined
        if (prop === 'flushPendingCalls') return flushPendingCalls
        if (prop === Symbol.toStringTag) return 'DeferredResource'
        if (prop === Symbol.for('nodejs.util.inspect.custom')) {
          return () => {
            const resolved = resolvePath(getTarget(), path)
            return resolved.available ? resolved.value : `[DeferredResource ${path.join('.') || 'root'}]`
          }
        }

        const resolved = resolvePath(getTarget(), path)
        if (!resolved.available) {
          return makeProxy([...path, prop])
        }
        if (!resolved.found) return undefined
        if (!isObjectLike(resolved.value)) {
          return Reflect.get(Object(resolved.value), prop)
        }

        const value = Reflect.get(resolved.value, prop)
        if (typeof value === 'function') {
          return value.bind(resolved.value)
        }
        return value
      },

      apply(_target, _thisArg, args) {
        const resolved = resolvePath(getTarget(), path)
        if (typeof resolved.value === 'function') {
          return resolved.value.apply(resolved.parent, args)
        }

        const methodName = path[path.length - 1]
        if (!resolved.available && typeof methodName === 'string' && queueableMethods.has(methodName)) {
          queuePendingCall(path, args)
          return undefined
        }

        throw new Error('runtime_resource_not_ready')
      },
    })
  }

  return {
    proxy: makeProxy(),
    flushPendingCalls,
  }
}
