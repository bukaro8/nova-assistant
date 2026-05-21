"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { defaultAliasFromAccountName } from "@/lib/account-aliases";

function getAccountTypeLabel(type: string) {
  return type
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export function AccountForm({
  action,
  submitLabel,
  accountTypes,
  defaultType,
  account,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  accountTypes: string[];
  defaultType: string;
  account?: {
    name: string;
    type: string;
    aliases: string[];
    openingBalance: unknown;
    dueDay: number | null;
  };
}) {
  const existingAliases = account?.aliases.join("\n") ?? "";
  const [name, setName] = useState(account?.name ?? "");
  const [aliases, setAliases] = useState(
    existingAliases || defaultAliasFromAccountName(account?.name ?? ""),
  );
  const [aliasesTouched, setAliasesTouched] = useState(Boolean(existingAliases));

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Name
          <input
            className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            maxLength={80}
            name="name"
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);

              if (!aliasesTouched) {
                setAliases(defaultAliasFromAccountName(nextName));
              }
            }}
            placeholder="Barclays"
            required
            value={name}
          />
        </label>
        <label className="text-sm font-medium">
          Type
          <select
            className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            defaultValue={account?.type ?? defaultType}
            name="type"
          >
            {accountTypes.map((type) => (
              <option key={type} value={type}>
                {getAccountTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Opening balance
          <input
            className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            defaultValue={
              account ? Number(account.openingBalance).toFixed(2) : "0.00"
            }
            name="openingBalance"
            step="0.01"
            type="number"
          />
        </label>
        <label className="text-sm font-medium">
          Due day
          <input
            className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            defaultValue={account?.dueDay ?? ""}
            max={31}
            min={1}
            name="dueDay"
            placeholder="Credit cards only"
            type="number"
          />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Aliases
        <textarea
          className="mt-1 min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          name="aliases"
          onChange={(event) => {
            setAliasesTouched(true);
            setAliases(event.target.value);
          }}
          placeholder={"barclays\npulse"}
          value={aliases}
        />
      </label>
      <Button className="h-11 w-full rounded-2xl" type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
