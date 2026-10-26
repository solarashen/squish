// localStorage can be missing or throw (private windows, blocked storage), so every access is guarded
// and the app simply falls back to its defaults.

export function load<T>(key:string):T|null {
  try {
    const raw=localStorage.getItem(key)
    return raw?JSON.parse(raw) as T:null
  } catch {
    return null
  }
}

export function save(key:string,value:unknown) {
  try {
    localStorage.setItem(key,JSON.stringify(value))
  } catch {
    // Storage is full or blocked; nothing to do.
  }
}

export function forget(key:string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

// Fills in fields that older saved versions did not have yet, one level deep per section.
export function mergeDefaults<T extends Record<string,object>>(defaults:T,saved:Partial<T>|null):T {
  if (!saved) return defaults
  const out={ ...defaults }
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    if (saved[key]&&typeof saved[key]==="object") out[key]={ ...defaults[key], ...saved[key] }
  }
  return out
}
