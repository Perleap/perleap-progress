import { Button } from "@/components/ui/button";
import { GraduationCap, Brain, Users, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-accent" />
            <span className="text-xl font-bold tracking-tight">PerLeap</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
            <a href="#benefits" className="text-sm font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Benefits</a>
          </nav>
          <Link to="/auth">
            <Button className="uppercase tracking-wider">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-24 md:py-32 lg:py-40">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Expert insights. Custom solutions.
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Easily adapt to changes and scale your operations with our flexible infrastructure, designed to support your business through AI-powered teaching and learning.
          </p>
          <Link to="/auth">
            <Button size="lg" className="uppercase tracking-wider text-base px-8 py-6">
              Book a Call
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container py-20 bg-secondary">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-center mb-16">Comprehensive Learning Solutions</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-lg border hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Brain className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3">5D Growth Tracking</h3>
              <p className="text-muted-foreground mb-4">
                Monitor student development across Cognitive, Emotional, Social, Creative, and Behavioral dimensions with AI-powered insights.
              </p>
              <a href="#" className="text-accent font-medium hover:underline">Learn more →</a>
            </div>

            <div className="bg-card p-8 rounded-lg border hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3">AI Teaching Partner</h3>
              <p className="text-muted-foreground mb-4">
                Generate lesson plans, enhance assignments, and receive intelligent feedback tailored to your teaching style and student needs.
              </p>
              <a href="#" className="text-accent font-medium hover:underline">Learn more →</a>
            </div>

            <div className="bg-card p-8 rounded-lg border hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3">Personalized Learning</h3>
              <p className="text-muted-foreground mb-4">
                Every student receives customized guidance, motivational support, and a personal learning plan based on their unique profile.
              </p>
              <a href="#" className="text-accent font-medium hover:underline">Learn more →</a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="text-5xl font-bold text-accent mb-2">95%</div>
              <p className="text-muted-foreground">Teacher Satisfaction</p>
            </div>
            <div>
              <div className="text-5xl font-bold text-accent mb-2">10K+</div>
              <p className="text-muted-foreground">Students Empowered</p>
            </div>
            <div>
              <div className="text-5xl font-bold text-accent mb-2">5D</div>
              <p className="text-muted-foreground">Growth Dimensions</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-20 bg-secondary">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to elevate your teaching?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of educators transforming learning with AI-powered insights and personalized support.
          </p>
          <Link to="/auth">
            <Button size="lg" className="uppercase tracking-wider text-base px-8 py-6">
              Get Started Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-primary text-primary-foreground py-12">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="h-5 w-5" />
                <span className="font-bold">PerLeap</span>
              </div>
              <p className="text-sm text-primary-foreground/80">
                AI Teaching & Learning Copilot
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/80">
                <li><a href="#" className="hover:text-primary-foreground">Features</a></li>
                <li><a href="#" className="hover:text-primary-foreground">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/80">
                <li><a href="#" className="hover:text-primary-foreground">About</a></li>
                <li><a href="#" className="hover:text-primary-foreground">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/80">
                <li><a href="#" className="hover:text-primary-foreground">Privacy</a></li>
                <li><a href="#" className="hover:text-primary-foreground">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-primary-foreground/10 text-center text-sm text-primary-foreground/60">
            © 2025 PerLeap. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;