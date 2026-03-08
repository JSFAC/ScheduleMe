// pages/search-test.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Nav from '../components/Nav';
import SearchTester from '../components/SearchTester';

const SearchTestPage: NextPage = () => (
  <>
    <Head>
      <title>Search Test — ScheduleMe</title>
      <meta name="robots" content="noindex" />
    </Head>
    <Nav />
    <main className="min-h-screen bg-neutral-50 pt-[72px] pb-16">
      <SearchTester />
    </main>
  </>
);

export default SearchTestPage;
