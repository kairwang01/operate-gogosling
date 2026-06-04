import AppKit
import CoreGraphics

let args = CommandLine.arguments
let inPath = args.count > 1 ? args[1] : "assets/img/ca-flag.svg"
let outPath = args.count > 2 ? args[2] : "assets/img/ca-flag.png"
let width: CGFloat = 1200
let height: CGFloat = 600

guard let image = NSImage(contentsOfFile: inPath) else {
    fputs("Failed to load \(inPath)\n", stderr)
    exit(1)
}

let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: Int(width),
    pixelsHigh: Int(height),
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
)!
rep.size = NSSize(width: width, height: height)

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSColor.white.setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: width, height: height)).fill()
image.draw(in: NSRect(x: 0, y: 0, width: width, height: height),
           from: NSRect.zero,
           operation: .sourceOver,
           fraction: 1)
NSGraphicsContext.restoreGraphicsState()

guard let tiff = rep.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let png = bitmap.representation(using: NSBitmapImageRep.FileType.png, properties: [:]) else {
    fputs("Failed to encode PNG\n", stderr)
    exit(1)
}
try png.write(to: URL(fileURLWithPath: outPath))
print("Wrote \(outPath) (\(Int(width))×\(Int(height)))")
