import { Suspense } from "react";
import { LoadingState } from "@/src/components";
import { TransfersView } from "@/src/components/transfers/transfers-view";

export default function TransfersPage() {
  // useSearchParams (inside the view) needs a Suspense boundary for static rendering.
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
          <LoadingState label="Loading transfers…" />
        </div>
      }
    >
      <TransfersView />
    </Suspense>
  );
}
