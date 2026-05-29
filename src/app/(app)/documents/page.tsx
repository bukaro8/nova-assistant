import Link from "next/link";
import { ArrowLeft, Eye, FileText, Pencil, Plus } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HabitToast } from "@/components/habit-manage-controls";
import { formatImportantDocumentType } from "@/lib/documents";
import { formatShortUkDate } from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const user = await requireCurrentUser();

  const documents = await prisma.importantDocument.findMany({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
      title: true,
      type: true,
      expiryDate: true,
      thumbnailUrl: true,
    },
    orderBy: [
      {
        expiryDate: {
          sort: "asc",
          nulls: "last",
        },
      },
      {
        createdAt: "desc",
      },
    ],
  });

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
          <h1 className="text-2xl font-semibold tracking-tight">
            Important Documents
          </h1>
          <p className="text-sm text-muted-foreground">
            Passport, licence and insurance records
          </p>
        </div>
      </header>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/documents/new"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Add document
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All documents</CardTitle>
          <CardDescription>
            {documents.length} document{documents.length === 1 ? "" : "s"} saved
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length > 0 ? (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((document) => (
                <article
                  key={document.id}
                  className="flex min-h-48 flex-col overflow-hidden rounded-3xl border border-border bg-background/40"
                >
                  {document.thumbnailUrl ? (
                    <div className="relative aspect-[4/3] border-b border-border bg-muted/70">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={document.title}
                        className="absolute inset-0 h-full w-full object-cover"
                        src={document.thumbnailUrl}
                      />
                    </div>
                  ) : (
                    <div className="grid aspect-[4/3] place-items-center border-b border-border bg-muted/70">
                      <div className="grid size-14 place-items-center rounded-2xl border border-border bg-background text-muted-foreground shadow-sm">
                        <FileText className="size-7" />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-3 p-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="truncate font-semibold">
                        {document.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {formatImportantDocumentType(document.type)}
                      </p>
                      {document.expiryDate ? (
                        <p className="text-xs text-muted-foreground">
                          Expires {formatShortUkDate(document.expiryDate)}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-auto flex gap-2">
                      <Link
                        href={`/documents/${document.id}`}
                        className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
                      >
                        <Eye className="size-4" />
                        View
                      </Link>
                      <Link
                        href={`/documents/${document.id}/edit`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-border bg-background text-sm font-medium transition-colors hover:bg-muted"
                      >
                        <Pencil className="size-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <div className="rounded-3xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
              No documents saved yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
