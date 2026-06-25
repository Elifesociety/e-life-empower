import { Layout } from "@/components/layout/Layout";
import { BentoHome } from "@/components/home/BentoHome";
import { CheckStatusSection } from "@/components/home/CheckStatusSection";
import { DepartmentWorkLogSection } from "@/components/home/DepartmentWorkLogSection";
import { DepartmentPendingSlider } from "@/components/home/DepartmentPendingSlider";

const Index = () => {
  return (
    <Layout>
      <BentoHome />
      <DepartmentPendingSlider />
      <CheckStatusSection />
      <DepartmentWorkLogSection />
    </Layout>
  );
};

export default Index;
