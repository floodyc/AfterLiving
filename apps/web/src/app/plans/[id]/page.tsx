'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Plan {
  id: string;
  title: string;
  description: string;
  status: string;
  approvalThreshold: number;
  totalVerifiers: number;
  messages: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    _count: { recipients: number };
  }>;
  verifiers: Array<{
    id: string;
    email: string;
    name: string | null;
    status: string;
    invitedAt: string;
  }>;
}

export default function PlanDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPlan();
  }, [params.id]);

  const loadPlan = async () => {
    try {
      const response = await api.get(`/api/plans/${params.id}`);
      if (response.data.success) {
        setPlan(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || 'Plan not found'}
          </div>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link href="/dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <div className="bg-white rounded-lg shadow px-6 py-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{plan.title}</h1>
                {plan.description && (
                  <p className="mt-2 text-gray-600">{plan.description}</p>
                )}
                <div className="mt-4 flex gap-4 text-sm text-gray-500">
                  <span>Status: <span className="font-medium text-green-600">{plan.status}</span></span>
                  <span>Verifiers: {plan.verifiers.length} / {plan.totalVerifiers}</span>
                  <span>Approval needed: {plan.approvalThreshold}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Video Messages</h2>
                <Link
                  href={`/plans/${plan.id}/messages/create`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  + Add Message
                </Link>
              </div>
              <div className="p-6">
                {plan.messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No messages yet</p>
                    <Link
                      href={`/plans/${plan.id}/messages/create`}
                      className="text-blue-600 hover:underline"
                    >
                      Create your first message
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {plan.messages.map((message) => (
                      <Link
                        key={message.id}
                        href={`/messages/${message.id}`}
                        className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow transition"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">{message.title}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {message._count.recipients} recipient(s)
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded ${
                            message.status === 'READY' ? 'bg-green-100 text-green-800' :
                            message.status === 'UPLOADED' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {message.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Verifiers</h2>
                <Link
                  href={`/plans/${plan.id}/verifiers/add`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  + Add Verifier
                </Link>
              </div>
              <div className="p-6">
                {plan.verifiers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No verifiers yet</p>
                    <Link
                      href={`/plans/${plan.id}/verifiers/add`}
                      className="text-blue-600 hover:underline"
                    >
                      Invite your first verifier
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {plan.verifiers.map((verifier) => (
                      <div
                        key={verifier.id}
                        className="p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {verifier.name || verifier.email}
                            </h3>
                            {verifier.name && (
                              <p className="text-sm text-gray-500">{verifier.email}</p>
                            )}
                          </div>
                          <span className={`px-2 py-1 text-xs rounded ${
                            verifier.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                            verifier.status === 'INVITED' ? 'bg-yellow-100 text-yellow-800' :
                            verifier.status === 'DECLINED' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {verifier.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 text-sm text-gray-500">
                  {plan.verifiers.length} of {plan.totalVerifiers} verifiers added
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">How Release Works</h3>
          <p className="text-blue-800 text-sm">
            When {plan.approvalThreshold} of your {plan.totalVerifiers} verifiers confirm your passing,
            all video messages in this plan will be released to their designated recipients.
          </p>
        </div>
      </div>
    </div>
  );
}
