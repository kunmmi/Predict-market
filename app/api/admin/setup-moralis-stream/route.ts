/**
 * POST /api/admin/setup-moralis-stream
 *
 * One-time setup: creates a Moralis Stream that watches USDT (BEP-20) Transfer
 * events on BSC, then adds every existing deposit address to the stream.
 *
 * Protected by CRON_SECRET (same as the sweep endpoint).
 *
 * After running, copy the returned `streamId` into your Vercel env vars as
 * MORALIS_STREAM_ID — new deposit addresses will then be auto-subscribed.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const USDT_TRANSFER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      { indexed: false, internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
];

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const apiKey = process.env.MORALIS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "MORALIS_API_KEY not set" }, { status: 500 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.predictmarket.live").replace(/\/$/, "");
  const webhookUrl = `${appUrl}/api/webhooks/moralis`;
  const webhookSecret = process.env.MORALIS_WEBHOOK_SECRET;

  // 1. Create the stream
  const createBody = {
    webhookUrl,
    description: "USDT BEP-20 deposits",
    tag: "usdt-deposits-bsc",
    chainIds: ["0x38"], // BSC mainnet
    includeContractLogs: true,
    includeNativeTxs: false,
    abi: USDT_TRANSFER_ABI,
    topic0: ["Transfer(address,address,uint256)"],
    allAddresses: false,
    ...(webhookSecret ? { secret: webhookSecret } : {}),
  };

  const createRes = await fetch("https://api.moralis-streams.com/streams/evm", {
    method: "PUT", // Moralis Streams uses PUT to create
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    return NextResponse.json(
      { error: `Failed to create stream: ${createRes.status} ${errBody}` },
      { status: 500 },
    );
  }

  const stream = (await createRes.json()) as { id: string };
  const streamId = stream.id;

  // 2. Fetch all existing deposit addresses
  const supabase = createSupabaseAdminClient();
  const { data: wallets } = await supabase
    .from("wallets")
    .select("deposit_address");

  const addresses = (wallets ?? [])
    .map((w) => w.deposit_address as string | null)
    .filter((a): a is string => !!a && a.length > 0);

  const uniqueAddresses = Array.from(new Set(addresses.map((a) => a.toLowerCase())));

  // 3. Add all addresses to the stream (batched)
  const added: string[] = [];
  const failed: string[] = [];

  if (uniqueAddresses.length > 0) {
    const addRes = await fetch(
      `https://api.moralis-streams.com/streams/evm/${streamId}/address`,
      {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ address: uniqueAddresses }),
      },
    );

    if (addRes.ok) {
      added.push(...uniqueAddresses);
    } else {
      const errBody = await addRes.text();
      failed.push(`Batch add failed: ${addRes.status} ${errBody}`);
    }
  }

  return NextResponse.json({
    success: true,
    streamId,
    webhookUrl,
    addressesAdded: added.length,
    failed,
    nextStep: `Set MORALIS_STREAM_ID=${streamId} in Vercel env vars`,
  });
}
