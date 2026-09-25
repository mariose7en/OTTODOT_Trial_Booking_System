"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Page Error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-ottodot-red mb-4">Oops!</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-8 max-w-md">
          We encountered an unexpected error. Please try again or contact
          support if the problem persists.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-ottodot-blue text-white font-semibold rounded-lg hover:bg-ottodot-blue/90 transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-6 py-3 border-2 border-ottodot-blue text-ottodot-blue font-semibold rounded-lg hover:bg-ottodot-blue/10 transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
