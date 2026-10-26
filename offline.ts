import type { Plugin } from "vite"

// Writes sw.js at build time with the list of built files, so the first visit caches the app and
// squish keeps working without a connection. Files over 1 MB (the AVIF and HEIC codecs, the PDF
// renderer) are left out of that first download and cached the first time they are used instead.
// The cache name changes with every build, so a new deploy replaces the old files.

const PRECACHE_LIMIT=1024*1024

const STATIC=["/","/favicon.svg","/manifest.webmanifest","/icon-192.png","/icon-512.png","/icon-maskable-512.png","/apple-touch-icon.png"]

function worker(version:string,files:string[]) {
  return `const CACHE="squish-${version}"
const FILES=${JSON.stringify(files)}

self.addEventListener("install",(event)=>{
  event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(FILES)).then(()=>self.skipWaiting()))
})

self.addEventListener("activate",(event)=>{
  event.waitUntil(
    caches.keys()
      .then((keys)=>Promise.all(keys.filter((k)=>k.startsWith("squish-")&&k!==CACHE).map((k)=>caches.delete(k))))
      .then(()=>self.clients.claim()),
  )
})

self.addEventListener("fetch",(event)=>{
  const request=event.request
  if (request.method!=="GET"||new URL(request.url).origin!==self.location.origin) return
  // Pages: try the network first so a new deploy shows up, fall back to the cached app offline.
  if (request.mode==="navigate") {
    event.respondWith(fetch(request).catch(()=>caches.match("/")))
    return
  }
  // Built files have content hashes in their names, so a cached copy is always right.
  event.respondWith(
    caches.match(request).then((hit)=>hit||fetch(request).then((response)=>{
      if (response.ok) {
        const copy=response.clone()
        caches.open(CACHE).then((cache)=>cache.put(request,copy))
      }
      return response
    })),
  )
})
`
}

export function offline():Plugin {
  return {
    name:"squish-offline",
    apply:"build",
    generateBundle(_options,bundle) {
      const all=Object.keys(bundle).filter((f)=>!f.endsWith(".map"))
      const size=(f:string)=>{
        const out=bundle[f]
        return out.type==="chunk"?out.code.length:typeof out.source==="string"?out.source.length:out.source.byteLength
      }
      const built=all.map((f)=>"/"+f)
      const files=[...STATIC,...all.filter((f)=>size(f)<=PRECACHE_LIMIT).map((f)=>"/"+f)]
      let hash=0
      for (const ch of built.join("|")) hash=(hash*31+ch.charCodeAt(0))|0
      this.emitFile({ type:"asset", fileName:"sw.js", source:worker((hash>>>0).toString(36),files) })
    },
  }
}
