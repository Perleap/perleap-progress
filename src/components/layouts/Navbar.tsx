import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTranslation } from "react-i18next";

export const Navbar = () => {
    const { t } = useTranslation();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { name: t('landing.nav.product'), href: "/product" },
        { name: t('landing.nav.solutions'), href: "/solutions" },
        { name: t('landing.nav.pricing'), href: "/pricing" },
        { name: t('landing.nav.about'), href: "/about" },
    ];

    return (
        <nav
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                isScrolled ? "glass py-4" : "bg-transparent py-6"
            )}
        >
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-black/5 group-hover:bg-black/10 transition-colors">
                            <img src="/perleap_logo.png" alt="Perleap Logo" className="w-6 h-6 object-contain" />
                        </div>
                        <span className="text-xl font-bold text-foreground tracking-tight">
                            Perleap
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                to={link.href}
                                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                        <ThemeToggle />
                        <Link to="/login" className="text-sm font-medium text-foreground hover:text-foreground/80 transition-colors">
                            {t('landing.nav.login')}
                        </Link>
                        <Link to="/register">
                            <Button className="bg-black text-white hover:bg-black/90 rounded-full px-6">
                                {t('landing.nav.getStarted')}
                            </Button>
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden text-foreground p-2"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden absolute top-full left-0 right-0 glass border-t border-black/5 p-4 animate-accordion-down">
                    <div className="flex flex-col gap-4">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                to={link.href}
                                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                {link.name}
                            </Link>
                        ))}
                        <div className="h-px bg-black/5 my-2" />
                        <div className="flex items-center justify-end">
                            <ThemeToggle />
                        </div>
                        <Link
                            to="/login"
                            className="text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            {t('landing.nav.login')}
                        </Link>
                        <Button className="w-full bg-black text-white hover:bg-black/90 rounded-full">
                            {t('landing.nav.getStarted')}
                        </Button>
                    </div>
                </div>
            )}
        </nav>
    );
};
