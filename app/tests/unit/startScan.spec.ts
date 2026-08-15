import { createTestingPinia } from '@pinia/testing'
import { CapacitorBarcodeScanner } from '@capacitor/barcode-scanner'
import { useBarcodeScanner } from '@/composables/useBarcodeScanner'

jest.mock('@capacitor/barcode-scanner', () => ({
  __esModule: true,
  CapacitorBarcodeScanner: { scanBarcode: jest.fn() },
  CapacitorBarcodeScannerTypeHint: { QR_CODE: 0 }
}))

const scanBarcode = CapacitorBarcodeScanner.scanBarcode as jest.Mock

createTestingPinia()

const { startScan } = useBarcodeScanner()

describe('startScan', () => {
  beforeEach(() => {
    scanBarcode.mockReset()
  })

  it('should return the scanned content on a successful scan', async () => {
    scanBarcode.mockResolvedValue({ ScanResult: '{"performanceName":"My Performance"}', format: 0 })
    await expect(startScan()).resolves.toBe('{"performanceName":"My Performance"}')
  })

  it('should ask the native scanner for QR codes only', async () => {
    scanBarcode.mockResolvedValue({ ScanResult: '{}', format: 0 })
    await startScan()
    expect(scanBarcode).toHaveBeenCalledWith(expect.objectContaining({ hint: 0 }))
  })

  // The native scanner rejects when the user backs out or denies camera access.
  // That is a normal exit, not an error the caller should have to handle.
  it('should resolve to undefined when the user cancels the scan', async () => {
    scanBarcode.mockRejectedValue(new Error('scan cancelled'))
    await expect(startScan()).resolves.toBeUndefined()
  })

  it('should resolve to undefined when camera access is denied', async () => {
    scanBarcode.mockRejectedValue(new Error('permission denied'))
    await expect(startScan()).resolves.toBeUndefined()
  })
})
