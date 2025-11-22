import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrollHighlightTextProps {
    text: string;
    className?: string;
}

export const ScrollHighlightText = ({ text, className }: ScrollHighlightTextProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollProgress, setScrollProgress] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current) return;

            const element = containerRef.current;
            const { top, height } = element.getBoundingClientRect();
            const windowHeight = window.innerHeight;

            // Calculate progress based on element position in viewport
            // Start highlighting when element enters viewport (top < windowHeight)
            // Finish highlighting when element is near center/top
            const start = windowHeight * 0.8;
            const end = windowHeight * 0.2;

            const progress = Math.min(Math.max((start - top) / (start - end), 0), 1);
            setScrollProgress(progress);
        };

        window.addEventListener("scroll", handleScroll);
        handleScroll(); // Initial check

        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const words = text.split(" ");

    return (
        <div ref={containerRef} className={cn("py-20 px-4", className)}>
            <p className="text-4xl md:text-6xl font-bold leading-tight flex flex-wrap gap-x-3 gap-y-2 justify-center text-center max-w-5xl mx-auto">
                {words.map((word, i) => {
                    const wordProgress = i / words.length;
                    const isHighlighted = scrollProgress > wordProgress;

                    return (
                        <span
                            key={i}
                            className={cn(
                                "transition-colors duration-300",
                                isHighlighted ? "text-foreground" : "text-muted-foreground/20"
                            )}
                        >
                            {word}
                        </span>
                    );
                })}
            </p>
        </div>
    );
};
