import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

import { ConfirmActionButton, HabitToast } from "@/components/habit-manage-controls";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Important Documents</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {document.title}
          </h1>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{document.title}</CardTitle>
          <CardDescription>
            {formatImportantDocumentType(document.type)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {imageSrc ? (
            <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-border bg-muted/70">
              <Image
                alt={document.title}
                className="object-cover"
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                src={imageSrc}
              />
            </div>
          ) : (
            <div className="grid aspect-[16/9] place-items-center rounded-3xl border border-border bg-muted/70">
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
