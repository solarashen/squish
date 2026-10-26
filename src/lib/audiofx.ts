import { AudioSample, AudioSampleSink, type InputAudioTrack } from "mediabunny"

// Volume changes applied to each block of decoded audio on its way to the encoder: fade in, fade
// out, and a fixed gain for normalising. Samples are read as 32-bit float, one plane per channel.

export type Envelope={
  // seconds, measured on the output timeline (which starts at 0 after trimming)
  fadeIn:number
  fadeOut:number
  length:number
  gain:number
}

export function isFlat(e:Envelope) {
  return !e.fadeIn&&!e.fadeOut&&e.gain===1
}

function planes(sample:AudioSample) {
  const out:Float32Array[]=[]
  for (let ch=0;ch<sample.numberOfChannels;ch++) {
    const plane=new Float32Array(sample.numberOfFrames)
    sample.copyTo(plane,{ planeIndex:ch, format:"f32-planar" })
    out.push(plane)
  }
  return out
}

function rebuild(sample:AudioSample,data:Float32Array[],sampleRate=sample.sampleRate,timestamp=sample.timestamp) {
  const joined=new Float32Array(data.length*sample.numberOfFrames)
  data.forEach((plane,i)=>joined.set(plane,i*sample.numberOfFrames))
  return new AudioSample({ data:joined, format:"f32-planar", numberOfChannels:sample.numberOfChannels, sampleRate, timestamp })
}

export function envelopeProcessor(e:Envelope) {
  return (sample:AudioSample)=>{
    const data=planes(sample)
    const rate=sample.sampleRate
    for (let i=0;i<sample.numberOfFrames;i++) {
      const t=sample.timestamp+i/rate
      let g=e.gain
      if (e.fadeIn&&t<e.fadeIn) g*=Math.max(0,t/e.fadeIn)
      if (e.fadeOut&&t>e.length-e.fadeOut) g*=Math.max(0,(e.length-t)/e.fadeOut)
      if (g===1) continue
      for (const plane of data) plane[i]*=g
    }
    const out=rebuild(sample,data)
    sample.close()
    return out
  }
}

// Plays audio faster or slower like a tape, so the pitch moves with the speed. Each block is
// resampled by linear interpolation and keeps its sample rate, because the encoder is set up for
// the rate of the first block it sees.
export function speedProcessor(speed:number) {
  return (sample:AudioSample)=>{
    const frames=Math.max(1,Math.floor(sample.numberOfFrames/speed))
    const data=planes(sample).map((plane)=>{
      const out=new Float32Array(frames)
      for (let j=0;j<frames;j++) {
        const at=j*speed
        const i=Math.floor(at)
        const next=Math.min(plane.length-1,i+1)
        out[j]=plane[i]+(plane[next]-plane[i])*(at-i)
      }
      return out
    })
    const joined=new Float32Array(data.length*frames)
    data.forEach((plane,i)=>joined.set(plane,i*frames))
    const out=new AudioSample({ data:joined, format:"f32-planar", numberOfChannels:sample.numberOfChannels, sampleRate:sample.sampleRate, timestamp:sample.timestamp/speed })
    sample.close()
    return out
  }
}

// Gain that lifts the loudest peak in the chosen range to -1 dBFS (about 0.89 of full scale).
// Quiet files are boosted by at most 20 dB, so silence with a little noise is not blown up.
export async function normalizeGain(track:InputAudioTrack,start:number,end:number|undefined) {
  const sink=new AudioSampleSink(track)
  let peak=0
  for await (const sample of sink.samples(start,end)) {
    for (const plane of planes(sample)) {
      for (let i=0;i<plane.length;i++) {
        const v=Math.abs(plane[i])
        if (v>peak) peak=v
      }
    }
    sample.close()
  }
  if (!peak) return 1
  return Math.min(10,0.891/peak)
}
