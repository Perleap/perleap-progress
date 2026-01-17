import { Navbar } from "@/components/layouts/Navbar";
import { Footer } from "@/components/layouts/Footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, GraduationCap, School, Users } from "lucide-react";
import { Link } from "react-router-dom";

const Solutions = () => {
    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/10">
            <Navbar />

            <main className="pt-20">
                {/* Hero Section */}
                <section className="relative py-20 overflow-hidden">
                    {/* Background Gradients */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-200/50 rounded-full blur-[128px] animate-pulse" />
                        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-pink-200/50 rounded-full blur-[128px] animate-pulse delay-1000" />
                    </div>

                    <div className="container mx-auto px-4 relative z-10 text-center">
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 animate-fade-in">
                            Solutions for <br />
                            <span className="text-gradient-primary">Every Role</span>
                        </h1>

                        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-fade-in delay-100 leading-relaxed">
                            Whether you're teaching a class of 30 or managing a district of 30,000, Perleap scales to meet your needs.
                        </p>
                    </div>
                </section>

                {/* Solutions List */}
                <section className="py-10">
                    <div className="container mx-auto px-4 space-y-20">

                        {/* For Teachers */}
                        <SolutionSection
                            icon={School}
                            title="For Teachers"
                            headline="Reclaim your time and focus on what matters."
                            description="Automate administrative tasks like grading and attendance. Get real-time insights into student performance so you can intervene when it counts."
                            features={["Automated Grading", "Lesson Planning AI", "Student Progress Tracking"]}
                            imageBg="bg-warning/10"
                            reversed={false}
                        />

                        {/* For Students */}
                        <SolutionSection
                            icon={GraduationCap}
                            title="For Students"
                            headline="Personalized learning that adapts to you."
                            description="Get instant feedback on assignments, personalized study guides, and a learning path that evolves as you grow."
                            features={["Instant Feedback", "Adaptive Practice", "Skill Mastery Visualization"]}
                            imageBg="bg-info/10"
                            reversed={true}
                        />

                        {/* For Institutions */}
                        <SolutionSection
                            icon={Users}
                            title="For Institutions"
                            headline="Data-driven decisions at scale."
                            description="Gain visibility into curriculum effectiveness, teacher performance, and student outcomes across the entire institution."
                            features={["District-wide Analytics", "Curriculum Alignment", "Resource Allocation Insights"]}
                            imageBg="bg-success/10"
                            reversed={false}
                        />

                    </div>
                </section>

                {/* CTA */}
                <section className="py-20">
                    <div className="container mx-auto px-4 text-center">
                        <div className="max-w-3xl mx-auto">
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">Find the right solution for you</h2>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Link to="/register">
                                    <Button size="lg" className="bg-black text-white hover:bg-black/90 rounded-full px-8 h-12 text-base shadow-lg">
                                        Get Started
                                    </Button>
                                </Link>
                                <Link to="/contact">
                                    <Button size="lg" variant="outline" className="border-black/10 text-foreground hover:bg-black/5 rounded-full px-8 h-12 text-base">
                                        Contact Sales
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
};

const SolutionSection = ({ icon: Icon, title, headline, description, features, imageBg, reversed }: any) => (
    <div className={`flex flex-col md:flex-row items-center gap-12 ${reversed ? 'md:flex-row-reverse' : ''}`}>
        <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-sm font-medium">
                <Icon className="w-4 h-4" />
                {title}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">{headline}</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
                {description}
            </p>
            <ul className="space-y-3">
                {features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-foreground/80">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {feature}
                    </li>
                ))}
            </ul>
            <Button variant="link" className="px-0 text-primary group">
                Learn more <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
        </div>
        <div className={`flex-1 aspect-square md:aspect-video rounded-xl ${imageBg} flex items-center justify-center shadow-inner`}>
            {/* Placeholder for illustration */}
            <div className="w-2/3 h-2/3 bg-white/50 backdrop-blur-sm rounded-lg border border-white/20 shadow-lg flex items-center justify-center">
                <span className="text-muted-foreground/50 font-medium">Illustration</span>
            </div>
        </div>
    </div>
);

export default Solutions;
