import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const links = user
    ? [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/subjects", label: "Subjects" },
        { to: "/generate", label: "AI Questions" },
        { to: "/weakness", label: "Weak Areas" },
        { to: "/pricing", label: "Pricing" },
        ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
      ]
    : [
        { to: "/", label: "Home" },
        { to: "/pricing", label: "Pricing" },
      ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground shadow-soft">
              <Sparkles className="h-5 w-5" />
            </span>
            <span>Porikkha <span className="text-primary">AI</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="px-3 py-2 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                activeProps={{ className: "px-3 py-2 text-sm rounded-lg text-foreground bg-muted font-medium" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <Button variant="ghost" size="sm" onClick={async () => { await signOut(); nav({ to: "/" }); }}>
                <LogOut className="h-4 w-4 mr-1" /> Logout
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link to="/auth">Login</Link></Button>
                <Button asChild size="sm"><Link to="/auth">Get Started</Link></Button>
              </>
            )}
          </div>
          <button className="md:hidden p-2" onClick={() => setOpen((o) => !o)} aria-label="menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t bg-card px-4 py-3 space-y-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-sm hover:bg-muted">
                {l.label}
              </Link>
            ))}
            {user ? (
              <Button variant="outline" size="sm" className="w-full" onClick={async () => { await signOut(); setOpen(false); nav({ to: "/" }); }}>
                Logout
              </Button>
            ) : (
              <Button asChild size="sm" className="w-full"><Link to="/auth" onClick={() => setOpen(false)}>Login / Sign up</Link></Button>
            )}
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Porikkha AI · HSC Science · বাংলাদেশের শিক্ষার্থীদের জন্য
      </footer>
    </div>
  );
}
