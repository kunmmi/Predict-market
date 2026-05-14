-- Fix title_zh and question_text_zh for all short-duration markets.
-- The old values contained wrong text ("宕机还是恢复运行？").
-- Correct text uses "上涨" (up) and "下跌" (down).

UPDATE public.markets
SET
  title_zh       = asset_symbol || ' 在接下来的 ' || duration_minutes || ' 分钟内，价格会上涨还是下跌？',
  question_text_zh = asset_symbol || ' 在接下来的 ' || duration_minutes || ' 分钟内，价格会上涨还是下跌？'
WHERE duration_minutes IS NOT NULL;
