import { encodeImage, EncodeError } from "./encode"
import type { EncodeResult, ErrorCode, Settings } from "./types"
import type { WorkerRequest, WorkerResponse } from "./encode.worker"

type Pending={ resolve:(r:EncodeResult)=>void; reject:(e:EncodeError)=>void }

// OffscreenCanvas inside a worker is what lets encoding leave the main thread.
const workersSupported=typeof Worker!=="undefined"&&typeof OffscreenCanvas!=="undefined"

class WorkerPool {
  private workers:Worker[]=[]
  private idle:Worker[]=[]
  private queue:{ request:WorkerRequest; pending:Pending }[]=[]
  private pending=new Map<number,Pending>()
  private owner=new Map<number,Worker>()
  private nextJob=1

  constructor(size:number) {
    for (let i=0;i<size;i++) {
      const worker=new Worker(new URL("./encode.worker.ts",import.meta.url),{ type:"module" })
      worker.onmessage=(event:MessageEvent<WorkerResponse>)=>this.finish(worker,event.data)
      this.workers.push(worker)
      this.idle.push(worker)
    }
  }

  run(file:Blob,settings:Settings,sourceSize:number):Promise<EncodeResult> {
    return new Promise((resolve,reject)=>{
      const request={ jobId:this.nextJob++, file, settings, sourceSize }
      this.queue.push({ request, pending:{ resolve, reject } })
      this.pump()
    })
  }

  private pump() {
    while (this.idle.length&&this.queue.length) {
      const worker=this.idle.pop()!
      const { request, pending }=this.queue.shift()!
      this.pending.set(request.jobId,pending)
      this.owner.set(request.jobId,worker)
      worker.postMessage(request)
    }
  }

  private finish(worker:Worker,data:WorkerResponse) {
    const pending=this.pending.get(data.jobId)
    this.pending.delete(data.jobId)
    this.owner.delete(data.jobId)
    this.idle.push(worker)
    if (pending) {
      if (data.ok) {
        pending.resolve({ blob:data.blob, width:data.width, height:data.height, sourceWidth:data.sourceWidth, sourceHeight:data.sourceHeight, missed:data.missed, engine:data.engine })
      } else {
        pending.reject(new EncodeError(data.code as ErrorCode))
      }
    }
    this.pump()
  }
}

let pool:WorkerPool|null=null

export function encode(file:Blob,settings:Settings,sourceSize=file.size):Promise<EncodeResult> {
  if (!workersSupported) return encodeImage(file,settings,sourceSize)
  if (!pool) {
    const cores=navigator.hardwareConcurrency||4
    pool=new WorkerPool(Math.max(1,Math.min(4,cores-1)))
  }
  return pool.run(file,settings,sourceSize)
}
