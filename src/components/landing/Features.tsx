import { useEffect, useRef, useState } from "react";
import { Brain, Users, Zap, Shield, BarChart3, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from 'react-i18next';

export const Features = () => {
    const { t } = useTranslation();

    const features = [
        {
            icon: Brain,
            title: t('landing.features.cognitive.title'),
            description: t('landing.features.cognitive.description'),
        },
        {
            icon: Users,
            title: t('landing.features.social.title'),
            description: t('landing.features.social.description'),
        },
        {
            icon: Zap,
            title: t('landing.features.realtime.title'),
            description: t('landing.features.realtime.description'),
        },
        {
            icon: Shield,
            title: t('landing.features.secure.title'),
            description: t('landing.features.secure.description'),
        },
        {
            icon: BarChart3,
            title: t('landing.features.analytics.title'),
            description: t('landing.features.analytics.description'),
        },
        {
            icon: Globe,
            title: t('landing.features.global.title'),
            description: t('landing.features.global.description'),
        },
    ];

    return (
        <section className="py-24 bg-white text-black" id="features">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col lg:flex-row gap-16">

                    {/* Left Column: Sticky Title */}
                    <div className="lg:w-1/3">
                        <div className="sticky top-32">
                            <h2 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
                                {t('landing.features.heading1')} <span className="text-gray-400">{t('landing.features.heading2')}</span>
                            </h2>
                            <p className="text-lg text-gray-500 mb-8">
                                {t('landing.features.subtitle')}
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
            <div className="w-16 h-16 rounded-lg bg-black text-white flex items-center justify-center flex-shrink-0 shadow-xl">
                <Icon className="w-8 h-8" />
            </div>
            <div>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="text-xl text-gray-500 leading-relaxed">{feature.description}</p>
            </div>
        </div>
    );
};
