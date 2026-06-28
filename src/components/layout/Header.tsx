import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogIn, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { resetMobileGate } from "@/components/MobileGate";
import elifeLogo from "@/assets/elife-logo.png";

const navLinks = [
  { href: "/", label: "Home", labelMl: "ഹോം" },
  { href: "/about", label: "About", labelMl: "ഞങ്ങളെക്കുറിച്ച്" },
  { href: "/divisions", label: "Divisions", labelMl: "വിഭാഗങ്ങൾ" },
  { href: "/programs", label: "Programs", labelMl: "പരിപാടികൾ" },
  { href: "/contact", label: "Contact", labelMl: "ബന്ധപ്പെടുക" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { user, isLoading } = useAuth();
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <img 
            src={elifeLogo} 
            alt="e-Life Society" 
            className="h-12 w-auto transition-transform group-hover:scale-105"
          />
          <div className="hidden sm:flex flex-col">
            <span className="text-sm font-semibold text-primary leading-tight">ഇ-ലൈഫ് സൊസൈറ്റി</span>
            <span className="text-xs text-muted-foreground leading-tight">Women Empowerment</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === link.href
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:text-foreground hover:bg-secondary"
              )}
            >
              {link.label}
            </Link>
          ))}
          
          {/* Auth buttons */}
          {!isLoading && (
            user ? (
              <Button asChild size="sm" className="ml-2 bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/dashboard">
                  <span className="p-1 rounded bg-accent text-accent-foreground">
                    <LayoutDashboard className="h-4 w-4" />
                  </span>
                  <span className="ml-2">Dashboard</span>
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" className="ml-2 bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/auth">
                  <span className="p-1 rounded bg-accent text-accent-foreground">
                    <LogIn className="h-4 w-4" />
                  </span>
                  <span className="ml-2">Sign In</span>
                </Link>
              </Button>
            )
          )}
        </nav>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container py-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === link.href
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:text-foreground hover:bg-secondary"
                )}
              >
                <span>{link.label}</span>
                <span className="ml-2 text-xs opacity-70">{link.labelMl}</span>
              </Link>
            ))}
            
            {/* Mobile auth buttons */}
            {!isLoading && (
              user ? (
                <Link
                  to="/dashboard"
                  onClick={() => setIsMenuOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium bg-accent text-accent-foreground flex items-center gap-2"
                >
                  <span className="p-1 rounded bg-accent text-accent-foreground">
                    <LayoutDashboard className="h-4 w-4" />
                  </span>
                  Dashboard
                </Link>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setIsMenuOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium bg-accent text-accent-foreground flex items-center gap-2"
                >
                  <span className="p-1 rounded bg-accent text-accent-foreground">
                    <LogIn className="h-4 w-4" />
                  </span>
                  Sign In
                </Link>
              )
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
