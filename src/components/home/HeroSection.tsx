import { ArrowRight, Users, Heart, Sprout, Sparkles, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-secondary via-background to-background py-16 lg:py-28">
      {/* Animated decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-[10%] w-64 h-64 bg-primary/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-32 right-[15%] w-48 h-48 bg-accent/20 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute bottom-20 left-[20%] w-56 h-56 bg-primary/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute -bottom-10 right-[10%] w-80 h-80 bg-accent/15 rounded-full blur-3xl" />
      </div>
      
      {/* Floating shapes */}
      <div className="absolute top-20 right-[25%] w-3 h-3 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
      <div className="absolute top-40 left-[30%] w-2 h-2 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
      <div className="absolute bottom-32 right-[35%] w-4 h-4 bg-primary/30 rounded-full animate-bounce" style={{ animationDelay: '0.8s' }} />
      
      <div className="container relative">
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-stretch max-w-6xl mx-auto">
         <div className="text-center lg:text-left">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/20 text-primary text-sm font-medium mb-8 shadow-sm">
            <Sparkles className="h-4 w-4" />
            <span>സ്ത്രീ ശാക്തീകരണം • Women Empowerment</span>
            <Sparkles className="h-4 w-4" />
          </div>
          
          {/* Main heading with gradient */}
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            <span className="text-foreground">ഓരോ വീടും ഒരു സംരംഭം,</span>
            <br />
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              ഒരു വീട്ടിൽ ഒരു സംരംഭക
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
            e-Life Society is a Kerala-based women empowerment ecosystem supporting 
            housewives through structured programs, training, welfare support, and 
            income-generation initiatives.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-16">
            <Button asChild size="lg" className="gap-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
              <Link to="/programs">
                View Programs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-2 hover:bg-secondary">
              <Link to="/about">
                Learn More
              </Link>
            </Button>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-2xl mx-auto">
            <div className="group bg-card/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-border/50 hover:shadow-xl hover:border-primary/30 transition-all hover:-translate-y-1">
              <div className="flex justify-center mb-3">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="h-7 w-7 text-primary" />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">7</p>
              <p className="text-sm text-muted-foreground">Divisions</p>
            </div>
            
            <div className="group bg-card/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-border/50 hover:shadow-xl hover:border-accent/30 transition-all hover:-translate-y-1">
              <div className="flex justify-center mb-3">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-accent/25 to-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Heart className="h-7 w-7 text-accent" />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">100+</p>
              <p className="text-sm text-muted-foreground">Programs</p>
            </div>
            
            <div className="group bg-card/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-border/50 hover:shadow-xl hover:border-primary/30 transition-all hover:-translate-y-1">
              <div className="flex justify-center mb-3">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sprout className="h-7 w-7 text-primary" />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">Kerala</p>
              <p className="text-sm text-muted-foreground">Wide Reach</p>
            </div>
          </div>
         </div>

         {/* Samrabhaka.com vertical entry card */}
         <Link
           to="/samrambhaka"
           className="group relative flex flex-col items-center justify-between rounded-3xl overflow-hidden shadow-2xl border-4 border-white/30 min-h-[420px] lg:min-h-full lg:w-72 p-8 text-white bg-gradient-to-br from-pink-500 via-pink-600 to-pink-700 hover:from-pink-600 hover:to-pink-800 transition-all hover:-translate-y-1 text-center"
         >
           <div className="absolute inset-0 opacity-20 pointer-events-none">
             <div className="absolute top-4 right-4 w-32 h-32 bg-white rounded-full blur-3xl" />
             <div className="absolute bottom-8 left-4 w-40 h-40 bg-yellow-300 rounded-full blur-3xl" />
           </div>
           <div className="relative pt-6">
             <h3 className="font-display text-3xl md:text-4xl font-bold leading-tight drop-shadow-sm">
               സംരംഭക. കോം
             </h3>
           </div>
           <div className="relative pb-6">
             <span className="font-display text-2xl md:text-3xl font-semibold drop-shadow-sm group-hover:underline">
               Login
             </span>
           </div>
         </Link>
        </div>
      </div>
    </section>
  );
}
