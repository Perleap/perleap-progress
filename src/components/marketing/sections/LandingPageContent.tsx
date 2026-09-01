import { useTranslation } from 'react-i18next';
import { Customers } from './Customers';
import { Features } from './Features';
import { FlowChart } from './FlowChart';
import { Hero } from './Hero';
import { ScrollHighlightText } from './ScrollHighlightText';

export const LandingPageContent = () => {
  const { t } = useTranslation();

  return (
    <>
      <Hero />
      <ScrollHighlightText text={t('landing.mission')} className="bg-background" />
      <FlowChart />
      <Features />
      <Customers />
    </>
  );
};

export { Hero } from './Hero';
export { Features } from './Features';
export { FlowChart } from './FlowChart';
export { Customers } from './Customers';
export { ScrollHighlightText } from './ScrollHighlightText';
