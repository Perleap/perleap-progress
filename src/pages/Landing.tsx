import { Navbar } from "@/components/layouts/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/layouts/Footer";
import { ScrollHighlightText } from "@/components/landing/ScrollHighlightText";
import { FlowChart } from "@/components/landing/FlowChart";
import { Customers } from "@/components/landing/Customers";
import { useTranslation } from 'react-i18next';

const Landing = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/10">
      <Navbar />
      <main>
        <Hero />
        <ScrollHighlightText
          text={t('landing.mission')}
          className="bg-background"
        />
        <FlowChart />
        <Features />
        <Customers />
      </main>
      <Footer />
    </div>
  );
};

export default Landing;
