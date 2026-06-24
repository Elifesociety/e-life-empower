import { Layout } from "@/components/layout/Layout";
import { BentoHome } from "@/components/home/BentoHome";
import { CheckStatusSection } from "@/components/home/CheckStatusSection";
import { DepartmentWorkLogSection } from "@/components/home/DepartmentWorkLogSection";

const Index = () => {
  return (
    <Layout>
      <BentoHome />
      <CheckStatusSection />
      <DepartmentWorkLogSection />
    </Layout>
  );
};

export default Index;
