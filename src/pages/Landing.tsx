import { Button } from "@/components/ui/button";
import { GraduationCap, ArrowRight, Sparkles, Brain, Users2, Target, TrendingUp, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container flex h-20 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">PerLeap</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
            <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About</a>
          </nav>
          <Link to="/auth">
            <Button className="font-medium">
              Contact us
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="max-w-2xl">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
              Strategy and growth for modern teams
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              PerLeap partners with educators to streamline teaching, elevate student performance, and build a foundation for lasting success through AI-powered insights.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/auth">
                <Button size="lg" className="font-medium">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="font-medium">
                  Contact us
                </Button>
              </Link>
            </div>
          </div>

          {/* Floating UI Cards */}
          <div className="relative hidden lg:block">
            <div className="absolute -top-10 -right-10 w-80 h-96 bg-gradient-to-br from-dimension-cognitive/20 to-dimension-creative/20 rounded-3xl blur-3xl" />
            
            {/* Student Card */}
            <div className="relative bg-card rounded-3xl p-6 shadow-lg border border-border mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">Students</h3>
                <span className="text-xs text-muted-foreground">Sort by Newest →</span>
              </div>
              <div className="space-y-3">
                <div className="bg-dimension-cognitive/40 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-dimension-social/60 flex items-center justify-center text-xs font-bold">MJ</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Maggie Johnson</div>
                    <div className="text-xs text-muted-foreground">Oasis Organic Inc.</div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-background flex items-center justify-center">✏️</div>
                    <div className="w-6 h-6 rounded-full bg-background flex items-center justify-center">⭐</div>
                  </div>
                </div>
                <div className="bg-background rounded-2xl p-4 flex items-center gap-3 border border-border/50">
                  <div className="w-10 h-10 rounded-full bg-dimension-emotional/60 flex items-center justify-center text-xs font-bold">CF</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Chris Friedly</div>
                    <div className="text-xs text-muted-foreground">Supermarket Villanova</div>
                  </div>
                </div>
                <div className="bg-background rounded-2xl p-4 flex items-center gap-3 border border-border/50">
                  <div className="w-10 h-10 rounded-full bg-dimension-creative/60 flex items-center justify-center text-xs font-bold">GH</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Gael Harry</div>
                    <div className="text-xs text-muted-foreground">New York Finest Fruits</div>
                  </div>
                </div>
              </div>
              <button className="mt-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">All customers →</button>
            </div>

            {/* Analytics Card */}
            <div className="relative bg-card rounded-3xl p-6 shadow-lg border border-border">
              <div className="mb-4">
                <div className="text-xs text-muted-foreground mb-1">Daily Average</div>
                <div className="text-2xl font-bold">2h 20m</div>
                <div className="text-xs text-dimension-creative">+30m this week</div>
              </div>
              <div className="flex items-end gap-1 h-24">
                <div className="flex-1 bg-gradient-to-t from-dimension-social to-dimension-cognitive rounded-lg h-[60%]"></div>
                <div className="flex-1 bg-gradient-to-t from-dimension-creative to-dimension-emotional rounded-lg h-[75%]"></div>
                <div className="flex-1 bg-gradient-to-t from-dimension-behavioral to-dimension-cognitive rounded-lg h-[85%]"></div>
                <div className="flex-1 bg-gradient-to-t from-dimension-cognitive to-dimension-social rounded-lg h-[70%]"></div>
                <div className="flex-1 bg-gradient-to-t from-dimension-emotional to-dimension-creative rounded-lg h-[90%]"></div>
                <div className="flex-1 bg-gradient-to-t from-dimension-social to-dimension-behavioral rounded-lg h-[65%]"></div>
                <div className="flex-1 bg-gradient-to-t from-dimension-creative to-dimension-cognitive rounded-lg h-[80%]"></div>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
                <span>S</span>
              </div>
            </div>
          </div>
        </div>

        {/* Logo Strip */}
        <div className="mt-20 pt-12 border-t border-border/50">
          <div className="flex items-center gap-8 overflow-hidden">
            {["NovaTech", "VitaHealth", "NaviAI", "Lumora", "TeachPro", "EduFlow"].map((logo, i) => (
              <div key={i} className="text-muted-foreground/40 font-semibold text-lg whitespace-nowrap">
                {logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container py-20 md:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Everything you need to succeed</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive tools designed to transform teaching and learning experiences
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-dimension-cognitive/40 flex items-center justify-center mb-6">
                <Brain className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">5D Growth Tracking</h3>
              <p className="text-muted-foreground leading-relaxed">
                Monitor development across Cognitive, Emotional, Social, Creative, and Behavioral dimensions with precision.
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-dimension-social/40 flex items-center justify-center mb-6">
                <Sparkles className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">AI Teaching Partner</h3>
              <p className="text-muted-foreground leading-relaxed">
                Generate lesson plans and receive intelligent feedback tailored to your teaching style.
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-dimension-creative/40 flex items-center justify-center mb-6">
                <Users2 className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Personalized Learning</h3>
              <p className="text-muted-foreground leading-relaxed">
                Every student receives customized guidance and a personal learning plan.
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-dimension-emotional/40 flex items-center justify-center mb-6">
                <Target className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Smart Assessments</h3>
              <p className="text-muted-foreground leading-relaxed">
                Automated evaluation with narrative feedback and progress tracking.
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-dimension-behavioral/40 flex items-center justify-center mb-6">
                <TrendingUp className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Analytics Dashboard</h3>
              <p className="text-muted-foreground leading-relaxed">
                Visualize class progress with comprehensive charts and insights.
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-dimension-cognitive/40 flex items-center justify-center mb-6">
                <Shield className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Secure & Private</h3>
              <p className="text-muted-foreground leading-relaxed">
                Enterprise-grade security with role-based access and data protection.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container py-20 md:py-32 bg-secondary rounded-3xl my-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="text-5xl md:text-6xl font-bold mb-3">95%</div>
              <p className="text-muted-foreground text-lg">Teacher Satisfaction</p>
            </div>
            <div>
              <div className="text-5xl md:text-6xl font-bold mb-3">10K+</div>
              <p className="text-muted-foreground text-lg">Students Empowered</p>
            </div>
            <div>
              <div className="text-5xl md:text-6xl font-bold mb-3">5D</div>
              <p className="text-muted-foreground text-lg">Growth Dimensions</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to transform education?</h2>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Join thousands of educators building the future of learning with AI-powered insights.
          </p>
          <Link to="/auth">
            <Button size="lg" className="font-medium">
              Get started today
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 mt-20">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                  <GraduationCap className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold">PerLeap</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI Teaching & Learning Copilot
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © 2025 PerLeap. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;