import { Navbar } from "@/components/layouts/Navbar";
import { Footer } from "@/components/layouts/Footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Zap, Shield, BarChart3, Brain, Cpu } from "lucide-react";
import { Link } from "react-router-dom";

const Product = () => {
    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/10">
            <Navbar />

            <main className="pt-20">
                {/* Hero Section */}
                <section className="relative py-20 overflow-hidden">
                    {/* Background Gradients */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200/50 rounded-full blur-[128px] animate-pulse" />
                        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-200/50 rounded-full blur-[128px] animate-pulse delay-1000" />
                    </div>

                    <div className="container mx-auto px-4 relative z-10 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 border border-black/5 backdrop-blur-sm mb-8 animate-fade-in shadow-sm">
                            <Sparkles className="w-4 h-4 text-orange-500" />
                            <span className="text-sm font-medium text-foreground/80">
                                Powered by Advanced AI
                            </span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 animate-fade-in delay-100">
                            Intelligent Agents for <br />
                            <span className="text-gradient-primary">Modern Education</span>
                        </h1>

                        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-fade-in delay-200 leading-relaxed">
                            Perleap's suite of AI agents automates the mundane, personalizes the learning journey, and provides deep insights into student growth.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in delay-300">
                            <Link to="/register">
                                <Button size="lg" className="bg-black text-white hover:bg-black/90 rounded-full px-8 h-12 text-base shadow-lg hover:shadow-xl transition-all">
                                    Start Free Trial
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="py-20 bg-white/50 backdrop-blur-sm">
                    <div className="container mx-auto px-4">
                        <div className="grid md:grid-cols-3 gap-8">
                            <FeatureCard
                                icon={Brain}
                                title="Cognitive Analysis"
                                description="Understand how students think, not just what they know. Our AI analyzes problem-solving patterns to identify strengths."
                                delay={0}
                            />
                            <FeatureCard
                                icon={Zap}
                                title="Instant Grading"
                                description="Save hours every week with automated grading that provides detailed, constructive feedback instantly."
                                delay={1}
                            />
                            <FeatureCard
                                icon={BarChart3}
                                title="Growth Analytics"
                                description="Track progress over time with intuitive dashboards that visualize learning trends and gaps."
                                delay={2}
                            />
                            <FeatureCard
                                icon={Shield}
                                title="Secure & Private"
                                description="Enterprise-grade security ensures student data is protected and compliant with educational standards."
                                delay={3}
                            />
                            <FeatureCard
                                icon={Cpu}
                                title="Adaptive Learning"
                                description="Content that adjusts in real-time to the student's pace and understanding level."
                                delay={4}
                            />
                            <FeatureCard
                                icon={Sparkles}
                                title="Soft Skills Tracking"
                                description="Measure the unmeasurable: creativity, collaboration, and critical thinking."
                                delay={5}
                            />
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-20">
                    <div className="container mx-auto px-4 text-center">
                        <div className="max-w-3xl mx-auto bg-gradient-to-br from-purple-100 to-orange-100 rounded-3xl p-12 border border-white/20 shadow-xl">
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to transform your classroom?</h2>
                            <p className="text-lg text-muted-foreground mb-8">
                                Join thousands of educators who are already using Perleap to enhance their teaching.
                            </p>
                            <Link to="/register">
                                <Button size="lg" className="bg-black text-white hover:bg-black/90 rounded-full px-8 h-12 text-base shadow-lg">
                                    Get Started Now
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
};

const FeatureCard = ({ icon: Icon, title, description, delay }: { icon: any, title: string, description: string, delay: number }) => (
    <div className="p-8 rounded-2xl bg-white border border-black/5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 animate-fade-in" style={{ animationDelay: `${delay * 0.1}s` }}>
        <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-6 text-purple-600">
            <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold mb-3">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">
            {description}
        </p>
    </div>
);

export default Product;
