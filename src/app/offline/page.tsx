export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0b] px-6 py-16 text-zinc-100">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950/70 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-2xl font-bold text-white">
          D
        </div>
        <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          DriveThing needs a connection to sync files and folders. Reconnect and
          reload to continue.
        </p>
      </div>
    </main>
  );
}
