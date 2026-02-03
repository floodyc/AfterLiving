'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function CreateMessagePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    releaseConditions: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/messages', {
        ...formData,
        planId: params.id,
      });

      if (response.data.success) {
        router.push(`/plans/${params.id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create message');
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
            <h1 className="text-3xl font-bold text-gray-900">Create Video Message</h1>
            <p className="mt-2 text-gray-600">
              Set up a new video message for this legacy plan
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Message Title *
              </label>
              <input
                type="text"
                id="title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., To My Daughter Sarah"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe what this message is about..."
              />
            </div>

            <div>
              <label htmlFor="releaseConditions" className="block text-sm font-medium text-gray-700 mb-2">
                Release Conditions (Optional)
              </label>
              <textarea
                id="releaseConditions"
                rows={3}
                value={formData.releaseConditions}
                onChange={(e) => setFormData({ ...formData, releaseConditions: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Release on her 18th birthday, or when she graduates college..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Specify any special conditions for when this message should be released
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2">Next Steps:</h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• After creating, you'll upload your video</li>
                <li>• Add recipients who should receive this message</li>
                <li>• The message will be encrypted and stored securely</li>
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
                {loading ? 'Creating...' : 'Create Message'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
