'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function AddVerifierPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    relationship: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/verifiers', {
        ...formData,
        planId: params.id,
      });

      if (response.data.success) {
        router.push(`/plans/${params.id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to add verifier');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href={`/plans/${params.id}`} className="text-blue-600 hover:underline">
            ← Back to Plan
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow px-8 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Add Verifier</h1>
            <p className="mt-2 text-gray-600">
              Invite a trusted person to verify your passing and approve message release
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., John Smith"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="verifier@example.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                They'll receive an invitation email to accept this role
              </p>
            </div>

            <div>
              <label htmlFor="relationship" className="block text-sm font-medium text-gray-700 mb-2">
                Relationship to You
              </label>
              <input
                type="text"
                id="relationship"
                value={formData.relationship}
                onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Brother, Attorney, Best Friend"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">What is a Verifier?</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Verifiers are trusted people who can confirm your passing</li>
                <li>• They'll receive an email invitation to accept this responsibility</li>
                <li>• When enough verifiers approve, your messages will be released</li>
                <li>• Choose people you trust completely (family, close friends, attorney)</li>
              </ul>
            </div>

            <div className="flex gap-4 pt-4">
              <Link
                href={`/plans/${params.id}`}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-center"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending Invitation...' : 'Add Verifier'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
