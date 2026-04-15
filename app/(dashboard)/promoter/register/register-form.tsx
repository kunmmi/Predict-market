"use client";

import { useFormState } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  registerPromoterAction,
  type PromoterRegisterState,
} from "./actions";

const initialState: PromoterRegisterState = {};

export function PromoterRegisterForm({
  defaultDisplayName,
}: {
  defaultDisplayName: string;
}) {
  const [state, action] = useFormState(registerPromoterAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="display_name"
          className="text-sm font-medium text-slate-900"
        >
          Promoter display name
        </label>
        <Input
          id="display_name"
          name="display_name"
          defaultValue={defaultDisplayName}
          placeholder="e.g. Alpha Signals"
          maxLength={200}
          required
        />
        <p className="text-xs text-slate-500">
          Promo code is auto-generated from your display name.
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit">Create promoter profile</Button>
    </form>
  );
}
