import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail, Phone, MapPin, Send, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BreathingBackground } from '@/components/ui/BreathingBackground';
import { Navbar } from '@/components/layouts/Navbar';
import { Footer } from '@/components/layouts/Footer';

const ContactUs = () => {
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

    // Simulate API call
    setTimeout(() => {
      toast.success("Message sent successfully! We'll get back to you soon.");
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
    <BreathingBackground>
      <Navbar />

      <div className="container mx-auto px-4 pt-32 pb-16 max-w-6xl">
        {/* Page Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Get in Touch</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Have a question or feedback? We'd love to hear from you. Send us a message and we'll
            respond as soon as possible.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12 animate-fade-in delay-100">
          {/* Contact Info Cards */}
          <Card className="bg-white/50 backdrop-blur-sm border-black/5 hover:shadow-lg transition-all hover:-translate-y-1">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 mb-4 text-purple-600">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Email</h3>
              <p className="text-sm text-muted-foreground">contact@perleap.com</p>
              <p className="text-sm text-muted-foreground">support@perleap.com</p>
            </CardContent>
          </Card>

          <Card className="bg-white/50 backdrop-blur-sm border-black/5 hover:shadow-lg transition-all hover:-translate-y-1">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 mb-4 text-orange-600">
                <Phone className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Phone</h3>
              <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
              <p className="text-sm text-muted-foreground">Mon-Fri 9am-5pm EST</p>
            </CardContent>
          </Card>

          <Card className="bg-white/50 backdrop-blur-sm border-black/5 hover:shadow-lg transition-all hover:-translate-y-1">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-4 text-blue-600">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Office</h3>
              <p className="text-sm text-muted-foreground">123 Education St.</p>
              <p className="text-sm text-muted-foreground">New York, NY 10001</p>
            </CardContent>
          </Card>
        </div>

        {/* Contact Form */}
        <div className="max-w-2xl mx-auto animate-fade-in delay-200">
          <Card className="bg-white/60 backdrop-blur-md border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">Send us a Message</CardTitle>
              <CardDescription>
                Fill out the form below and our team will get back to you within 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      type="text"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      className="rounded-xl bg-white/50 border-black/10 focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      type="text"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      className="rounded-xl bg-white/50 border-black/10 focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john.doe@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="rounded-xl bg-white/50 border-black/10 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Tell us how we can help you..."
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="rounded-xl resize-none bg-white/50 border-black/10 focus:bg-white transition-colors"
                  />
                </div>

                <Button type="submit" className="w-full bg-black text-white hover:bg-black/90 rounded-full h-12 text-base shadow-lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              You can also reach us through our{' '}
              <a href="#" className="text-primary hover:underline font-medium">
                Help Center
              </a>{' '}
              or{' '}
              <a href="#" className="text-primary hover:underline font-medium">
                Community Forum
              </a>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </BreathingBackground>
  );
};

export default ContactUs;
