import { useLocation, Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BreathingBackground } from '@/components/ui/BreathingBackground';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  return (
    <BreathingBackground className="flex items-center justify-center">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="text-center animate-fade-in p-8 rounded-xl bg-white/30 backdrop-blur-md border border-white/20 shadow-xl max-w-md mx-4">
        <h1 className="mb-2 text-8xl font-bold text-primary">404</h1>
        <h2 className="mb-6 text-2xl font-semibold text-foreground">Page Not Found</h2>
        <p className="mb-8 text-muted-foreground">
          Oops! The page you are looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <Button className="bg-black text-white hover:bg-black/90 rounded-full px-8 gap-2">
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            Return to Home
          </Button>
        </Link>
      </div>
    </BreathingBackground>
  );
};

export default NotFound;
