import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { backfillMissingMarketPrices } = await import(
    "../lib/services/market-initial-prices"
  );
  const results = await backfillMissingMarketPrices();
  const inserted = results.filter((result) => result.inserted);
  const skipped = results.filter((result) => !result.inserted);

  console.log(`Inserted initial prices for ${inserted.length} market(s).`);

  for (const result of inserted) {
    console.log(`  [ok] ${result.slug}`);
  }

  for (const result of skipped) {
    console.log(`  [skip] ${result.slug}: ${result.skipped}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
