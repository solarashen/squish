/// <reference lib="webworker" />
import { encodeImage, EncodeError } from "./encode"
import type { ImageEdit, Settings } from "./types"

export type WorkerRequest={ jobId:number; file:Blob; settings:Settings; sourceSize:number; edit?:ImageEdit }
export type WorkerResponse=
  | { jobId:number; ok:true; blob:Blob; width:number; height:number; sourceWidth:number; sourceHeight:number; missed?:boolean; engine?:string }
  | { jobId:number; ok:false; code:string }

// Runs the canvas pipeline off the main thread, so the page stays responsive with large batches.
self.onmessage=async (event:MessageEvent<WorkerRequest>)=>{
  const { jobId, file, settings, sourceSize, edit }=event.data
  try {
    const result=await encodeImage(file,settings,sourceSize,edit)
    const message:WorkerResponse={ jobId, ok:true, ...result }
    self.postMessage(message)
  } catch (error) {
    const code=error instanceof EncodeError?error.code:"encode"
    const message:WorkerResponse={ jobId, ok:false, code }
    self.postMessage(message)
  }
}
