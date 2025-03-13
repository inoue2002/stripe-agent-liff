'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';

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
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID as string });
        if (!liff.isLoggedIn()) {
          liff.login();
        } else {
          const userProfile = await liff.getProfile();
          setProfile(userProfile);
        }
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
        {profile.pictureUrl && (
          <img
            src={profile.pictureUrl}
            alt="Profile"
            className="w-24 h-24 rounded-full"
          />
        )}
        <p className="font-bold">名前: {profile.displayName}</p>
        {profile.statusMessage && (
          <p>ステータスメッセージ: {profile.statusMessage}</p>
        )}
      </div>
    </div>
  );
}
