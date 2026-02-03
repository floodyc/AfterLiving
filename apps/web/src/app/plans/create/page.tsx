'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function CreatePlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    totalVerifiers: 2,
    approvalThreshold: 2,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/plans', formData);
      if (response.data.success) {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow px-8 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Create Legacy Plan</h1>
            <p className="mt-2 text-gray-600">
              Set up a new plan for your posthumous video messages
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
                Plan Title *
              </label>
              <input
                type="text"
                id="title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., My Family Legacy"
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
                placeholder="Describe the purpose of this legacy plan..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="totalVerifiers" className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Verifiers *
                </label>
                <input
                  type="number"
                  id="totalVerifiers"
                  required
                  min="1"
                  max="10"
                  value={formData.totalVerifiers}
                  onChange={(e) => setFormData({ ...formData, totalVerifiers: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  How many people can verify your passing (1-10)
                </p>
              </div>

              <div>
                <label htmlFor="approvalThreshold" className="block text-sm font-medium text-gray-700 mb-2">
                  Approval Threshold *
                </label>
                <input
                  type="number"
                  id="approvalThreshold"
                  required
                  min="1"
                  max={formData.totalVerifiers}
                  value={formData.approvalThreshold}
                  onChange={(e) => setFormData({ ...formData, approvalThreshold: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  How many must approve release
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">How it works:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• You'll invite {formData.totalVerifiers} trusted people as verifiers</li>
                <li>• When {formData.approvalThreshold} of them confirm your passing, your messages will be released</li>
                <li>• You can add videos and recipients after creating the plan</li>
              </ul>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
