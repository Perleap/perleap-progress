import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export const Hero = () => {
    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 bg-background">
            {/* Background Gradients - Light Theme */}
            <div className="absolute inset-0 bg-background">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200/50 rounded-full blur-[128px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-200/50 rounded-full blur-[128px] animate-pulse delay-1000" />
            </div>

            {/* Floating Orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-10 w-24 h-24 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full blur-xl animate-float opacity-60" />
                <div className="absolute bottom-1/4 right-10 w-32 h-32 bg-gradient-to-br from-blue-200 to-cyan-200 rounded-full blur-xl animate-float delay-2000 opacity-60" />
                <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-gradient-to-br from-yellow-200 to-orange-200 rounded-full blur-xl animate-float delay-1000 opacity-40" />
            </div>

            <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 border border-black/5 backdrop-blur-sm mb-8 animate-fade-in shadow-sm">
                    <Sparkles className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium text-foreground/80">
                        Introducing Perleap AI 2.0
                    </span>
                </div>

                <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 animate-fade-in delay-100 text-foreground">
                    <span className="block">Agentic AI for</span>
                    <span className="text-gradient-primary">Education</span>
                </h1>

                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-fade-in delay-200 leading-relaxed">
                    Empower your institution with intelligent agents that automate grading, personalize learning, and transform the educational experience.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in delay-300">
                    <Link to="/register">
                        <Button size="lg" className="bg-black text-white hover:bg-black/90 rounded-full px-8 h-12 text-base shadow-lg hover:shadow-xl transition-all">
                            Get Started
                        </Button>
                    </Link>
                    <Link to="/about">
                        <Button size="lg" variant="outline" className="border-black/10 text-foreground hover:bg-black/5 rounded-full px-8 h-12 text-base group bg-white/50 backdrop-blur-sm">
                            Learn More
                            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
};
