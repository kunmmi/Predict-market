/**
 * Check recent USDT transfers to an address via BSCScan public API.
 * No API key required for basic lookups (rate-limited but sufficient).
 */
const ADDRESS = "0xAC0F212F8e11A3F5c5bc2cad06F215Ef384a87e8";
const USDT_BSC = "0x55d398326f99059ff775485246999027b3197955";

async function main() {
  const url = `https://api.bscscan.com/api?module=account&action=tokentx`
    + `&address=${ADDRESS}`
    + `&contractaddress=${USDT_BSC}`
    + `&sort=desc&offset=10&page=1`;

  const res = await fetch(url);
  const json = await res.json() as {
    status: string;
    message: string;
    result: Array<{
      hash: string;
      from: string;
      to: string;
      value: string;
      tokenDecimal: string;
      timeStamp: string;
      blockNumber: string;
      confirmations: string;
    }>;
  };

  if (json.status !== "1") {
    console.log("BSCScan response:", json.message, json.result);
    return;
  }

  console.log(`Recent USDT transfers to/from ${ADDRESS}:\n`);
  for (const tx of json.result) {
    const isIncoming = tx.to.toLowerCase() === ADDRESS.toLowerCase();
    const amount = parseFloat(tx.value) / 10 ** parseInt(tx.tokenDecimal);
    const date = new Date(parseInt(tx.timeStamp) * 1000).toISOString();
    const ageH = ((Date.now() - parseInt(tx.timeStamp) * 1000) / 3600000).toFixed(1);
    const dir = isIncoming ? "IN ↓" : "OUT ↑";
    console.log(`${dir}  $${amount.toFixed(4)} USDT  |  ${date}  (${ageH}h ago)  |  confirmations=${tx.confirmations}`);
    console.log(`      tx: ${tx.hash}`);
    console.log(`      from: ${tx.from}  →  to: ${tx.to}`);
    console.log();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
