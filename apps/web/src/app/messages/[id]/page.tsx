'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Message {
  id: string;
  title: string;
  description: string;
  status: string;
  releaseConditions: string | null;
  videoUrl: string | null;
  createdAt: string;
  plan: {
    id: string;
    title: string;
  };
  recipients: Array<{
    id: string;
    email: string;
    name: string | null;
    relationship: string | null;
  }>;
}

export default function MessageDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMessage();
  }, [params.id]);

  const loadMessage = async () => {
    try {
      const response = await api.get(`/api/messages/${params.id}`);
      if (response.data.success) {
        setMessage(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load message');
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

  if (error || !message) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || 'Message not found'}
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href={`/plans/${message.plan.id}`} className="text-blue-600 hover:underline">
            ← Back to {message.plan.title}
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow px-6 py-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{message.title}</h1>
              {message.description && (
                <p className="mt-2 text-gray-600">{message.description}</p>
              )}
            </div>
            <span className={`px-3 py-1 rounded text-sm font-medium ${
              message.status === 'READY' ? 'bg-green-100 text-green-800' :
              message.status === 'UPLOADED' ? 'bg-blue-100 text-blue-800' :
              message.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {message.status}
            </span>
          </div>

          {message.releaseConditions && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Release Conditions:</h3>
              <p className="text-sm text-blue-800">{message.releaseConditions}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Video</h2>
          </div>
          <div className="p-6">
            {message.videoUrl ? (
              <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                <video
                  controls
                  className="max-w-full max-h-full"
                  src={message.videoUrl}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500 mb-4">No video uploaded yet</p>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Upload Video
                </button>
                <p className="text-xs text-gray-400 mt-2">Max file size: 500MB</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Recipients</h2>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
              + Add Recipient
            </button>
          </div>
          <div className="p-6">
            {message.recipients.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No recipients added yet</p>
                <button className="text-blue-600 hover:underline">
                  Add your first recipient
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {message.recipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className="p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {recipient.name || recipient.email}
                        </h3>
                        {recipient.name && (
                          <p className="text-sm text-gray-500">{recipient.email}</p>
                        )}
                        {recipient.relationship && (
                          <p className="text-xs text-gray-400 mt-1">{recipient.relationship}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-900 mb-2">Message Status</h3>
          <p className="text-sm text-yellow-800">
            {message.status === 'DRAFT' && 'This message is in draft status. Upload a video and add recipients to make it ready.'}
            {message.status === 'PENDING_UPLOAD' && 'Upload your video to continue.'}
            {message.status === 'UPLOADED' && 'Video uploaded. Add recipients to complete setup.'}
            {message.status === 'READY' && 'This message is ready. It will be delivered to recipients when your verifiers approve release.'}
          </p>
        </div>
      </div>
    </div>
  );
}
