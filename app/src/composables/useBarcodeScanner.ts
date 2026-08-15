// https://github.com/ionic-team/capacitor-barcode-scanner
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner'
import { useMainStore } from '@/stores/MainStore'
import { QrCodeScanResult } from '@/types/types'

export function useBarcodeScanner() {
  const startScan = async () => {
    try {
      const { ScanResult } = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanInstructions: 'Point the camera at the QR code at the venue.'
      })
      return ScanResult
    } catch (error) {
      // Rejects when the user cancels or denies camera access. Both are normal
      // exits, so report nothing scanned rather than propagating.
      console.log(error)
    }
  }

  const processScanResult = (result: QrCodeScanResult) => {
    const mainStore = useMainStore()

    const performanceNameResult = result.performanceName
    if (performanceNameResult) {
      mainStore.performanceName = performanceNameResult
    }

    const choirIdResult = result.choirId
    if (choirIdResult !== undefined && !Number.isNaN(+choirIdResult)) {
      mainStore.choirId = +choirIdResult
    }

    const roleNameResult = result.roleName
    if (roleNameResult) {
      mainStore.roleName = roleNameResult
    }

    const defaultLangResult = result.defaultLang
    if (defaultLangResult) {
      mainStore.defaultLang = defaultLangResult
    }

    const ttsLangsResult = result.tts
    if (ttsLangsResult) {
      const foundDefaultLang = ttsLangsResult.find((lang) => lang.iso === defaultLangResult)
      mainStore.availableLanguages = ttsLangsResult
      mainStore.selectedLanguage = foundDefaultLang || ttsLangsResult[0]
    }

    const expertModeResult = result.expertMode
    if (expertModeResult) {
      mainStore.expertMode = expertModeResult
    }

    const performanceIdResult = result.performanceId
    if (performanceIdResult) {
      mainStore.performanceId = performanceIdResult
    }

    const wsUrlResult = result.wsUrl
    if (wsUrlResult) {
      mainStore.wsUrl = wsUrlResult
    }
  }

  return {
    startScan,
    processScanResult
  }
}
