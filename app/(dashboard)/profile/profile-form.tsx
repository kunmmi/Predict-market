"use client";

import { useFormState } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { T } from "@/lib/i18n/translations";

import { type UpdateProfileState, updateProfileAction } from "./actions";

const initialState: UpdateProfileState = {};

export function ProfileForm({
  defaultFullName,
  t,
}: {
  defaultFullName: string | null;
  t: T["profile"];
}) {
  const [state, formAction] = useFormState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="full_name"
          className="text-sm font-medium text-slate-900"
        >
          {t.display_name_label}
        </label>
        <Input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          placeholder={t.name_placeholder}
          defaultValue={defaultFullName ?? ""}
          maxLength={100}
          aria-invalid={state.error ? true : undefined}
        />
        {state.error ? (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-sm text-emerald-700" role="status">
            {t.saved}
          </p>
        ) : null}
      </div>
      <Button type="submit">{t.save}</Button>
    </form>
  );
}
