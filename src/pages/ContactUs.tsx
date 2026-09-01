import { Mail, Phone, MapPin, Send, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { MarketingPageLayout } from '@/components/marketing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const ContactUs = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      toast.success(t('contact.success'));
      setFormData({ firstName: '', lastName: '', email: '', message: '' });
      setLoading(false);
    }, 1500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <MarketingPageLayout mainClassName="pt-20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-100/50 rounded-full blur-[120px] opacity-50" />
      </div>

      <div className="container mx-auto px-4 pt-20 pb-16 max-w-6xl relative z-10">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            {t('contact.heroTitle')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('contact.heroSubtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12 animate-fade-in delay-100">
          <Card className="bg-white/50 backdrop-blur-sm border-black/5 hover:shadow-lg transition-all hover:-translate-y-1">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 mb-4 text-purple-600">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{t('contact.email')}</h3>
              <p className="text-sm text-muted-foreground">contact@perleap.com</p>
              <p className="text-sm text-muted-foreground">support@perleap.com</p>
            </CardContent>
          </Card>

          <Card className="bg-white/50 backdrop-blur-sm border-black/5 hover:shadow-lg transition-all hover:-translate-y-1">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 mb-4 text-orange-600">
                <Phone className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{t('contact.phone')}</h3>
              <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
              <p className="text-sm text-muted-foreground">Mon-Fri 9am-5pm EST</p>
            </CardContent>
          </Card>

          <Card className="bg-white/50 backdrop-blur-sm border-black/5 hover:shadow-lg transition-all hover:-translate-y-1">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-4 text-blue-600">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{t('contact.office')}</h3>
              <p className="text-sm text-muted-foreground">123 Education St.</p>
              <p className="text-sm text-muted-foreground">New York, NY 10001</p>
            </CardContent>
          </Card>
        </div>

        <div className="max-w-2xl mx-auto animate-fade-in delay-200">
          <Card className="bg-white/60 backdrop-blur-md border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">{t('contact.formTitle')}</CardTitle>
              <CardDescription>{t('contact.formDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t('contact.firstName')} *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      type="text"
                      placeholder={t('contact.firstNamePlaceholder')}
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      autoDirection
                      className="rounded-xl bg-white/50 border-black/10 focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t('contact.lastName')} *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      type="text"
                      placeholder={t('contact.lastNamePlaceholder')}
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      autoDirection
                      className="rounded-xl bg-white/50 border-black/10 focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('contact.emailField')} *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t('contact.emailPlaceholder')}
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="rounded-xl bg-white/50 border-black/10 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">{t('contact.message')} *</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder={t('contact.messagePlaceholder')}
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="rounded-xl resize-none bg-white/50 border-black/10 focus:bg-white transition-colors"
                    autoDirection
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-black text-white hover:bg-black/90 rounded-full h-12 text-base shadow-lg"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('contact.sending')}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {t('contact.sendMessage')}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t('contact.alsoReachPrefix')}{' '}
              <Link to="/contact" className="text-primary hover:underline font-medium">
                {t('contact.helpCenter')}
              </Link>{' '}
              or{' '}
              <Link to="/about" className="text-primary hover:underline font-medium">
                {t('contact.aboutPage')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </MarketingPageLayout>
  );
};

export default ContactUs;
