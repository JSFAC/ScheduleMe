import type { GetServerSideProps, NextPage } from 'next';

const ConciergeRedirectPage: NextPage = () => null;

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/form',
      permanent: false,
    },
  };
};

export default ConciergeRedirectPage;
