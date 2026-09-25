import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-ottodot-blue mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-600 mb-8 max-w-md">
          Oops! The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-ottodot-blue text-white font-semibold rounded-lg hover:bg-ottodot-blue/90 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
