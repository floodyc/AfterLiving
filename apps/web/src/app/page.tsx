import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-5xl w-full text-center">
        <h1 className="text-6xl font-bold mb-6">LegacyVideo</h1>
        <p className="text-2xl text-gray-600 mb-8">
          Secure posthumous video message delivery for your loved ones
        </p>
        <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto">
          Create video messages that will be securely stored and delivered to your loved ones
          after you pass away, using a trusted verifier system.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/login"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Log In
          </Link>
          <Link
            href="/auth/register"
            className="px-8 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
          >
            Sign Up
          </Link>
        </div>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">🔒 Secure Storage</h3>
            <p className="text-gray-600">
              Videos encrypted with envelope encryption. Your messages stay private and secure.
            </p>
          </div>
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">👥 Trusted Verifiers</h3>
            <p className="text-gray-600">
              Nominate trusted people who can request release. No automatic detection.
            </p>
          </div>
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">📝 Audit Trail</h3>
            <p className="text-gray-600">
              Every action is logged. Complete transparency and accountability.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
