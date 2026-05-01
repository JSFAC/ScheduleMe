import type { GetServerSideProps, NextPage } from 'next';

const FormAliasPage: NextPage = () => null;

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/concierge',
      permanent: false,
    },
  };
};

export default FormAliasPage;
