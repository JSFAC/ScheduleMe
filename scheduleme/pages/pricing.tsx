import type { GetServerSideProps, NextPage } from 'next';

const PricingRedirect: NextPage = () => null;

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/#pricing',
    permanent: false,
  },
});

export default PricingRedirect;
