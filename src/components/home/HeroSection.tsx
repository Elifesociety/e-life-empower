import { ArrowRight, Users, Heart, Sprout } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/10 py-20 lg:py-32">
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
      
      <div className="container relative">
        <div className="max-w-3xl mx-auto text-center">
          {/* Malayalam tagline */}
          <p className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent-foreground text-sm font-medium mb-6">
            <Heart className="h-4 w-4 text-accent" />
            <span>സ്ത്രീ ശാക്തീകരണം • Women Empowerment</span>
          </p>
          
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
            ഓരോ വീടും ഒരു സംരംഭം ,{" "}
            <span className="text-primary">ഒരു വീട്ടിൽ ഒരു സംരംഭക </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
            e-Life Society is a Kerala-based women empowerment ecosystem supporting 
            housewives through structured programs, training, welfare support, and 
            income-generation initiatives.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="gap-2">
              <Link to="/programs">
                View Programs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/about">
                Learn More
              </Link>
            </Button>
          </div>
          
          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8">
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">7</p>
              <p className="text-sm text-muted-foreground">Divisions</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <Heart className="h-6 w-6 text-accent" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">100+</p>
              <p className="text-sm text-muted-foreground">Programs</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sprout className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">Kerala</p>
              <p className="text-sm text-muted-foreground">Wide Reach</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
