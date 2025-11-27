#!/usr/bin/env node
/**
 * Lightweight relayer helper that fetches the latest Pyth price snapshot and
 * submits it on-chain via `oracle::submit_pyth_price`. Requires Node.js 18+
 * (for global `fetch`) or a compatible runtime.
 *
 * Environment variables:
 *  - APTOS_NETWORK       (e.g. "testnet", "devnet", "local")
 *  - APTOS_NODE_URL      (optional fullnode URL override)
 *  - RELAYER_PRIVATE_KEY (hex string for the relayer account)
 *  - MODULE_ADDRESS      (prediction market module address, e.g. 0xcafe...)
 *  - MARKET_ID           (numeric market identifier to update)
 *  - PYTH_FEED_ID        (32-byte hex string feed id, with or without 0x)
 *  - RESOLUTION_HINT     (optional u8, e.g. 1 for outcome index)
 *
 * Run with: `node scripts/pyth-relayer.js`
 */

const { createHash } = require("crypto");
const {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} = require("@aptos-labs/ts-sdk");

async function main() {
  const {
    APTOS_NETWORK = "testnet",
    APTOS_NODE_URL,
    RELAYER_PRIVATE_KEY,
    MODULE_ADDRESS,
    MARKET_ID,
    PYTH_FEED_ID,
    RESOLUTION_HINT,
  } = process.env;

  if (!RELAYER_PRIVATE_KEY) {
    throw new Error("RELAYER_PRIVATE_KEY env var is required");
  }
  if (!MODULE_ADDRESS) {
    throw new Error("MODULE_ADDRESS env var is required");
  }
  if (!MARKET_ID) {
    throw new Error("MARKET_ID env var is required");
  }
  if (!PYTH_FEED_ID) {
    throw new Error("PYTH_FEED_ID env var is required");
  }

  const feedIdHex = normalizeHex(PYTH_FEED_ID);

  const config = new AptosConfig({
    network: resolveNetwork(APTOS_NETWORK),
    fullnode: APTOS_NODE_URL,
  });
  const aptos = new Aptos(config);

  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(normalizeHex(RELAYER_PRIVATE_KEY)),
  });

  console.log(`[relayer] fetching latest price for feed ${feedIdHex}`);
  const priceData = await fetchLatestPrice(feedIdHex);
  const vaaBytes = await fetchLatestVaa(feedIdHex);

  const vaaHashHex = createHash("sha3-256").update(vaaBytes).digest("hex");

  const priceMagnitude = BigInt(Math.abs(priceData.price));
  const priceNegative = priceData.price < 0;
  const confidence = BigInt(priceData.conf);
  const expoMagnitude = BigInt(Math.abs(priceData.expo));
  const expoNegative = priceData.expo < 0;
  const publishTime = BigInt(priceData.publish_time);

  const functionArguments = [
    Number(MARKET_ID),
    priceMagnitude.toString(),
    priceNegative,
    confidence.toString(),
    expoMagnitude.toString(),
    expoNegative,
    publishTime.toString(),
    `0x${vaaHashHex}`,
    RESOLUTION_HINT !== undefined ? Number(RESOLUTION_HINT) : null,
  ];

  console.log("[relayer] submitting snapshot to oracle::submit_pyth_price");
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${MODULE_ADDRESS}::oracle::submit_pyth_price`,
      typeArguments: [],
      functionArguments,
    },
  });

  const pendingTxn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });

  console.log("[relayer] submitted tx:", pendingTxn.hash);
  await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
  console.log("[relayer] transaction confirmed");
}

async function fetchLatestPrice(feedIdHex) {
  const url = `https://hermes.pyth.network/api/latest_price_feeds?ids[]=${feedIdHex}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch price feed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error("price feed response missing data");
  }
  const feed = json[0];
  if (!feed.price || feed.price.price === undefined) {
    throw new Error("price feed response missing price");
  }
  return {
    price: Number(feed.price.price),
    conf: Number(feed.price.confidence),
    expo: Number(feed.price.expo),
    publish_time: Number(feed.price.publish_time ?? feed.publish_time),
  };
}

async function fetchLatestVaa(feedIdHex) {
  const url = `https://hermes.pyth.network/api/latest_vaas?ids[]=${feedIdHex}&binary=base64`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch VAA: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (!json || !Array.isArray(json) || !json[0]?.vaa) {
    throw new Error("VAA response missing payload");
  }
  return Buffer.from(json[0].vaa, "base64");
}

function resolveNetwork(network) {
  const upper = network.toUpperCase();
  if (upper === "MAINNET") return Network.MAINNET;
  if (upper === "TESTNET") return Network.TESTNET;
  if (upper === "DEVNET") return Network.DEVNET;
  if (upper === "LOCAL" || upper === "LOCALNET") return Network.LOCALHOST;
  console.warn(
    `[relayer] unknown APTOS_NETWORK "${network}", defaulting to custom configuration`
  );
  return network;
}

function normalizeHex(value) {
  return value.startsWith("0x") ? value : `0x${value}`;
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[relayer] failed:", error);
    process.exit(1);
  });
}
