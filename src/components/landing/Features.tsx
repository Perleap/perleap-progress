import { useEffect, useRef, useState } from "react";
import { Brain, Users, Zap, Shield, BarChart3, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
    {
        icon: Brain,
        title: "Cognitive Analysis",
        description: "Deep understanding of student performance across cognitive dimensions. We analyze learning patterns to provide personalized study paths.",
    },
    {
        icon: Users,
        title: "Social Dynamics",
        description: "Analyze and improve classroom interactions and social emotional learning. Foster a collaborative environment with AI-driven insights.",
    },
    {
        icon: Zap,
        title: "Real-time Feedback",
        description: "Instant, automated grading and feedback for students and teachers. Reduce grading time by 90% and focus on teaching.",
    },
    {
        icon: Shield,
        title: "Secure & Private",
        description: "Enterprise-grade security ensuring student data protection. Compliant with GDPR, FERPA, and COPPA standards.",
    },
    {
        icon: BarChart3,
        title: "Advanced Analytics",
        description: "Comprehensive dashboards for tracking progress and identifying gaps. Make data-driven decisions at the district, school, and class level.",
    },
    {
        icon: Globe,
        title: "Global Accessibility",
        description: "Multi-language support breaking down barriers in education. Translate content and feedback instantly for diverse classrooms.",
    },
];

export const Features = () => {
    return (
        <section className="py-24 bg-white text-black" id="features">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col lg:flex-row gap-16">

                    {/* Left Column: Sticky Title */}
                    <div className="lg:w-1/3">
                        <div className="sticky top-32">
                            <h2 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
                                Powerful Features for <span className="text-gray-400">Modern Education</span>
                            </h2>
                            <p className="text-lg text-gray-500 mb-8">
                                Everything you need to manage your classroom, assess students, and personalize learning at scale.
                            </p>
                        </div>
                    </div>

                    {/* Right Column: Scrolling List */}
                    <div className="lg:w-2/3 flex flex-col gap-24 pb-24">
                        {features.map((feature, index) => (
                            <FeatureItem key={index} feature={feature} index={index} />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

const FeatureItem = ({ feature, index }: { feature: any, index: number }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.2 }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => {
            if (ref.current) {
                observer.unobserve(ref.current);
            }
        };
    }, []);

    const Icon = feature.icon;

    return (
        <div
            ref={ref}
            className={cn(
                "flex flex-col md:flex-row gap-8 items-start transition-all duration-700 transform",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            )}
        >
            <div className="w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center flex-shrink-0 shadow-xl">
                <Icon className="w-8 h-8" />
            </div>
            <div>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="text-xl text-gray-500 leading-relaxed">{feature.description}</p>
            </div>
        </div>
    );
};
