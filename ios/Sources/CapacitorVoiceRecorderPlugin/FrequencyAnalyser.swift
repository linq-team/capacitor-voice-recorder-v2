import Accelerate
import AVFAudio

class FrequencyAnalyzer {
    private let fftSize: Int
    private var fftSetup: FFTSetup?
    private var real: UnsafeMutablePointer<Float>
    private var imaginary: UnsafeMutablePointer<Float>
    private var hannWindow: [Float]

    private let minDB: Float = log10(1e-7)
    private let maxDB: Float = 0.0

    init(_ frameSize: Int) {
        fftSize = frameSize

        real = UnsafeMutablePointer<Float>.allocate(capacity: fftSize / 2)
        imaginary = UnsafeMutablePointer<Float>.allocate(capacity: fftSize / 2)

        hannWindow = [Float](repeating: 0.0, count: fftSize)
        fftSetup = vDSP_create_fftsetup(vDSP_Length(log2(Float(fftSize))), FFTRadix(kFFTRadix2))
        vDSP_hann_window(&hannWindow, vDSP_Length(fftSize), Int32(vDSP_HANN_DENORM))
    }

    func process(buffer: AVAudioPCMBuffer) -> [UInt8] {
        let frameCount = Int(buffer.frameLength)
        guard frameCount == fftSize,
              let channelData = buffer.floatChannelData?.pointee else {
            fatalError("Frame size does not match or channel data is unavailable.")
        }

        var mean: Float = 0.0
        vDSP_meanv(channelData, 1, &mean, vDSP_Length(fftSize))
        var zeroMeanData = [Float](repeating: 0.0, count: fftSize)
        vDSP_vsadd(channelData, 1, [-mean], &zeroMeanData, 1, vDSP_Length(fftSize))

        var windowedData = [Float](repeating: 0.0, count: fftSize)
        vDSP_vmul(zeroMeanData, 1, hannWindow, 1, &windowedData, 1, vDSP_Length(fftSize))

        var complexBuffer = DSPSplitComplex(realp: real, imagp: imaginary)
        windowedData.withUnsafeBufferPointer { pointer in
            pointer.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: fftSize / 2) { typeConvertedTransferBuffer in
                vDSP_ctoz(typeConvertedTransferBuffer, 2, &complexBuffer, 1, vDSP_Length(fftSize / 2))
            }
        }

        vDSP_fft_zrip(fftSetup!, &complexBuffer, 1, vDSP_Length(log2(Float(fftSize))), FFTDirection(FFT_FORWARD))

        let halfSize = fftSize / 2
        var magnitudes = [Float](repeating: 0.0, count: halfSize)
        vDSP_zvmags(&complexBuffer, 1, &magnitudes, 1, vDSP_Length(halfSize))

        var scale: Float = 1.0 / Float(fftSize)
        magnitudes.withUnsafeMutableBufferPointer { pointer in
            vDSP_vsmul(pointer.baseAddress!, 1, &scale, pointer.baseAddress!, 1, vDSP_Length(halfSize))
        }

        // Convert magnitudes to a logarithmic scale
        let logMagnitudes = magnitudes.map { log10($0 + 1e-10) }

        // clamp to normalize
        let normalizedMagnitudes: [UInt8] = logMagnitudes.map { value in
            let clamped = min(max(value, minDB), maxDB)
            let norm = (clamped - minDB) / (maxDB - minDB)
            return UInt8(norm * 255.0)
        }

        var modifiedMagnitudes = normalizedMagnitudes

        // Set first 128 entries to 0, due the
        for i in 0..<min(128, modifiedMagnitudes.count) {
            modifiedMagnitudes[i] = 0
        }

        // The values on iOS seem to be very loud, With just dividing by 10 it seems to be cool lol
        // this got to be tested on all devices, but I dont have a lot of mac devices
        for i in 0..<modifiedMagnitudes.count {
            modifiedMagnitudes[i] /= 10
        }

        return modifiedMagnitudes
    }

    deinit {
        real.deallocate()
        imaginary.deallocate()
        if let fftSetup = fftSetup {
            vDSP_destroy_fftsetup(fftSetup)
        }
    }
}
