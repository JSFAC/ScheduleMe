import type { GetServerSideProps, NextPage } from 'next';

const ConciergeFlyerRedirectPage: NextPage = () => null;

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/flyer/form',
      permanent: false,
    },
  };
};

export default ConciergeFlyerRedirectPage;
