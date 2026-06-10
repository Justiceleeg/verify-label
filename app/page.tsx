import Link from "next/link";
import { SingleLabelChecker } from "@/components/SingleLabelChecker";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-bold">Label Check</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Enter the application details, add the label photos, and we&apos;ll
        compare them field by field.
      </p>
      <p className="mt-2 mb-8 text-sm">
        Many labels to check?{" "}
        <Link
          href="/batch"
          className="font-medium text-blue-700 underline dark:text-blue-400"
        >
          Upload a batch CSV instead
        </Link>
      </p>
      <SingleLabelChecker />
    </main>
  );
}
