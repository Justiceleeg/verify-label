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
          className="font-medium text-blue-700 underline dark:text-blue-400"
        >
          ← Check a single label
        </Link>
      </p>
      <h1 className="text-3xl font-bold">Check a batch</h1>
      <p className="mt-2 mb-8 text-gray-600 dark:text-gray-400">
        Upload your applications CSV and the label images. Every row is
        checked field by field; you review whatever gets flagged.
      </p>
      <BatchChecker />
    </main>
  );
}
