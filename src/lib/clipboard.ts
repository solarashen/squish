// The clipboard reliably accepts only PNG images, so other formats are redrawn as PNG first.
export async function copyImage(blob:Blob) {
  let png=blob
  if (blob.type!=="image/png") {
    const bitmap=await createImageBitmap(blob)
    const canvas=document.createElement("canvas")
    canvas.width=bitmap.width
    canvas.height=bitmap.height
    canvas.getContext("2d")!.drawImage(bitmap,0,0)
    bitmap.close()
    png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob((b)=>b?resolve(b):reject(new Error("png")),"image/png"))
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png":png })])
}

export function canCopyImages() {
  return typeof ClipboardItem!=="undefined"&&!!navigator.clipboard?.write
}

export async function copyText(text:string) {
  await navigator.clipboard.writeText(text)
}
