import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpenCheck,
  ChevronDown,
  LogOut,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";

type AppRoute =
  | "/"
  | "/auth"
  | "/dashboard"
  | "/subjects"
  | "/chapters"
  | "/practice"
  | "/mock-test"
  | "/resources"
  | "/ai-generator"
  | "/past-paper-analyzer"
  | "/study-plan"
  | "/analytics"
  | "/history"
  | "/profile"
  | "/admin/question-review";

type NavLink = { to: AppRoute; label: string };

// 4 primary tabs — the everyday flow
const primaryLinks: NavLink[] = [
  { to: "/dashboard", label: "Home" },
  { to: "/subjects", label: "Practice" },
  { to: "/mock-test", label: "Mock Test" },
  { to: "/analytics", label: "Progress" },
];

// Everything else lives under "More"
const moreLinks: NavLink[] = [
  { to: "/resources", label: "Resources" },
  { to: "/ai-generator", label: "AI Generator" },
  { to: "/past-paper-analyzer", label: "Board Trends" },
  { to: "/study-plan", label: "Study Plan" },
  { to: "/history", label: "History" },
  { to: "/profile", label: "Profile" },
];

const adminLinks: NavLink[] = [
  { to: "/admin/question-review", label: "Admin Review" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const showAppNav = !!user;
  const more = isAdmin ? [...moreLinks, ...adminLinks] : moreLinks;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 font-bold text-lg">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground shadow-soft">
              <BookOpenCheck className="h-5 w-5" />
            </span>
            <span>
              AI Prep <span className="text-primary">Partner</span>
            </span>
          </Link>

          {showAppNav ? (
            <nav className="hidden md:flex items-center gap-1">
              {primaryLinks.map((l) => (
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

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-3 py-2 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition inline-flex items-center gap-1">
                    More <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {more.map((l) => (
                    <DropdownMenuItem key={l.to} asChild>
                      <Link to={l.to}>{l.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          ) : null}

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
            {showAppNav ? (
              <>
                {primaryLinks.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm hover:bg-muted"
                  >
                    {l.label}
                  </Link>
                ))}
                <div className="my-2 border-t" />
                <p className="px-3 pt-1 pb-1 text-xs uppercase tracking-wider text-muted-foreground">
                  More
                </p>
                {more.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm hover:bg-muted"
                  >
                    {l.label}
                  </Link>
                ))}
              </>
            ) : (
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm hover:bg-muted"
              >
                Home
              </Link>
            )}

            {user ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={async () => {
                  await signOut();
                  setOpen(false);
                  nav({ to: "/" });
                }}
              >
                Logout
              </Button>
            ) : (
              <Button asChild size="sm" className="w-full mt-2">
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
