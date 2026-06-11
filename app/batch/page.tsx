import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BatchChecker } from "@/components/batch/BatchChecker";

export const metadata: Metadata = {
  title: "Check a batch — Label Check",
};

export default function BatchPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <p className="mb-6 text-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-medium text-primary underline underline-offset-4 hover:text-primary/80"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Check a single label
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Check a batch</h1>
      <p className="mt-3 mb-8 text-muted-foreground">
        Upload your applications CSV and the label images. Every row is
        checked field by field; you review whatever gets flagged.
      </p>
      <BatchChecker />
    </main>
  );
}
