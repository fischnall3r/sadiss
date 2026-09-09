import { createTestingPinia } from '@pinia/testing'
import { useBarcodeScanner } from '@/composables/useBarcodeScanner'
import { useMainStore } from '@/stores/MainStore'

const { processScanResult } = useBarcodeScanner()

createTestingPinia()

const mainStore = useMainStore()

describe('processScanResult', () => {
  it('should update the performance name in mainStore when provided in the scan result', () => {
    const result = { performanceName: 'My Performance', performanceId: '456', wsUrl: 'ws://wsUrl.test' }
    processScanResult(result)
    expect(mainStore.performanceName).toBe(result.performanceName)
  })

  it('should update the choirId in mainStore when provided in the scan result', () => {
    const result = { performanceName: 'My Performance', choirId: '123', performanceId: '456', wsUrl: 'ws://wsUrl.test' }
    processScanResult(result)
    expect(mainStore.choirId).toBe(+result.choirId)
  })

  it('should update the role name in mainStore when provided in the scan result', () => {
    const result = { performanceName: 'My Performance', roleName: 'My Role', performanceId: '456', wsUrl: 'ws://wsUrl.test' }
    processScanResult(result)
    expect(mainStore.roleName).toBe(result.roleName)
  })

  it('should update the default TTS language in mainStore when provided in the scan result', () => {
    const result = { performanceName: 'My Performance', defaultLang: 'en', performanceId: '456', wsUrl: 'ws://wsUrl.test' }
    processScanResult(result)
    expect(mainStore.defaultLang).toBe(result.defaultLang)
  })

  it('should update the available TTS languages in mainStore when provided in the scan result', () => {
    const result = {
      performanceName: 'My Performance',
      performanceId: '456',
      tts: [
        { iso: 'en', lang: 'English' },
        { iso: 'fr', lang: 'French' }
      ],
      wsUrl: 'ws://wsUrl.test'
    }
    processScanResult(result)
    expect(mainStore.availableLanguages).toEqual(result.tts)
  })

  it('should update the selected TTS language in mainStore to the default language when both are provided in the scan result and default language is in available languages', () => {
    const result = {
      performanceName: 'My Performance',
      tts: [
        { iso: 'en', lang: 'English' },
        { iso: 'fr', lang: 'French' }
      ],
      defaultLang: 'fr',
      performanceId: '456',
      wsUrl: 'ws://wsUrl.test'
    }
    processScanResult(result)
    // French is deliberately the second entry, so asserting it distinguishes
    // "picked the default" from "picked the first available".
    expect(mainStore.selectedLanguage).toStrictEqual({ iso: 'fr', lang: 'French' })
  })

  it('should update the selected TTS language in mainStore to the first available language when no default language is provided in the scan result', () => {
    const result = {
      performanceName: 'My Performance',
      tts: [
        { iso: 'en', lang: 'English' },
        { iso: 'fr', lang: 'French' }
      ],
      performanceId: '456',
      defaultLang: 'de',
      wsUrl: 'ws://wsUrl.test'
    }
    processScanResult(result)
    expect(mainStore.selectedLanguage).toStrictEqual(result.tts[0])
  })

  it('should update the selected TTS language in mainStore to the first available language when default language is provided in the scan result but is not in available languages', () => {
    const result = {
      performanceName: 'My Performance',
      tts: [
        { iso: 'en', lang: 'English' },
        { iso: 'fr', lang: 'French' }
      ],
      performanceId: '456',
      wsUrl: 'ws://wsUrl.test'
    }
    processScanResult(result)
    expect(mainStore.selectedLanguage).toStrictEqual(result.tts[0])
  })

  it('should update the expert mode to be true in mainStore when provided in the scan result', () => {
    const result = { performanceName: 'My Performance', expertMode: true, performanceId: '456', wsUrl: 'ws://wsUrl.test' }
    processScanResult(result)
    expect(mainStore.expertMode).toBe(true)
  })

  it('should update the performanceId in mainStore when provided in the scan result', () => {
    const result = { performanceName: 'My Performance', performanceId: '123', wsUrl: 'ws://wsUrl.test' }
    processScanResult(result)
    expect(mainStore.performanceId).toBe(result.performanceId)
  })

  it('should update the wsUrl in mainStore when provided in the scan result', () => {
    const result = { performanceName: 'My Performance', performanceId: '456', wsUrl: 'ws://wsUrl.test' }
    processScanResult(result)
    expect(mainStore.wsUrl).toBe(result.wsUrl)
  })
})
