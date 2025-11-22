import { Link } from "react-router-dom";
import { Sparkles, Twitter, Linkedin, Github } from "lucide-react";

export const Footer = () => {
    return (
        <footer className="bg-black border-t border-white/10 pt-20 pb-10">
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="space-y-4">
                        <Link to="/" className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-lg font-bold text-white">PerLeap</span>
                        </Link>
                        <p className="text-white/60 text-sm leading-relaxed">
                            Empowering education with intelligent agents. Transform your classroom with AI-driven insights and automation.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-6">Product</h4>
                        <ul className="space-y-4">
                            <li><Link to="#" className="text-white/60 hover:text-white text-sm transition-colors">Features</Link></li>
                            <li><Link to="#" className="text-white/60 hover:text-white text-sm transition-colors">Solutions</Link></li>
                            <li><Link to="#" className="text-white/60 hover:text-white text-sm transition-colors">Pricing</Link></li>
                            <li><Link to="#" className="text-white/60 hover:text-white text-sm transition-colors">Changelog</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-6">Company</h4>
                        <ul className="space-y-4">
                            <li><Link to="#" className="text-white/60 hover:text-white text-sm transition-colors">About</Link></li>
                            <li><Link to="#" className="text-white/60 hover:text-white text-sm transition-colors">Careers</Link></li>
                            <li><Link to="#" className="text-white/60 hover:text-white text-sm transition-colors">Blog</Link></li>
                            <li><Link to="#" className="text-white/60 hover:text-white text-sm transition-colors">Contact</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-6">Legal</h4>
                        <ul className="space-y-4">
                            <li><Link to="#" className="text-white/60 hover:text-white text-sm transition-colors">Privacy</Link></li>
                            <li><Link to="#" className="text-white/60 hover:text-white text-sm transition-colors">Terms</Link></li>
                            <li><Link to="#" className="text-white/60 hover:text-white text-sm transition-colors">Security</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-white/40 text-sm">
                        © 2024 PerLeap Inc. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        <a href="#" className="text-white/40 hover:text-white transition-colors"><Twitter className="w-5 h-5" /></a>
                        <a href="#" className="text-white/40 hover:text-white transition-colors"><Linkedin className="w-5 h-5" /></a>
                        <a href="#" className="text-white/40 hover:text-white transition-colors"><Github className="w-5 h-5" /></a>
                    </div>
                </div>
            </div>
        </footer>
    );
};
