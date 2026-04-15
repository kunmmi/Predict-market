-- Add Chinese language fields to markets table
ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS title_zh          text,
  ADD COLUMN IF NOT EXISTS description_zh    text,
  ADD COLUMN IF NOT EXISTS question_text_zh  text,
  ADD COLUMN IF NOT EXISTS rules_text_zh     text;
