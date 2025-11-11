import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Target, Users, Lightbulb, Award, Heart, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';

const AboutUs = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container flex h-16 md:h-20 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/perleap_logo.png" alt="PerLeap" className="h-10 w-10" />
            <span className="text-lg md:text-xl font-semibold">PerLeap</span>
          </Link>
          <div className="flex items-center gap-4 shrink-0">
            <Link to="/">
              <Button size="sm" variant="ghost" className="font-medium">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Home
              </Button>
            </Link>
            <ThemeToggle />
            <Link to="/auth">
              <Button size="sm" className="font-medium">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 pt-32 pb-16 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            About PerLeap
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            We're on a mission to transform education through AI-powered insights, empowering
            teachers and inspiring students to reach their full potential.
          </p>
        </div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card className="bg-card border-border hover:shadow-lg transition-shadow">
            <CardContent className="pt-8 pb-8">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-dimension-cognitive/20 mb-4">
                <Target className="h-7 w-7 text-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed">
                To revolutionize the educational experience by providing teachers with intelligent
                tools that streamline their workflow, while giving every student personalized
                guidance that nurtures growth across all dimensions of learning.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:shadow-lg transition-shadow">
            <CardContent className="pt-8 pb-8">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-dimension-creative/20 mb-4">
                <Lightbulb className="h-7 w-7 text-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Our Vision</h2>
              <p className="text-muted-foreground leading-relaxed">
                A world where every educator is empowered with AI-driven insights and every student
                receives a personalized learning journey that adapts to their unique strengths,
                challenges, and learning style.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Story Section */}
        <div className="mb-16">
          <Card className="bg-card border-border">
            <CardContent className="pt-8 pb-8">
              <h2 className="text-3xl font-bold text-foreground mb-6 text-center">Our Story</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed max-w-4xl mx-auto">
                <p>
                  PerLeap was born from a simple observation: teachers are incredibly passionate
                  about their students' success, but they're often overwhelmed by administrative
                  tasks and lack the tools to truly personalize learning at scale.
                </p>
                <p>
                  Founded by educators and technologists who experienced these challenges firsthand,
                  we set out to create a platform that would give teachers their time back while
                  enhancing the quality of feedback and insights they could provide to each student.
                </p>
                <p>
                  Our innovative 5D Soft Skills Tracking system—monitoring Vision, Values, Thinking,
                  Connection, and Action—ensures that we're not just measuring academic performance,
                  but nurturing the whole student. Combined with AI-powered analytics and
                  personalized learning paths, PerLeap is transforming classrooms into dynamic,
                  adaptive learning environments.
                </p>
                <p>
                  Today, we're proud to partner with thousands of educators and empower tens of
                  thousands of students around the world. But we're just getting started.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Values */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-8 text-center">Our Values</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-card border-border hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-dimension-cognitive/20 mb-4">
                  <Users className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Student-Centric</h3>
                <p className="text-sm text-muted-foreground">
                  Every decision we make prioritizes student growth and well-being
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-dimension-social/20 mb-4">
                  <Heart className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Empathy</h3>
                <p className="text-sm text-muted-foreground">
                  We understand the challenges educators face and build with compassion
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-dimension-creative/20 mb-4">
                  <Rocket className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Innovation</h3>
                <p className="text-sm text-muted-foreground">
                  We constantly push boundaries to deliver cutting-edge solutions
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-dimension-emotional/20 mb-4">
                  <Award className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Excellence</h3>
                <p className="text-sm text-muted-foreground">
                  We strive for the highest quality in everything we create
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mb-16">
          <Card className="bg-gradient-to-br from-dimension-cognitive/10 to-dimension-creative/10 border-border">
            <CardContent className="pt-8 pb-8">
              <div className="grid sm:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-4xl md:text-5xl font-bold mb-2 text-foreground">10K+</div>
                  <p className="text-muted-foreground">Students Empowered</p>
                </div>
                <div>
                  <div className="text-4xl md:text-5xl font-bold mb-2 text-foreground">500+</div>
                  <p className="text-muted-foreground">Educators</p>
                </div>
                <div>
                  <div className="text-4xl md:text-5xl font-bold mb-2 text-foreground">95%</div>
                  <p className="text-muted-foreground">Satisfaction Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="bg-card border-border shadow-lg">
            <CardContent className="pt-10 pb-10">
              <h2 className="text-3xl font-bold text-foreground mb-4">Join Us on This Journey</h2>
              <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                Whether you're an educator looking to transform your classroom or a student ready to
                unlock your potential, we're here to support you every step of the way.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/auth">
                  <Button size="lg" className="font-medium">
                    Get Started Today
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button size="lg" variant="outline" className="font-medium">
                    Contact Our Team
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
