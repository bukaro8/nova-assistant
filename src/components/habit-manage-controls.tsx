"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type ServerAction = () => void | Promise<void>;

export function HabitToast() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const type = searchParams.get("type");

  if (!message) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 top-4 z-[80] md:left-auto md:right-6 md:w-96">
      <div
        className={`rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
          type === "error"
            ? "border-destructive/30 bg-destructive/15 text-destructive"
            : "border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
        }`}
      >
        {message}
      </div>
    </div>
  );
}

export function ConfirmActionButton({
  action,
  buttonLabel,
  title,
  message,
  confirmLabel,
  variant = "outline",
  showTrashIcon,
}: {
  action: ServerAction;
  buttonLabel: string;
  title: string;
  message: string;
  confirmLabel: string;
  variant?: "outline" | "destructive";
  showTrashIcon?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className="h-11 w-full rounded-2xl"
        type="button"
        variant={variant}
        onClick={() => setOpen(true)}
      >
        {showTrashIcon ? <Trash2 className="size-4" /> : null}
        {buttonLabel}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-background/80 p-4 backdrop-blur">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {message}
              </p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                className="h-11 rounded-2xl"
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <form action={action}>
                <Button
                  className="h-11 w-full rounded-2xl"
                  type="submit"
                  variant={variant}
                >
                  {confirmLabel}
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ActiveToggle({
  active,
  enableAction,
  disableAction,
}: {
  active: boolean;
  enableAction: ServerAction;
  disableAction: ServerAction;
}) {
  if (!active) {
    return (
      <form action={enableAction}>
        <Button className="h-11 w-full rounded-2xl" type="submit">
          Enable
        </Button>
      </form>
    );
  }

  return (
    <ConfirmActionButton
      action={disableAction}
      buttonLabel="Disable"
      title="Disable this habit?"
      message="You can enable it again later."
      confirmLabel="Disable"
    />
  );
}
