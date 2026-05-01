import AppKit
import CoreGraphics
import Foundation
import Vision

struct Config {
  var hoverX: Double = 220
  var hoverY: Double = 56
  var captureX: Double = 0
  var captureY: Double = 0
  var captureWidth: Double = 980
  var captureHeight: Double = 320
  var delayMs: UInt32 = 1_200
  var outPath: String?
}

func readOption(_ args: [String], _ index: Int, _ option: String) throws -> String {
  let nextIndex = index + 1
  guard nextIndex < args.count else {
    throw NSError(domain: "tab-tooltip-ocr", code: 1, userInfo: [NSLocalizedDescriptionKey: "\(option) requires a value"])
  }
  return args[nextIndex]
}

func parseRect(_ value: String) throws -> (Double, Double, Double, Double) {
  let parts = value.split(separator: ",").map(String.init)
  guard parts.count == 4,
        let x = Double(parts[0]),
        let y = Double(parts[1]),
        let width = Double(parts[2]),
        let height = Double(parts[3]) else {
    throw NSError(domain: "tab-tooltip-ocr", code: 2, userInfo: [NSLocalizedDescriptionKey: "--rect must be x,y,width,height"])
  }
  return (x, y, width, height)
}

func parseArgs(_ args: [String]) throws -> Config {
  var config = Config()
  var index = 0

  while index < args.count {
    let arg = args[index]

    switch arg {
    case "--hover-x":
      config.hoverX = Double(try readOption(args, index, arg)) ?? config.hoverX
      index += 2
    case "--hover-y":
      config.hoverY = Double(try readOption(args, index, arg)) ?? config.hoverY
      index += 2
    case "--rect":
      let rect = try parseRect(try readOption(args, index, arg))
      config.captureX = rect.0
      config.captureY = rect.1
      config.captureWidth = rect.2
      config.captureHeight = rect.3
      index += 2
    case "--delay-ms":
      config.delayMs = UInt32(try readOption(args, index, arg)) ?? config.delayMs
      index += 2
    case "--out":
      config.outPath = try readOption(args, index, arg)
      index += 2
    default:
      index += 1
    }
  }

  return config
}

func moveMouse(to point: CGPoint) {
  let source = CGEventSource(stateID: .hidSystemState)
  let event = CGEvent(mouseEventSource: source, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)
  event?.post(tap: .cghidEventTap)
}

func captureScreen(config: Config) throws -> CGImage {
  let outPath = config.outPath ?? NSTemporaryDirectory() + "/tab-tooltip-ocr-\(UUID().uuidString).png"
  let rectValue = "\(Int(config.captureX)),\(Int(config.captureY)),\(Int(config.captureWidth)),\(Int(config.captureHeight))"
  let process = Process()
  process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
  process.arguments = ["-x", "-R", rectValue, outPath]

  try process.run()
  process.waitUntilExit()

  guard process.terminationStatus == 0 else {
    throw NSError(domain: "tab-tooltip-ocr", code: 3, userInfo: [NSLocalizedDescriptionKey: "screencapture failed. Grant Screen Recording permission to the terminal running this script."])
  }

  guard let image = NSImage(contentsOfFile: outPath) else {
    throw NSError(domain: "tab-tooltip-ocr", code: 4, userInfo: [NSLocalizedDescriptionKey: "Failed to read captured screenshot"])
  }

  var imageRect = CGRect(origin: .zero, size: image.size)
  guard let cgImage = image.cgImage(forProposedRect: &imageRect, context: nil, hints: nil) else {
    throw NSError(domain: "tab-tooltip-ocr", code: 5, userInfo: [NSLocalizedDescriptionKey: "Failed to decode captured screenshot"])
  }

  return cgImage
}

func recognizeText(_ image: CGImage) throws -> String {
  var recognizedText: [String] = []
  var recognitionError: Error?
  let semaphore = DispatchSemaphore(value: 0)

  let request = VNRecognizeTextRequest { request, error in
    recognitionError = error
    let observations = request.results as? [VNRecognizedTextObservation] ?? []
    recognizedText = observations.compactMap { observation in
      observation.topCandidates(1).first?.string
    }
    semaphore.signal()
  }

  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true

  let handler = VNImageRequestHandler(cgImage: image, options: [:])
  try handler.perform([request])
  semaphore.wait()

  if let recognitionError {
    throw recognitionError
  }

  return recognizedText.joined(separator: "\n")
}

func jsonEscape(_ value: String) -> String {
  let data = try! JSONSerialization.data(withJSONObject: [value], options: [])
  let encoded = String(data: data, encoding: .utf8)!
  return String(encoded.dropFirst().dropLast())
}

do {
  let config = try parseArgs(Array(CommandLine.arguments.dropFirst()))
  moveMouse(to: CGPoint(x: config.hoverX, y: config.hoverY))
  usleep(config.delayMs * 1_000)

  let image = try captureScreen(config: config)
  let text = try recognizeText(image)

  print("{\"ok\":true,\"text\":\(jsonEscape(text)),\"screenshotPath\":\(jsonEscape(config.outPath ?? ""))}")
} catch {
  let message = error.localizedDescription
  print("{\"ok\":false,\"error\":\(jsonEscape(message))}")
  exit(1)
}
