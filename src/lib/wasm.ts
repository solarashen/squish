// Encoders compiled to WebAssembly (the Squoosh codecs, packaged as jSquash). They are slower than the
// browser's own canvas encoders but squeeze harder: MozJPEG makes smaller JPEGs at the same quality,
// OxiPNG losslessly repacks PNGs, and libavif writes AVIF in browsers whose canvas cannot.
// Each one is downloaded only the first time it is used.

export type WasmCodec="MozJPEG"|"OxiPNG"|"libavif"

export async function mozjpeg(data:ImageData,quality:number) {
  const { default:encode }=await import("@jsquash/jpeg/encode")
  const buffer=await encode(data,{ quality:Math.round(quality*100), progressive:true, optimize_coding:true })
  return new Blob([buffer],{ type:"image/jpeg" })
}

export async function oxipng(png:Blob) {
  const { default:optimise }=await import("@jsquash/oxipng/optimise")
  // Level 2 is the usual balance: most of the gain of higher levels in a fraction of the time.
  const buffer=await optimise(await png.arrayBuffer(),{ level:2, interlace:false })
  return new Blob([buffer],{ type:"image/png" })
}

export async function libavif(data:ImageData,quality:number) {
  const { default:encode }=await import("@jsquash/avif/encode")
  const buffer=await encode(data,{ quality:Math.round(quality*100), speed:7 })
  return new Blob([buffer],{ type:"image/avif" })
}
