import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, Pencil } from "lucide-react";

import { ConfirmActionButton, HabitToast } from "@/components/habit-manage-controls";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatImportantDocumentType } from "@/lib/documents";
import {
  formatShortUkDate,
  formatUkDate,
} from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { deleteImportantDocument } from "@/server/documents/actions";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

type DocumentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DocumentDetailPage({
  params,
}: DocumentDetailPageProps) {
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
      createdAt: true,
      provider: true,
      storageKey: true,
      thumbnailUrl: true,
    },
  });

  if (!document) {
    notFound();
  }

  const deleteAction = deleteImportantDocument.bind(null, document.id);
  const imageSrc = document.thumbnailUrl;

  return (
    <div className="space-y-5">
      <HabitToast />
      <header className="space-y-3">
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Documents
        </Link>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Important Documents</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {document.title}
          </h1>
        </div>
      </header>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{document.title}</CardTitle>
            <CardDescription>
              {formatImportantDocumentType(document.type)}
            </CardDescription>
          </div>
          <Link href={`/documents/${document.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="size-4" />
              Edit
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          {imageSrc ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-muted/70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={document.title}
                className="absolute inset-0 h-full w-full object-contain"
                src={imageSrc}
              />
              <a
                href={imageSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-3 right-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-background/90 px-2.5 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
              >
                <ExternalLink className="size-4" />
                View full image
              </a>
            </div>
          ) : (
            <div className="grid aspect-[4/3] place-items-center rounded-3xl border border-border bg-muted/70">
              <div className="grid size-20 place-items-center rounded-3xl border border-border bg-background text-muted-foreground shadow-sm">
                <FileText className="size-10" />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/40 p-3">
              <div className="text-xs text-muted-foreground">Type</div>
              <div className="mt-1 font-semibold">
                {formatImportantDocumentType(document.type)}
              </div>
            </div>
            {document.expiryDate ? (
              <div className="rounded-2xl border border-border bg-background/40 p-3">
                <div className="text-xs text-muted-foreground">Expiry date</div>
                <div className="mt-1 font-semibold">
                  {formatShortUkDate(document.expiryDate)}
                </div>
              </div>
            ) : null}
            <div className="rounded-2xl border border-border bg-background/40 p-3">
              <div className="text-xs text-muted-foreground">Created</div>
              <div className="mt-1 font-semibold">
                {formatUkDate(document.createdAt)}
              </div>
            </div>
          </div>

          {document.notes ? (
            <div className="rounded-2xl border border-border bg-background/40 p-3">
              <div className="text-xs text-muted-foreground">Notes</div>
              <p className="mt-2 whitespace-pre-line text-sm">
                {document.notes}
              </p>
            </div>
          ) : null}

          <ConfirmActionButton
            action={deleteAction}
            buttonLabel="Delete document"
            confirmLabel="Delete"
            message="This removes the saved document metadata. This cannot be undone."
            showTrashIcon
            title="Delete this document?"
            variant="destructive"
          />
        </CardContent>
      </Card>
    </div>
  );
}
