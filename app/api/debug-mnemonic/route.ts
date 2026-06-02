// TEMPORARY — DELETE THIS FILE IMMEDIATELY AFTER USE
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    mnemonic: process.env.DEPOSIT_WALLET_MNEMONIC,
    xpub: process.env.DEPOSIT_WALLET_XPUB,
    pk_eth: process.env.WALLET_PRIVATE_KEY_ETH,
  });
}
