"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/client";
import { Button } from "@/components/Button";

export default function LoginPage() {
  const router = useRouter();
  const { signInWithEmail, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await signInWithEmail(email, password);

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/bookings");
    router.refresh();
  };

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await signInWithMagicLink(email);

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setMagicLinkSent(true);
    setLoading(false);
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center py-12">
        <div className="max-w-md w-full mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Check your email
            </h2>
            <p className="text-gray-600 mb-6">
              We sent a magic link to <span className="font-medium">{email}</span>
            </p>
            <p className="text-sm text-gray-500">
              Click the link in the email to sign in. You can close this tab.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-600 mt-2">
              Sign in to manage your bookings
            </p>
          </div>

          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setIsMagicLink(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !isMagicLink
                  ? "bg-white text-gray-900 shadow"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Password
            </button>
            <button
              onClick={() => setIsMagicLink(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                isMagicLink
                  ? "bg-white text-gray-900 shadow"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Magic Link
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {isMagicLink ? (
            <form onSubmit={handleMagicLinkLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Magic Link"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/signup"
                className="text-ottodot-blue hover:underline font-medium"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
