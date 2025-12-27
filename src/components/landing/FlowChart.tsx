import { useEffect, useRef, useState } from "react";
import {
    Brain,
    GraduationCap,
    School,
    Database,
    Server,
    Lock,
    Users,
    BookOpen,
    Lightbulb,
    Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

export const FlowChart = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeGroup, setActiveGroup] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveGroup((prev) => (prev + 1) % 3);
        }, 3000); // Switch group every 3 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <section className="py-32 bg-black relative overflow-hidden text-white">
            {/* Background Glows */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/20 rounded-full blur-[120px]" />
                <div className="absolute top-0 left-0 w-96 h-96 bg-purple-900/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
            </div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="text-center mb-20">
                    <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                        Seamless <span className="text-primary">Interaction Flow</span>
                    </h2>
                    <p className="text-white/60 max-w-2xl mx-auto text-lg">
                        A unified ecosystem connecting every aspect of the educational journey.
                    </p>
                </div>

                <div className="relative max-w-6xl mx-auto h-[700px] md:h-[800px]" ref={containerRef}>

                    {/* Central Node: Perleap */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                        <div className="relative group">
                            <div className="absolute -inset-12 bg-primary rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 animate-pulse" />
                            <div className="w-40 h-20 md:w-48 md:h-24 bg-black/80 border border-white/20 rounded-lg shadow-2xl flex items-center justify-center gap-3 relative z-10 backdrop-blur-xl">
                                <img src="/perleap_logo.png" alt="Perleap" className="w-8 h-8 object-contain" />
                                <span className="font-bold text-xl md:text-2xl tracking-wide">Perleap</span>
                            </div>
                        </div>
                    </div>

                    {/* Group 1: Users (Left) */}
                    <NodeGroup
                        isActive={activeGroup === 0}
                        nodes={[
                            { icon: School, label: "Teacher", position: "top-[20%] left-[10%]" },
                            { icon: GraduationCap, label: "Students", position: "top-[45%] left-[5%]" },
                            { icon: Users, label: "Classes", position: "top-[70%] left-[10%]" },
                        ]}
                        connectionSide="left"
                    />

                    {/* Group 2: Tech (Right) */}
                    <NodeGroup
                        isActive={activeGroup === 1}
                        nodes={[
                            { icon: Lock, label: "Authentication", position: "top-[20%] right-[10%]" },
                            { icon: Server, label: "API", position: "top-[45%] right-[5%]" },
                            { icon: Database, label: "Databases", position: "top-[70%] right-[10%]" },
                        ]}
                        connectionSide="right"
                    />

                    {/* Group 3: Skills (Bottom/Center) */}
                    <NodeGroup
                        isActive={activeGroup === 2}
                        nodes={[
                            { icon: Brain, label: "Pedagogy", position: "bottom-[10%] left-[30%]" },
                            { icon: Lightbulb, label: "Soft Skills", position: "bottom-[5%] left-[50%] -translate-x-1/2" },
                            { icon: BookOpen, label: "Hard Skills", position: "bottom-[10%] right-[30%]" },
                        ]}
                        connectionSide="bottom"
                    />

                    {/* SVG Connections */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                        <defs>
                            <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
                                <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
                                <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
                            </linearGradient>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        {/* Static Lines */}
                        <g stroke="white" strokeOpacity="0.05" strokeWidth="1" fill="none">
                            {/* Approximate paths for visual structure - simplified for static rendering */}
                            {/* Left */}
                            <path d="M150 200 C 300 200, 400 400, 500 400" />
                            <path d="M100 400 C 250 400, 400 400, 500 400" />
                            <path d="M150 600 C 300 600, 400 400, 500 400" />
                            {/* Right */}
                            <path d="M850 200 C 700 200, 600 400, 500 400" />
                            <path d="M900 400 C 750 400, 600 400, 500 400" />
                            <path d="M850 600 C 700 600, 600 400, 500 400" />
                            {/* Bottom */}
                            <path d="M350 700 C 400 600, 450 500, 500 400" />
                            <path d="M500 750 C 500 650, 500 550, 500 400" />
                            <path d="M650 700 C 600 600, 550 500, 500 400" />
                        </g>

                        {/* Active Group Animations */}
                        {/* Note: In a real dynamic SVG, we'd calculate paths based on node positions. 
                Here we use fixed paths matching the static ones, toggled by opacity. */}

                        {/* Group 1 Flows (Left) */}
                        <g className={cn("transition-opacity duration-1000", activeGroup === 0 ? "opacity-100" : "opacity-0")} stroke="url(#flowGradient)" strokeWidth="2" fill="none" filter="url(#glow)">
                            <path className="animate-flow-1" d="M150 200 C 300 200, 400 400, 500 400" />
                            <path className="animate-flow-2" d="M100 400 C 250 400, 400 400, 500 400" />
                            <path className="animate-flow-3" d="M150 600 C 300 600, 400 400, 500 400" />
                        </g>

                        {/* Group 2 Flows (Right) */}
                        <g className={cn("transition-opacity duration-1000", activeGroup === 1 ? "opacity-100" : "opacity-0")} stroke="url(#flowGradient)" strokeWidth="2" fill="none" filter="url(#glow)">
                            <path className="animate-flow-1-reverse" d="M850 200 C 700 200, 600 400, 500 400" />
                            <path className="animate-flow-2-reverse" d="M900 400 C 750 400, 600 400, 500 400" />
                            <path className="animate-flow-3-reverse" d="M850 600 C 700 600, 600 400, 500 400" />
                        </g>

                        {/* Group 3 Flows (Bottom) */}
                        <g className={cn("transition-opacity duration-1000", activeGroup === 2 ? "opacity-100" : "opacity-0")} stroke="url(#flowGradient)" strokeWidth="2" fill="none" filter="url(#glow)">
                            <path className="animate-flow-1" d="M350 700 C 400 600, 450 500, 500 400" />
                            <path className="animate-flow-2" d="M500 750 C 500 650, 500 550, 500 400" />
                            <path className="animate-flow-3" d="M650 700 C 600 600, 550 500, 500 400" />
                        </g>

                    </svg>
                </div>
            </div>

            <style>{`
        .animate-flow-1 { stroke-dasharray: 20 300; stroke-dashoffset: 320; animation: flow 3s linear infinite; }
        .animate-flow-2 { stroke-dasharray: 20 300; stroke-dashoffset: 320; animation: flow 3.5s linear infinite; animation-delay: 0.5s; }
        .animate-flow-3 { stroke-dasharray: 20 300; stroke-dashoffset: 320; animation: flow 4s linear infinite; animation-delay: 1s; }
        
        .animate-flow-1-reverse { stroke-dasharray: 20 300; stroke-dashoffset: 320; animation: flow 3s linear infinite; animation-delay: 0.2s; }
        .animate-flow-2-reverse { stroke-dasharray: 20 300; stroke-dashoffset: 320; animation: flow 3.5s linear infinite; animation-delay: 0.7s; }
        .animate-flow-3-reverse { stroke-dasharray: 20 300; stroke-dashoffset: 320; animation: flow 4s linear infinite; animation-delay: 1.2s; }

        @keyframes flow {
          0% { stroke-dashoffset: 320; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { stroke-dashoffset: -320; opacity: 0; }
        }
      `}</style>
        </section>
    );
};

const NodeGroup = ({ isActive, nodes, connectionSide }: { isActive: boolean, nodes: any[], connectionSide: string }) => (
    <>
        {nodes.map((node, index) => (
            <Node
                key={index}
                icon={node.icon}
                label={node.label}
                position={node.position}
                isActive={isActive}
                delay={index}
            />
        ))}
    </>
);

const Node = ({ icon: Icon, label, position, isActive, delay }: { icon: any, label: string, position: string, isActive: boolean, delay: number }) => (
    <div
        className={cn(
            `absolute ${position} z-20 transition-all duration-700`,
            isActive ? "scale-110 opacity-100" : "scale-100 opacity-40"
        )}
    >
        <div className="flex flex-col items-center gap-3 group">
            <div
                className={cn(
                    "w-16 h-16 rounded-xl flex items-center justify-center transition-all duration-500 shadow-lg backdrop-blur-sm border",
                    isActive
                        ? "bg-purple-500/20 border-purple-500 text-white shadow-purple-500/20"
                        : "bg-black/50 border-white/10 text-white/50"
                )}
            >
                <Icon className="w-6 h-6" />
            </div>
            <span
                className={cn(
                    "text-sm font-medium transition-colors duration-500",
                    isActive ? "text-white" : "text-white/40"
                )}
            >
                {label}
            </span>
        </div>
    </div>
);
