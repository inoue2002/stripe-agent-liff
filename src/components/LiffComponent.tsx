'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { LiffMockPlugin } from '@line/liff-mock';
import ChatComponent from './ChatComponent';

export default function LiffComponent() {
  const [profile, setProfile] = useState<{
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        if (process.env.NODE_ENV === 'development') {
          liff.use(new LiffMockPlugin());
        }
        await liff.init({
          liffId: process.env.NEXT_PUBLIC_LIFF_ID as string,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          mock: process.env.NODE_ENV === 'development',
        });
        if (!liff.isInClient()) {
          liff.login();
        }

        const userProfile = await liff.getProfile();
        setProfile(userProfile);
      } catch (err) {
        setError('LIFFの初期化に失敗しました');
        console.error(err);
      }
    };

    initLiff();
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!profile) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 bg-blue-600 text-white flex items-center space-x-4">
            <img
              src="/sample.jpg"
              alt="AI Assistant"
              className="w-12 h-12 rounded-full border-2 border-white"
            />
            <div>
              <h1 className="text-xl font-bold">カフェアシスタント</h1>
              <p className="text-sm opacity-80">いらっしゃいませ！ご注文をお伺いします</p>
            </div>
          </div>
          <ChatComponent />
        </div>
      </div>
    </div>
  );
}
