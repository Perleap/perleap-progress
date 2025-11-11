import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Brain, Users2, Target, TrendingUp, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

const Landing = () => {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container flex h-16 md:h-20 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/perleap_logo.png" alt="PerLeap" className="h-8 w-8 rounded" />
            <span className="text-lg md:text-xl font-semibold">PerLeap</span>
          </Link>
          <div className="flex items-center gap-2 md:gap-4">
            <Link to="/about">
              <Button size="sm" variant="ghost" className="font-medium hidden md:inline-flex">
                {t('landing.nav.about')}
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="sm" variant="ghost" className="font-medium hidden sm:inline-flex">
                {t('landing.nav.pricing')}
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="sm" variant="ghost" className="font-medium hidden sm:inline-flex">
                {t('landing.nav.contact')}
              </Button>
            </Link>
            <ThemeToggle />
            <LanguageSwitcher />
            <Link to="/login">
              <Button size="sm" variant="ghost" className="font-medium">
                {t('landing.nav.login')}
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="font-medium">
                {t('landing.nav.register')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container pt-24 pb-12 md:pt-32 md:pb-20 lg:pt-40 lg:pb-32 px-4">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="max-w-3xl">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 leading-tight -ml-1">
              <div>{t('landing.hero.title1')}</div>
              <div>{t('landing.hero.title2')}</div>
            </h1>
            <p className="text-base md:text-lg lg:text-xl text-muted-foreground mb-6 md:mb-8 leading-relaxed">
              {t('landing.hero.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <Link to="/register" className="w-full sm:w-auto">
                <Button size="lg" className="font-medium w-full sm:w-auto">
                  {t('landing.hero.getStarted')}
                  <ArrowRight className="h-4 w-4 ms-2" />
                </Button>
              </Link>
              <Link to="/contact" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="font-medium w-full sm:w-auto">
                  {t('landing.hero.contactUs')}
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
        <div className="mt-12 md:mt-20 pt-8 md:pt-12 border-t border-border/50">
          <div className="flex items-center gap-6 md:gap-8 overflow-x-auto pb-2">
            {["NovaTech", "VitaHealth", "NaviAI", "Lumora", "TeachPro", "EduFlow"].map((logo, i) => (
              <div key={i} className="text-muted-foreground/40 font-semibold text-sm md:text-lg whitespace-nowrap">
                {logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container py-12 md:py-20 lg:py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 md:mb-4">{t('landing.features.title')}</h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              {t('landing.features.subtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
            <div className="bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-dimension-cognitive/40 flex items-center justify-center mb-6">
                <Brain className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t('landing.features.growth.title')}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {t('landing.features.growth.description')}
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-dimension-social/40 flex items-center justify-center mb-6">
                <Sparkles className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t('landing.features.aiPartner.title')}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {t('landing.features.aiPartner.description')}
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-dimension-creative/40 flex items-center justify-center mb-6">
                <Users2 className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t('landing.features.personalized.title')}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {t('landing.features.personalized.description')}
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-dimension-emotional/40 flex items-center justify-center mb-6">
                <Target className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t('landing.features.assessments.title')}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {t('landing.features.assessments.description')}
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-dimension-behavioral/40 flex items-center justify-center mb-6">
                <TrendingUp className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t('landing.features.analytics.title')}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {t('landing.features.analytics.description')}
              </p>
            </div>

            <div className="bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-dimension-cognitive/40 flex items-center justify-center mb-6">
                <Shield className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t('landing.features.security.title')}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {t('landing.features.security.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container py-12 md:py-20 lg:py-32 bg-secondary rounded-2xl md:rounded-3xl my-12 md:my-20 mx-4">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid sm:grid-cols-3 gap-8 md:gap-12 text-center">
            <div>
              <div className="text-4xl md:text-5xl lg:text-6xl font-bold mb-2 md:mb-3">95%</div>
              <p className="text-muted-foreground text-sm md:text-base lg:text-lg">{t('landing.stats.satisfaction')}</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl lg:text-6xl font-bold mb-2 md:mb-3">10K+</div>
              <p className="text-muted-foreground text-sm md:text-base lg:text-lg">{t('landing.stats.students')}</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl lg:text-6xl font-bold mb-2 md:mb-3">5D</div>
              <p className="text-muted-foreground text-sm md:text-base lg:text-lg">{t('landing.stats.dimensions')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-12 md:py-20 lg:py-32 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6">{t('landing.cta.title')}</h2>
          <p className="text-base md:text-lg lg:text-xl text-muted-foreground mb-6 md:mb-8 leading-relaxed px-4">
            {t('landing.cta.subtitle')}
          </p>
          <Link to="/register">
            <Button size="lg" className="font-medium">
              {t('landing.cta.button')}
              <ArrowRight className="h-4 w-4 ms-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 md:py-12 mt-12 md:mt-20">
        <div className="container px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/perleap_logo.png" alt="PerLeap" className="h-5 w-5 rounded-sm" />
                <span className="font-semibold">PerLeap</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('landing.footer.tagline')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('landing.footer.product')}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">{t('landing.footer.features')}</a></li>
                <li><Link to="/pricing" className="hover:text-foreground transition-colors">{t('landing.nav.pricing')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('landing.footer.company')}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-foreground transition-colors">{t('landing.nav.about')}</Link></li>
                <li><Link to="/contact" className="hover:text-foreground transition-colors">{t('landing.nav.contact')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('landing.footer.legal')}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">{t('landing.footer.privacy')}</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">{t('landing.footer.terms')}</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            {t('landing.footer.copyright')}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;