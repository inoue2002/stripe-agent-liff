'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { LiffMockPlugin } from '@line/liff-mock';

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
        if (!liff.isInClient()) liff.login();

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
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">LINEプロフィール</h1>
      <div className="space-y-2">
        {profile.pictureUrl && <img src={profile.pictureUrl} alt="Profile" className="w-24 h-24 rounded-full" />}
        <p className="font-bold">名前: {profile.displayName}</p>
        {profile.statusMessage && <p>ステータスメッセージ: {profile.statusMessage}</p>}
      </div>
    </div>
  );
}
