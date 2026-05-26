import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpenCheck, ChevronDown, LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

type AppRoute =
  | "/"
  | "/auth"
  | "/dashboard"
  | "/subjects"
  | "/board-questions"
  | "/practice"
  | "/mock-test"
  | "/analytics"
  | "/study-plan"
  | "/resources"
  | "/ai-generator"
  | "/past-paper-analyzer"
  | "/history"
  | "/profile"
  | "/admin/question-review"
  | "/admin/board-questions";

type NavLink = { to: AppRoute; label: string };

const primaryLinks: NavLink[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/subjects", label: "Subjects" },
  { to: "/board-questions", label: "Board Questions" },
  { to: "/practice", label: "Practice" },
  { to: "/mock-test", label: "Mock Test" },
  { to: "/analytics", label: "Progress" },
  { to: "/study-plan", label: "Study Plan" },
];

const moreLinks: NavLink[] = [
  { to: "/ai-generator", label: "AI Generator" },
  { to: "/resources", label: "Resources" },
  { to: "/past-paper-analyzer", label: "Board Trends" },
  { to: "/history", label: "History" },
  { to: "/profile", label: "Profile" },
];

const adminLinks: NavLink[] = [
  { to: "/admin/board-questions", label: "Admin · Board Questions" },
  { to: "/admin/question-review", label: "Admin · Review" },
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
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 font-bold text-lg shrink-0">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground shadow-soft">
              <BookOpenCheck className="h-5 w-5" />
            </span>
            <span className="hidden sm:inline">
              AI Prep <span className="text-primary">Partner</span>
            </span>
          </Link>

          {showAppNav ? (
            <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
              {primaryLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="px-2.5 py-2 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                  activeProps={{
                    className:
                      "px-2.5 py-2 text-sm rounded-lg text-foreground bg-muted font-medium",
                  }}
                >
                  {l.label}
                </Link>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-2.5 py-2 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition inline-flex items-center gap-1">
                    More <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {more.map((l) => (
                    <DropdownMenuItem key={l.to} asChild>
                      <Link to={l.to}>{l.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          ) : null}

          <div className="hidden md:flex items-center gap-2 shrink-0">
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
            className="lg:hidden p-2"
            onClick={() => setOpen((o) => !o)}
            aria-label="menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {open && (
          <div className="lg:hidden border-t bg-card px-4 py-3 space-y-1 max-h-[70vh] overflow-y-auto">
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
        AI Prep Partner — HSC Board Question Practice for Bangladeshi students
      </footer>
    </div>
  );
}
