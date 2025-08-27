import ChatUI from '@/components/ChatUI'

export default function Page() {
  return (
    <main className="min-h-screen">
      <div className="container-max py-8 md:py-12">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">SmartDevBox Web</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">A clean, modern coding assistant UI inspired by Blackbox Agent.</p>
        </div>
        <ChatUI />
      </div>
    </main>
  )
}
