import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

type AppRoute =
  | "/"
  | "/auth"
  | "/dashboard"
  | "/subjects"
  | "/chapters"
  | "/practice"
  | "/mock-test"
  | "/analytics"
  | "/history"
  | "/profile"
  | "/admin/question-review";

type NavLink = {
  to: AppRoute;
  label: string;
};

const studentLinks: NavLink[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/subjects", label: "HSC Subjects" },
  { to: "/chapters", label: "Chapters" },
  { to: "/practice", label: "Practice" },
  { to: "/mock-test", label: "Mock Test" },
  { to: "/analytics", label: "Analytics" },
  { to: "/history", label: "History" },
  { to: "/profile", label: "Profile" },
];

const adminLinks: NavLink[] = [
  { to: "/admin/question-review", label: "Admin Review" },
];

const publicLinks: NavLink[] = [{ to: "/", label: "Home" }];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const links = user ? (isAdmin ? [...studentLinks, ...adminLinks] : studentLinks) : publicLinks;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground shadow-soft">
              <BookOpenCheck className="h-5 w-5" />
            </span>
            <span>
              AI Prep <span className="text-primary">Partner</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="px-3 py-2 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                activeProps={{
                  className:
                    "px-3 py-2 text-sm rounded-lg text-foreground bg-muted font-medium",
                }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  nav({ to: "/" });
                }}
              >
                <LogOut className="h-4 w-4 mr-1" /> Logout
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Login</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setOpen((o) => !o)}
            aria-label="menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {open && (
          <div className="md:hidden border-t bg-card px-4 py-3 space-y-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
            {user ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={async () => {
                  await signOut();
                  setOpen(false);
                  nav({ to: "/" });
                }}
              >
                Logout
              </Button>
            ) : (
              <Button asChild size="sm" className="w-full">
                <Link to="/auth" onClick={() => setOpen(false)}>
                  Login / Sign up
                </Link>
              </Button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        AI Prep Partner - HSC exam preparation for Bangladeshi students
      </footer>
    </div>
  );
}
