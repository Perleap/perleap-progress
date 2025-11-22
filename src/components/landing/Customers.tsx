import { Building2 } from "lucide-react";

export const Customers = () => {
    return (
        <section className="py-32 bg-white border-t border-gray-100">
            <div className="container mx-auto px-4 md:px-6 text-center">
                <h2 className="text-3xl md:text-5xl font-bold mb-16 text-gray-900">
                    Hear from Enterprises Trusting <br />
                    Our Teams in 20+ Countries
                </h2>

                <div className="relative max-w-4xl mx-auto">
                    {/* Placeholder Card */}
                    <div className="bg-gray-50 rounded-3xl p-12 md:p-20 border border-gray-100 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
                        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <Building2 className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-2xl md:text-3xl font-medium text-gray-400 tracking-tight">
                            Customers will be added soon...
                        </h3>
                    </div>

                    {/* Decorative Elements */}
                    <div className="absolute top-1/2 -left-12 -translate-y-1/2 w-24 h-24 bg-gradient-to-br from-orange-100 to-pink-100 rounded-full blur-xl opacity-50 -z-10" />
                    <div className="absolute top-1/2 -right-12 -translate-y-1/2 w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full blur-xl opacity-50 -z-10" />
                </div>
            </div>
        </section>
    );
};
