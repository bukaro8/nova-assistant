import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

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
import { updateImportantDocument } from "@/server/documents/actions";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

type EditDocumentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDateForInput(date: Date) {
  return date.toISOString().split("T")[0];
}

export default async function EditDocumentPage({
  params,
}: EditDocumentPageProps) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const document = await prisma.importantDocument.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: {
      id: true,
      title: true,
      type: true,
      expiryDate: true,
      notes: true,
      thumbnailUrl: true,
    },
  });

  if (!document) {
    notFound();
  }

  const updateAction = updateImportantDocument.bind(null, document.id);

  return (
    <div className="space-y-5">
      <HabitToast />
      <header className="space-y-3">
        <Link
          href={`/documents/${document.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Important Documents</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit document
          </h1>
        </div>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Save className="size-5 text-primary" />
            <CardTitle>Document details</CardTitle>
          </div>
          <CardDescription>
            Edit the title, type, expiry date and notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateAction} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Title
                <input
                  className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  defaultValue={document.title}
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
                  defaultValue={document.type}
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
              Expiry date
              <input
                className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                defaultValue={
                  document.expiryDate
                    ? formatDateForInput(document.expiryDate)
                    : ""
                }
                name="expiryDate"
                type="date"
              />
            </label>
            <label className="block text-sm font-medium">
              Notes
              <textarea
                className="mt-1 min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                defaultValue={document.notes ?? ""}
                maxLength={1000}
                name="notes"
                placeholder="Policy number, renewal details, or reminders"
              />
            </label>
            {document.thumbnailUrl ? (
              <div className="rounded-2xl border border-border bg-background/40 p-3 text-sm text-muted-foreground">
                Image will not be changed. To update the image, delete this
                document and add a new one.
              </div>
            ) : null}
            <Button className="h-11 w-full rounded-2xl" type="submit">
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
