import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { STRINGS, type Lang, type Strings } from "./strings"

type I18n={ lang:Lang; setLang:(lang:Lang)=>void; t:Strings; formatBytes:(bytes:number)=>string; formatNumber:(n:number)=>string }

const I18nContext=createContext<I18n|null>(null)
const STORAGE_KEY="squish-lang"

function initialLang():Lang {
  try {
    const saved=localStorage.getItem(STORAGE_KEY)
    if (saved==="en"||saved==="hr") return saved
  } catch {
    // storage blocked: fall through to the default
  }
  return "en"
}

export function I18nProvider({ children }:{ children:ReactNode }) {
  const [lang,setLangState]=useState<Lang>(initialLang)

  useEffect(()=>{
    document.documentElement.lang=lang
    try {
      localStorage.setItem(STORAGE_KEY,lang)
    } catch {
      // not critical
    }
  },[lang])

  const value=useMemo<I18n>(()=>{
    const locale=lang==="hr"?"hr-HR":"en-GB"
    const one=new Intl.NumberFormat(locale,{ maximumFractionDigits:1, minimumFractionDigits:1 })
    const whole=new Intl.NumberFormat(locale,{ maximumFractionDigits:0 })
    return {
      lang,
      setLang:setLangState,
      t:STRINGS[lang],
      formatNumber:(n)=>whole.format(n),
      formatBytes:(bytes)=>{
        if (bytes<1024) return whole.format(bytes)+" B"
        if (bytes<1024*1024) return whole.format(bytes/1024)+" KB"
        return one.format(bytes/(1024*1024))+" MB"
      },
    }
  },[lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx=useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider")
  return ctx
}
