import { Navbar } from "@/components/layouts/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/layouts/Footer";
import { ScrollHighlightText } from "@/components/landing/ScrollHighlightText";
import { FlowChart } from "@/components/landing/FlowChart";
import { Customers } from "@/components/landing/Customers";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/10">
      <Navbar />
      <main>
        <Hero />
        <ScrollHighlightText
          text="We believe that education should be personalized, efficient, and accessible to everyone. Our AI agents work tirelessly to support teachers and students alike."
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
