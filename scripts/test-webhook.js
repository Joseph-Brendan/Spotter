#!/usr/bin/env node

/**
 * scripts/test-webhook.js
 *
 * Forwards/simulates a Flutterwave webhook to the local dev server (http://localhost:3000/api/payments/webhook).
 * Useful when testing Flutterwave in development without an ngrok/cloudflared tunnel.
 *
 * Usage:
 *   node scripts/test-webhook.js <tx_ref> <transaction_id>
 *
 * Example:
 *   node scripts/test-webhook.js spotter_1793213106980_c5a03c0f 10580317
 */

const fs = require("fs");
const path = require("path");

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  } else {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  }
}

const txRef = process.argv[2];
const transactionId = process.argv[3];

if (!txRef || !transactionId) {
  console.error("Usage: node scripts/test-webhook.js <tx_ref> <transaction_id>");
  process.exit(1);
}

const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
if (!secretHash) {
  console.error("Error: FLUTTERWAVE_WEBHOOK_HASH is not set in .env");
  process.exit(1);
}

const appUrl = process.env.APP_URL || "http://localhost:3000";
const webhookUrl = `${appUrl}/api/payments/webhook`;

const payload = {
  event: "charge.completed",
  data: {
    id: transactionId,
    tx_ref: txRef,
    flw_ref: `flw_ref_${transactionId}`,
    status: "successful",
  },
};

console.log(`Sending webhook to: ${webhookUrl}`);
console.log(`tx_ref: ${txRef}, transaction_id: ${transactionId}`);

fetch(webhookUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "verif-hash": secretHash,
  },
  body: JSON.stringify(payload),
})
  .then(async (res) => {
    const text = await res.text();
    console.log(`Response status: ${res.status}`);
    console.log(`Response body: ${text}`);
    if (res.ok) {
      console.log("✓ Webhook processed successfully. Check Prisma Studio / PaymentLog / Payment.");
    } else {
      console.error("✗ Webhook processing returned an error.");
    }
  })
  .catch((err) => {
    console.error("Failed to connect to local webhook endpoint:", err.message);
  });
