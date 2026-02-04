import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24">
      <div className="max-w-5xl w-full text-center">
        <h1 className="text-7xl font-bold mb-8 text-blue-900">LetterBox</h1>
        <p className="text-3xl text-gray-700 mb-8 font-medium">
          Leave Video Messages for Your Family
        </p>
        <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
          Record heartfelt video messages that will be safely kept and delivered to your loved ones when you're gone.
          Simple, secure, and personal.
        </p>
        <div className="flex gap-6 justify-center mb-8">
          <Link
            href="/auth/register"
            className="px-12 py-5 bg-blue-600 text-white text-xl rounded-lg hover:bg-blue-700 transition font-semibold shadow-lg"
          >
            Get Started Free
          </Link>
          <Link
            href="/auth/login"
            className="px-12 py-5 bg-white text-blue-600 border-2 border-blue-600 text-xl rounded-lg hover:bg-blue-50 transition font-semibold"
          >
            Log In
          </Link>
        </div>
        <p className="text-lg text-gray-500 mb-16">
          Already trusted by families preserving their memories
        </p>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-8 border-2 border-gray-200 rounded-lg bg-white shadow">
            <h3 className="text-2xl font-semibold mb-3 text-blue-900">🔒 Private & Secure</h3>
            <p className="text-lg text-gray-700 leading-relaxed">
              Your messages are kept completely private. Only the people you choose will ever see them.
            </p>
          </div>
          <div className="p-8 border-2 border-gray-200 rounded-lg bg-white shadow">
            <h3 className="text-2xl font-semibold mb-3 text-blue-900">👥 You're In Control</h3>
            <p className="text-lg text-gray-700 leading-relaxed">
              Choose trusted family or friends to help deliver your messages when the time comes.
            </p>
          </div>
          <div className="p-8 border-2 border-gray-200 rounded-lg bg-white shadow">
            <h3 className="text-2xl font-semibold mb-3 text-blue-900">📹 Easy to Use</h3>
            <p className="text-lg text-gray-700 leading-relaxed">
              Just click record and speak from your heart. No technical skills needed.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

