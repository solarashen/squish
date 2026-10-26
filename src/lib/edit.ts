import type { ImageEdit } from "./types"

export const NO_EDIT:ImageEdit={ rotate:0, flipH:false, flipV:false, crop:null }

export function isEdited(e:ImageEdit|undefined) {
  return !!e&&(e.rotate!==0||e.flipH||e.flipV||!!e.crop)
}

// Size of the picture after rotation, before cropping.
export function rotatedSize(width:number,height:number,rotate:number) {
  return rotate===90||rotate===270?{ width:height, height:width }:{ width, height }
}

// Rotates and flips the whole picture, then cuts out the crop. Used both by the encoder (in the
// worker) and by the editor's preview (with no crop), so what you see is what you get.
export function renderEdit(source:CanvasImageSource&{ width:number; height:number },edit:ImageEdit,withCrop=true) {
  const full=rotatedSize(source.width,source.height,edit.rotate)
  const crop=withCrop&&edit.crop
    ?{
      x:Math.round(edit.crop.x*full.width),
      y:Math.round(edit.crop.y*full.height),
      w:Math.max(1,Math.round(edit.crop.w*full.width)),
      h:Math.max(1,Math.round(edit.crop.h*full.height)),
    }
    :{ x:0, y:0, w:full.width, h:full.height }
  const canvas=new OffscreenCanvas(crop.w,crop.h)
  const ctx=canvas.getContext("2d")!
  ctx.imageSmoothingQuality="high"
  ctx.translate(-crop.x,-crop.y)
  ctx.translate(full.width/2,full.height/2)
  ctx.rotate(edit.rotate*Math.PI/180)
  ctx.scale(edit.flipH?-1:1,edit.flipV?-1:1)
  ctx.drawImage(source,-source.width/2,-source.height/2)
  return canvas
}

export async function applyEdit(bitmap:ImageBitmap,edit:ImageEdit) {
  return createImageBitmap(renderEdit(bitmap,edit))
}
