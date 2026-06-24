import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles, Users, Heart, Sprout, Target, Eye, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

import farmelifeLogo from "@/assets/divisions/farmelife.png";
import organelifeLogo from "@/assets/divisions/organelife.png";
import foodelifeLogo from "@/assets/divisions/foodelife.png";
import entrelifeLogo from "@/assets/divisions/entrelife.png";
import embryoLogo from "@/assets/divisions/embryo.png";
import avalLogo from "@/assets/divisions/aval.jpg";
import pennyekartLogo from "@/assets/divisions/pennyekart.png";

const divisions = [
  { id: "farmelife", name: "Farmelife", nameMl: "ഫാർമെലൈഫ്", logo: farmelifeLogo },
  { id: "organelife", name: "Organelife", nameMl: "ഓർഗനെലൈഫ്", logo: organelifeLogo },
  { id: "foodelife", name: "Foodelife", nameMl: "ഫുഡെലൈഫ്", logo: foodelifeLogo },
  { id: "entrelife", name: "Entrelife", nameMl: "എന്ററലൈഫ്", logo: entrelifeLogo },
  { id: "embryo", name: "Embryo", nameMl: "എംബ്രിയോ", logo: embryoLogo },
  { id: "aval", name: "Aval", nameMl: "അവൾ", logo: avalLogo },
  { id: "pennyekart", name: "Pennyekart", nameMl: "പെന്നിക്കാർട്ട്", logo: pennyekartLogo },
];

export function BentoHome() {
  return (
    <section className="relative py-8 md:py-12">
      <div className="container">
        <div className="grid grid-cols-6 auto-rows-[minmax(120px,auto)] gap-3 md:gap-4">
          {/* Hero — large */}
          <div className="col-span-6 lg:col-span-4 row-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground p-6 md:p-10 flex flex-col justify-between min-h-[340px]">
            <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-primary-foreground/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-accent/30 blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-foreground/15 backdrop-blur text-xs font-medium mb-5">
                <Sparkles className="h-3.5 w-3.5" />
                <span>സ്ത്രീ ശാക്തീകരണം · Women Empowerment</span>
              </div>
              <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
                ഓരോ വീടും <br className="hidden md:block" />
                <span className="opacity-80">ഒരു സംരംഭം</span>
              </h1>
              <p className="mt-5 max-w-lg text-sm md:text-base opacity-90 leading-relaxed">
                A Kerala-based women empowerment ecosystem — programs, training, welfare
                and income-generation, rooted at the panchayath level.
              </p>
            </div>
            <div className="relative flex flex-wrap gap-3 mt-6">
              <Button asChild size="lg" variant="secondary" className="gap-2 rounded-full">
                <Link to="/programs">View Programs <ArrowUpRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2 rounded-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link to="/about">About Us</Link>
              </Button>
            </div>
          </div>

          {/* Stat — Divisions */}
          <Link to="/divisions" className="col-span-3 lg:col-span-2 rounded-3xl bg-card border border-border/60 p-5 md:p-6 flex flex-col justify-between hover:border-primary/40 hover:shadow-lg transition group">
            <div className="flex items-start justify-between">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
            </div>
            <div>
              <p className="font-display text-4xl md:text-5xl font-bold text-foreground">7</p>
              <p className="text-sm text-muted-foreground mt-1">Specialized Divisions</p>
            </div>
          </Link>

          {/* Stat — Reach */}
          <div className="col-span-3 lg:col-span-2 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 p-5 md:p-6 flex flex-col justify-between">
            <div className="h-11 w-11 rounded-2xl bg-accent/30 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="font-display text-3xl md:text-4xl font-bold text-foreground">Kerala</p>
              <p className="text-sm text-muted-foreground mt-1">Panchayath-level reach</p>
            </div>
          </div>

          {/* Divisions grid header */}
          <div className="col-span-6 lg:col-span-3 row-span-2 rounded-3xl bg-card border border-border/60 p-5 md:p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Our Wings</p>
                <h2 className="font-display text-2xl md:text-3xl font-bold">Seven Divisions</h2>
              </div>
              <Link to="/divisions" className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                All <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5 flex-1">
              {divisions.map((d) => (
                <Link
                  key={d.id}
                  to={`/division/${d.id}`}
                  className="group rounded-2xl border border-border/50 bg-background hover:bg-secondary/50 hover:border-primary/40 p-3 flex items-center gap-3 transition"
                >
                  <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                    <img src={d.logo} alt={d.name} className="max-h-8 max-w-8 object-contain" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{d.nameMl}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Vision */}
          <div className="col-span-6 sm:col-span-3 lg:col-span-3 rounded-3xl bg-card border border-border/60 p-5 md:p-6">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold mb-1.5">Our Vision</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A Kerala where every woman is economically empowered and socially respected.
            </p>
          </div>

          {/* Mission */}
          <div className="col-span-6 sm:col-span-3 lg:col-span-3 rounded-3xl bg-secondary/60 border border-border/60 p-5 md:p-6">
            <div className="h-11 w-11 rounded-2xl bg-accent/25 flex items-center justify-center mb-4">
              <Target className="h-5 w-5 text-accent-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold mb-1.5">Our Mission</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Empower women through structured programs, training, welfare and sustainable
              income-generation at the grassroots level.
            </p>
          </div>

          {/* CTA */}
          <div className="col-span-6 lg:col-span-4 rounded-3xl bg-foreground text-background p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 text-xs opacity-70 mb-2">
                <Calendar className="h-3.5 w-3.5" /> Join a Program
              </div>
              <h3 className="font-display text-2xl md:text-3xl font-bold leading-tight">
                Ready to transform your life?
              </h3>
              <p className="text-sm opacity-70 mt-2 max-w-md">
                പരിപാടികളിൽ പങ്കെടുക്കാൻ രജിസ്റ്റർ ചെയ്യുക
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="rounded-full gap-2 shrink-0">
              <Link to="/programs">Browse Programs <ArrowUpRight className="h-4 w-4" /></Link>
            </Button>
          </div>

          {/* Contact tile */}
          <Link to="/contact" className="col-span-6 lg:col-span-2 rounded-3xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/20 p-6 flex flex-col justify-between hover:shadow-lg transition group">
            <div className="h-11 w-11 rounded-2xl bg-background/70 flex items-center justify-center">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-display text-xl font-semibold">Get in touch</p>
              <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                Contact us <ArrowUpRight className="h-3.5 w-3.5" />
              </p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
