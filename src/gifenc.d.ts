// gifenc ships without type definitions; these cover the parts squish uses.
declare module "gifenc" {
  export type Palette=number[][]
  export type ColorFormat="rgb565"|"rgb444"|"rgba4444"
  export function quantize(rgba:Uint8Array|Uint8ClampedArray,maxColors:number,options?:{ format?:ColorFormat; oneBitAlpha?:boolean|number; clearAlpha?:boolean }):Palette
  export function applyPalette(rgba:Uint8Array|Uint8ClampedArray,palette:Palette,format?:ColorFormat):Uint8Array
  export function GIFEncoder():{
    writeFrame(index:Uint8Array,width:number,height:number,options?:{ palette?:Palette; delay?:number; repeat?:number; transparent?:boolean; transparentIndex?:number; dispose?:number }):void
    finish():void
    bytes():Uint8Array
  }
}
