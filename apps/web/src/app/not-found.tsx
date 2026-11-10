import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/dashboard" className="text-sm text-accent hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
