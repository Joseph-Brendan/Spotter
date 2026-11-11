import "server-only";
import QRCode from "qrcode";

// The QR holds the same six digits the member types, and nothing else, so a
// scan and a typed entry reach the verifier identically.
export async function checkInQrSvg(digits: string): Promise<string> {
  return QRCode.toString(digits, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#1b1b1dff", light: "#ffffffff" },
  });
}
