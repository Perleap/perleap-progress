import { cn } from "@/lib/utils";

interface BreathingBackgroundProps {
    className?: string;
    children?: React.ReactNode;
}

export const BreathingBackground = ({ className, children }: BreathingBackgroundProps) => {
    return (
        <div className={cn("relative min-h-screen w-full overflow-hidden bg-background", className)}>
            {/* Animated Gradients */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-200/30 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-200/30 rounded-full blur-[120px] animate-pulse delay-1000" />
                <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-blue-200/20 rounded-full blur-[100px] animate-pulse delay-2000" />
            </div>

            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};
