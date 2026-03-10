// pages/auth/login.tsx — Redirects to proper business login
import type { NextPage } from 'next';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const LoginRedirect: NextPage = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace('/business/auth/login');
  }, [router]);
  return null;
};

export default LoginRedirect;
