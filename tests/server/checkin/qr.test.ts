import jsQR from "jsqr";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { checkInQrSvg } from "@/server/checkin/qr";

// Rasterises the same QR matrix the server draws, at four pixels per module
// with a quiet zone, so jsQR reads it exactly as the keypad camera would.
function decodeLikeTheScanner(digits: string): string | null {
  const { modules } = QRCode.create(digits, { errorCorrectionLevel: "M" });
  const scale = 4;
  const quiet = 4;
  const size = (modules.size + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);

  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (!modules.get(row, col)) continue;

      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const y = (row + quiet) * scale + dy;
          const x = (col + quiet) * scale + dx;
          const offset = (y * size + x) * 4;
          pixels[offset] = 0;
          pixels[offset + 1] = 0;
          pixels[offset + 2] = 0;
        }
      }
    }
  }

  return jsQR(pixels, size, size)?.data ?? null;
}

describe("check in QR code", () => {
  it("draws an svg", async () => {
    const svg = await checkInQrSvg("048213");

    expect(svg.startsWith("<svg")).toBe(true);
  });

  it("holds exactly the six digits, leading zeros included", () => {
    expect(decodeLikeTheScanner("048213")).toBe("048213");
    expect(decodeLikeTheScanner("999999")).toBe("999999");
  });
});
