// pages/auth/login.tsx — Redirects to consumer signin page
import type { NextPage } from 'next';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const LoginRedirect: NextPage = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace('/signin');
  }, [router]);
  return null;
};

export default LoginRedirect;
