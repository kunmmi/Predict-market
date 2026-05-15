-- Remove duplicate deposit rows caused by maybeSingle() bug in sweep cron.
-- For each tx_hash, keep only the approved row (or the earliest row if none approved).
-- Then add a UNIQUE constraint so this can never happen again.

DELETE FROM public.deposits
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY tx_hash
        ORDER BY
          CASE WHEN status = 'approved' THEN 0 ELSE 1 END,
          created_at ASC
      ) AS rn
    FROM public.deposits
    WHERE tx_hash IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Add unique constraint; NULLs are allowed (manual / legacy deposits with no tx_hash)
ALTER TABLE public.deposits
  ADD CONSTRAINT uq_deposits_tx_hash UNIQUE (tx_hash);
