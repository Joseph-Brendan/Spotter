const NAIRA_PATTERN = /^\d+(\.\d{1,2})?$/;

export function parseNairaToKobo(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");

  if (!NAIRA_PATTERN.test(normalized)) {
    return null;
  }

  const [whole, fraction = ""] = normalized.split(".");
  const kobo = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  return Number.isSafeInteger(kobo) ? kobo : null;
}

export function formatKobo(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(kobo / 100);
}

export function koboToNairaInput(kobo: number): string {
  return (kobo / 100).toFixed(2).replace(/\.00$/, "");
}
