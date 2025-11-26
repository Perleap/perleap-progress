import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Target, Users, Lightbulb, Award, Heart, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/layouts/Navbar';
import { Footer } from '@/components/layouts/Footer';
import { useTranslation } from 'react-i18next';

const AboutUs = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/10">
      <Navbar />

      <main className="pt-20 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-green-100/50 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-100/50 rounded-full blur-[128px] animate-pulse delay-1000" />
        </div>

        <div className="container mx-auto px-4 pt-20 pb-16 max-w-6xl relative z-10">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight">
              About <span className="text-gradient-primary">Perleap</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              {t('aboutUs.heroSubtitle')}
            </p>
          </div>

          {/* Mission & Vision */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <Card className="bg-white/50 backdrop-blur-sm border-black/5 hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="pt-8 pb-8">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 mb-4">
                  <Target className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-4">{t('aboutUs.mission')}</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {t('aboutUs.missionText')}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/50 backdrop-blur-sm border-black/5 hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="pt-8 pb-8">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 mb-4">
                  <Lightbulb className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-4">{t('aboutUs.vision')}</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {t('aboutUs.visionText')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Story Section */}
          <div className="mb-16">
            <Card className="bg-white/80 backdrop-blur-md border-black/5 shadow-sm">
              <CardContent className="pt-12 pb-12 px-8 md:px-16">
                <h2 className="text-3xl font-bold text-foreground mb-8 text-center">{t('aboutUs.storyTitle')}</h2>
                <div className="space-y-6 text-muted-foreground leading-relaxed max-w-4xl mx-auto text-lg">
                  <p>{t('aboutUs.story.paragraph1')}</p>
                  <p>{t('aboutUs.story.paragraph2')}</p>
                  <p>{t('aboutUs.story.paragraph3')}</p>
                  <p>{t('aboutUs.story.paragraph4')}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Values */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">{t('aboutUs.valuesTitle')}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-white/50 backdrop-blur-sm border-black/5 hover:shadow-lg transition-all hover:-translate-y-1">
                <CardContent className="pt-6 pb-6 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 mb-4">
                    <Users className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{t('aboutUs.values.studentCentric.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('aboutUs.values.studentCentric.description')}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/50 backdrop-blur-sm border-black/5 hover:shadow-lg transition-all hover:-translate-y-1">
                <CardContent className="pt-6 pb-6 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
                    <Heart className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{t('aboutUs.values.empathy.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('aboutUs.values.empathy.description')}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/50 backdrop-blur-sm border-black/5 hover:shadow-lg transition-all hover:-translate-y-1">
                <CardContent className="pt-6 pb-6 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600 mb-4">
                    <Rocket className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{t('aboutUs.values.innovation.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('aboutUs.values.innovation.description')}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/50 backdrop-blur-sm border-black/5 hover:shadow-lg transition-all hover:-translate-y-1">
                <CardContent className="pt-6 pb-6 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 mb-4">
                    <Award className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{t('aboutUs.values.excellence.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('aboutUs.values.excellence.description')}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Stats Section */}
          <div className="mb-16">
            <Card className="bg-gradient-to-r from-purple-500 to-pink-500 border-none text-white shadow-xl">
              <CardContent className="pt-12 pb-12">
                <div className="grid sm:grid-cols-3 gap-8 text-center">
                  <div>
                    <div className="text-4xl md:text-5xl font-bold mb-2">10K+</div>
                    <p className="text-white/80 font-medium">{t('aboutUs.stats.studentsEmpowered')}</p>
                  </div>
                  <div>
                    <div className="text-4xl md:text-5xl font-bold mb-2">500+</div>
                    <p className="text-white/80 font-medium">{t('aboutUs.stats.educators')}</p>
                  </div>
                  <div>
                    <div className="text-4xl md:text-5xl font-bold mb-2">95%</div>
                    <p className="text-white/80 font-medium">{t('aboutUs.stats.satisfactionRate')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CTA Section */}
          <div className="text-center">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-foreground mb-4">{t('aboutUs.cta.title')}</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                {t('aboutUs.cta.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/auth">
                  <Button size="lg" className="bg-black text-white hover:bg-black/90 rounded-full px-8 h-12 text-base shadow-lg">
                    {t('aboutUs.cta.getStarted')}
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button size="lg" variant="outline" className="border-black/10 text-foreground hover:bg-black/5 rounded-full px-8 h-12 text-base">
                    {t('aboutUs.cta.contactTeam')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AboutUs;
