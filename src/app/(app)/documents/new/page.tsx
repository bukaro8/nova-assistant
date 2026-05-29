import Link from "next/link";
import { ArrowLeft, FilePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HabitToast } from "@/components/habit-manage-controls";
import {
  formatImportantDocumentType,
  importantDocumentTypes,
} from "@/lib/documents";
import { requireCurrentUser } from "@/server/dashboard/user";

export const dynamic = "force-dynamic";

export default async function NewImportantDocumentPage() {
  await requireCurrentUser();

  return (
    <div className="space-y-5">
      <HabitToast />
      <header className="space-y-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Important Documents</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Add document
          </h1>
        </div>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FilePlus className="size-5 text-primary" />
            <CardTitle>Document details</CardTitle>
          </div>
          <CardDescription>
            Add the image, title, type, expiry date and any notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action="/api/documents"
            className="space-y-3"
            encType="multipart/form-data"
            method="post"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Title
                <input
                  className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  maxLength={120}
                  name="title"
                  placeholder="Passport"
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Type
                <select
                  className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  name="type"
                  required
                >
                  {importantDocumentTypes.map((type) => (
                    <option key={type} value={type}>
                      {formatImportantDocumentType(type)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium">
              Image
              <input
                accept="image/*"
                className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
                name="image"
                required
                type="file"
              />
            </label>
            <label className="block text-sm font-medium">
              Expiry date
              <input
                className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                name="expiryDate"
                type="date"
              />
            </label>
            <label className="block text-sm font-medium">
              Notes
              <textarea
                className="mt-1 min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                maxLength={1000}
                name="notes"
                placeholder="Policy number, renewal details, or reminders"
              />
            </label>
            <Button className="h-11 w-full rounded-2xl" type="submit">
              Add document
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
