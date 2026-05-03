import { useState } from "react";
import { Link } from "wouter";
import { Crown, Search, ArrowLeft, Copy, Check, Share2, Trophy, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCheckWaitlistPosition } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function buildReferralLink(code: string): string {
  const origin = window.location.origin;
  return `${origin}${BASE_URL}/?ref=${code}`;
}

function PositionCard({
  position,
  totalSignups,
  referralCount,
  referralCode,
  name,
}: {
  position: number;
  totalSignups: number;
  referralCount: number;
  referralCode: string;
  name: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const referralLink = buildReferralLink(referralCode);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: "Join me on Finders",
        text: "I'm on the Finders early access waitlist — join using my link to help us both move up!",
        url: referralLink,
      });
    } else {
      copyLink();
    }
  };

  const pct = Math.max(5, Math.round(((totalSignups - position + 1) / totalSignups) * 100));

  return (
    <div className="w-full max-w-md space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {name && (
        <p className="text-center text-white/50 text-sm">
          Welcome back, <span className="text-[#C9A84C] font-medium">{name.split(" ")[0]}</span>
        </p>
      )}

      {/* Position card */}
      <div className="bg-[#111111] border border-[#8B6914]/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(139,105,20,0.12)]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5 text-[#C9A84C]" />
            Waitlist position
          </div>
          <div className="text-xs text-white/30 font-mono">
            of {totalSignups.toLocaleString()}
          </div>
        </div>

        <div className="text-center mb-5">
          <div className="text-7xl font-serif font-bold text-white leading-none">
            #{position.toLocaleString()}
          </div>
          <div className="mt-2 text-sm text-white/40">
            You're ahead of{" "}
            <span className="text-[#C9A84C] font-medium">
              {Math.max(0, totalSignups - position).toLocaleString()}
            </span>{" "}
            {totalSignups - position === 1 ? "person" : "people"}
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-white/30">
            <span>#1</span>
            <span className="text-[#C9A84C]">{pct}% ahead</span>
            <span>#{totalSignups}</span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8B6914] to-[#C9A84C] transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Referrals card */}
      <div className="bg-[#111111] border border-[#8B6914]/20 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider">
            <Users className="w-3.5 h-3.5 text-[#C9A84C]" />
            Your referrals
          </div>
          <div className="text-xl font-serif font-bold text-[#C9A84C]">
            {referralCount}
          </div>
        </div>

        {referralCount > 0 ? (
          <p className="text-sm text-white/50 mb-4">
            You've referred <span className="text-white/80 font-medium">{referralCount}</span>{" "}
            {referralCount === 1 ? "person" : "people"} — keep sharing to climb higher.
          </p>
        ) : (
          <p className="text-sm text-white/50 mb-4">
            You haven't referred anyone yet. Each referral moves you one spot up the list.
          </p>
        )}

        {/* Referral link box */}
        <div className="bg-black/50 border border-[#8B6914]/20 rounded-lg px-3 py-2.5 mb-3 flex items-center gap-2">
          <span className="font-mono text-xs text-[#C9A84C] truncate flex-1">{referralLink}</span>
          <button
            onClick={copyLink}
            className="shrink-0 text-white/40 hover:text-[#C9A84C] transition-colors"
            title="Copy link"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={copyLink}
            variant="outline"
            className="flex-1 border-[#8B6914]/30 bg-transparent text-white/70 hover:bg-white/5 hover:text-white text-sm"
          >
            {copied ? (
              <><Check className="w-3.5 h-3.5 mr-1.5 text-green-400" /> Copied!</>
            ) : (
              <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Link</>
            )}
          </Button>
          <Button
            onClick={shareLink}
            className="flex-1 bg-[#8B6914] hover:bg-[#C9A84C] text-black font-semibold text-sm transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5" />
            Share
          </Button>
        </div>
      </div>

      {/* Move up tip */}
      {referralCount === 0 && (
        <div className="bg-[#8B6914]/8 border border-[#8B6914]/20 rounded-xl px-4 py-3 flex items-start gap-3">
          <ChevronRight className="w-4 h-4 text-[#C9A84C] mt-0.5 shrink-0" />
          <p className="text-sm text-white/55 leading-relaxed">
            Every person who joins using your link moves you up one spot. Share it with friends who freelance, create, or build.
          </p>
        </div>
      )}

      <div className="text-center">
        <Link href="/" className="text-sm text-white/30 hover:text-[#C9A84C] transition-colors">
          ← Back to homepage
        </Link>
      </div>
    </div>
  );
}

export default function CheckPosition() {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [notFound, setNotFound] = useState(false);

  const { data, isLoading, error } = useCheckWaitlistPosition(
    { email: submittedEmail },
    {
      query: {
        enabled: !!submittedEmail,
        retry: false,
      },
    }
  );

  const is404 = (error as { status?: number } | null)?.status === 404 || notFound;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setNotFound(false);
    setSubmittedEmail(trimmed);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A] text-[#E8E8E8] font-sans flex flex-col selection:bg-[#8B6914] selection:text-white">
      {/* Header */}
      <header className="w-full border-b border-[#8B6914]/15 bg-[#0A0A0A]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-5xl">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Crown className="w-5 h-5 text-[#C9A84C]" />
            <span className="font-serif text-lg font-bold tracking-wide text-white">Finders</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md space-y-8">
          {/* Hero text */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 bg-[#8B6914]/10 border border-[#8B6914]/20 rounded-full px-4 py-1.5 text-xs text-[#C9A84C] uppercase tracking-widest mb-2">
              <Search className="w-3 h-3" />
              Check your spot
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-white">
              Where are you on the list?
            </h1>
            <p className="text-white/50 text-sm leading-relaxed">
              Enter the email you signed up with to see your current position and share your referral link.
            </p>
          </div>

          {/* Form */}
          {(!data || is404) && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setNotFound(false);
                    if (submittedEmail && e.target.value.trim().toLowerCase() !== submittedEmail) {
                      setSubmittedEmail("");
                    }
                  }}
                  required
                  className="flex-1 bg-white/5 border-[#8B6914]/30 text-white placeholder:text-white/30 focus-visible:ring-[#8B6914]/50 focus-visible:border-[#8B6914] h-11"
                />
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-[#8B6914] hover:bg-[#C9A84C] text-black font-semibold transition-colors h-11 px-6 shrink-0"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                      Checking…
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Search className="w-4 h-4" />
                      Look me up
                    </span>
                  )}
                </Button>
              </div>

              {(is404 || (error && !is404)) && (
                <p className="text-sm text-center text-red-400/80">
                  {is404
                    ? "That email isn't on the waitlist yet. "
                    : "Something went wrong. Please try again."}
                  {is404 && (
                    <Link href="/" className="text-[#C9A84C] hover:underline">
                      Join now →
                    </Link>
                  )}
                </p>
              )}
            </form>
          )}

          {/* Results */}
          {data && !is404 && (
            <>
              <PositionCard
                position={data.position}
                totalSignups={data.totalSignups}
                referralCount={data.referralCount}
                referralCode={data.referralCode}
                name={data.name ?? null}
              />
              <div className="text-center">
                <button
                  onClick={() => {
                    setSubmittedEmail("");
                    setEmail("");
                    setNotFound(false);
                  }}
                  className="text-xs text-white/25 hover:text-white/50 transition-colors"
                >
                  Check a different email
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
