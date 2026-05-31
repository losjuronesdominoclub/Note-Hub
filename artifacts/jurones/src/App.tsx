import React, { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { DevModeProvider } from "@/contexts/dev-mode-context";

import Layout from "@/components/layout";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Players from "@/pages/players";
import MatchNew from "@/pages/match-new";
import MatchLive from "@/pages/match-live";
import LiveMatches from "@/pages/live";
import History from "@/pages/history";
import Ranking from "@/pages/ranking";
import RankingPoints from "@/pages/ranking-points";
import Events from "@/pages/events";
import Lisas from "@/pages/lisas";
import LisasRecibidas from "@/pages/lisas-recibidas";
import DailyResults from "@/pages/daily-results";
import Stream from "@/pages/stream";
import Compare from "@/pages/compare";
import NotFound from "@/pages/not-found";
import logoPath from "@assets/logo_1779907396869.png";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: logoPath,
  },
  variables: {
    colorPrimary: "hsl(357 90% 46%)",
    colorForeground: "hsl(0 0% 98%)",
    colorMutedForeground: "hsl(0 0% 65%)",
    colorDanger: "hsl(0 62.8% 30.6%)",
    colorBackground: "hsl(0 0% 8%)",
    colorInput: "hsl(0 0% 18%)",
    colorInputForeground: "hsl(0 0% 98%)",
    colorNeutral: "hsl(0 0% 18%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#141414] border border-[#2a2a2a] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white text-2xl font-bold",
    headerSubtitle: "text-gray-400",
    socialButtonsBlockButtonText: "text-white font-medium",
    formFieldLabel: "text-gray-300 font-medium",
    footerActionLink: "text-red-500 hover:text-red-400",
    footerActionText: "text-gray-400",
    dividerText: "text-gray-500",
    identityPreviewEditButton: "text-red-500",
    formFieldSuccessText: "text-green-500",
    alertText: "text-red-500",
    logoBox: "h-12 flex justify-center mb-4",
    logoImage: "h-full w-auto object-contain",
    socialButtonsBlockButton: "border-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors",
    formButtonPrimary: "bg-red-600 hover:bg-red-700 text-white transition-colors",
    formFieldInput: "bg-[#1f1f1f] border-[#2a2a2a] text-white focus:border-red-500",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#2a2a2a]",
    alert: "border-red-500/50 bg-red-500/10",
    otpCodeFieldInput: "bg-[#1f1f1f] border-[#2a2a2a] text-white",
    formFieldRow: "mb-4",
    main: "px-8 py-6",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <Component />
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function PublicOrProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          
          <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
          <Route path="/players" component={() => <ProtectedRoute component={Players} />} />
          <Route path="/match/new" component={() => <ProtectedRoute component={MatchNew} />} />
          <Route path="/match/:id" component={() => <ProtectedRoute component={MatchLive} />} />
          <Route path="/history" component={() => <ProtectedRoute component={History} />} />
          <Route path="/ranking" component={() => <ProtectedRoute component={Ranking} />} />
          <Route path="/ranking-points" component={() => <ProtectedRoute component={RankingPoints} />} />
          <Route path="/events" component={() => <ProtectedRoute component={Events} />} />
          <Route path="/lisas" component={() => <ProtectedRoute component={Lisas} />} />
          <Route path="/lisas-recibidas" component={() => <ProtectedRoute component={LisasRecibidas} />} />
          <Route path="/daily-results" component={() => <ProtectedRoute component={DailyResults} />} />
          <Route path="/stream" component={() => <ProtectedRoute component={Stream} />} />
          <Route path="/compare" component={() => <ProtectedRoute component={Compare} />} />
          
          <Route path="/live" component={() => <PublicOrProtectedRoute component={LiveMatches} />} />
          
          <Route component={() => <Layout><NotFound /></Layout>} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="jurones-theme">
      <DevModeProvider>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <ClerkProviderWithRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </DevModeProvider>
    </ThemeProvider>
  );
}

export default App;
