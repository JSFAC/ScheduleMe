// pages/demo.tsx — redirects to /bookings
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Demo() {
  const router = useRouter();
  useEffect(() => { router.replace('/bookings'); }, [router]);
  return null;
}
