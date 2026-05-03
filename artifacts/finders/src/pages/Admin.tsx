import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Users,
  Crown,
  LogOut,
  Send,
  Mail,
  X,
  CheckCircle2,
  AlertCircle,
  Trophy,
  Share2,
  ArrowUpDown,
} from "lucide-react";
import {
  useListWaitlistEntries,
  useGetWaitlistCount,
  useGetAdminReferralStats,
  getGetAdminReferralStatsQueryKey,
  getListWaitlistEntriesQueryKey
} from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AdminLogin from "./AdminLogin";

function useAdminAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("admin_token"));
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!token) { setChecking(false); return; }
    fetch("/api/admin/verify", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (r.ok) setVerified(true); else { localStorage.removeItem("admin_token"); setToken(null); } })
      .catch(() => { localStorage.removeItem("admin_token"); setToken(null); })
      .finally(() => setChecking(false));
  }, [token]);

  const login = (t: string) => { setToken(t); setVerified(true); };
  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    localStorage.removeItem("admin_token");
    setToken(null);
    setVerified(false);
  };

  return { token, verified, checking, login, logout };
}

type NotifyStatus = { total: number; unnotified: number; alreadyNotified: number } | null;
type NotifyResult = { sent: number; failed: number; message: string } | null;

function NotifyDialog({
  token,
  onClose,
}: {
  token: string;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("Finders is almost here — you're on the list");
  const [message, setMessage] = useState(
    "We're putting the final touches on Finders. Get ready to find your next gig, land your next client, and sell your best work. We'll be in touch very soon."
  );
  const [notifyAll, setNotifyAll] = useState(false);
  const [status, setStatus] = useState<NotifyStatus>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<NotifyResult>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/notify-status", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setError("Failed to load recipient status."))
      .finally(() => setLoadingStatus(false));
  }, [token]);

  const recipientCount = notifyAll ? (status?.total ?? 0) : (status?.unnotified ?? 0);

  const handleSend = async () => {
    if (recipientCount === 0) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/notify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject, message, notifyAll }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111111] border border-[#8B6914]/30 rounded-2xl shadow-[0_0_60px_rgba(139,105,20,0.15)] w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#8B6914]/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#8B6914]/20 flex items-center justify-center">
              <Mail className="w-4 h-4 text-[#C9A84C]" />
            </div>
            <div>
              <h3 className="font-serif text-lg text-white font-semibold">Send Launch Email</h3>
              <p className="text-xs text-white/40 mt-0.5">Notify your waitlist subscribers</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          /* Success state */
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#8B6914]/20 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-[#C9A84C]" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">{result.message}</p>
              {result.failed > 0 && (
                <p className="text-red-400 text-sm mt-1">{result.failed} email{result.failed !== 1 ? "s" : ""} failed to send.</p>
              )}
            </div>
            <Button onClick={onClose} className="mt-2 bg-[#8B6914] hover:bg-[#C9A84C] text-black font-semibold">
              Done
            </Button>
          </div>
        ) : (
          /* Form state */
          <div className="p-6 flex flex-col gap-5">
            {/* Recipient selector */}
            <div className="bg-black/30 border border-[#8B6914]/15 rounded-xl p-4">
              {loadingStatus ? (
                <Skeleton className="h-5 w-40 bg-white/10" />
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Recipients</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                          !notifyAll ? "border-[#C9A84C] bg-[#C9A84C]" : "border-white/30 group-hover:border-white/50"
                        }`}
                        onClick={() => setNotifyAll(false)}
                      >
                        {!notifyAll && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                      </div>
                      <span className="text-sm text-white/80" onClick={() => setNotifyAll(false)}>
                        New only —{" "}
                        <span className="text-[#C9A84C] font-semibold">{status?.unnotified ?? 0}</span>{" "}
                        <span className="text-white/40">not yet notified</span>
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                          notifyAll ? "border-[#C9A84C] bg-[#C9A84C]" : "border-white/30 group-hover:border-white/50"
                        }`}
                        onClick={() => setNotifyAll(true)}
                      >
                        {notifyAll && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                      </div>
                      <span className="text-sm text-white/80" onClick={() => setNotifyAll(true)}>
                        Everyone —{" "}
                        <span className="text-[#C9A84C] font-semibold">{status?.total ?? 0}</span>{" "}
                        <span className="text-white/40">total subscribers</span>
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Subject */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-white/40 uppercase tracking-wider font-medium">Subject line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-black/50 border border-[#8B6914]/30 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#8B6914] transition-colors"
                placeholder="Email subject..."
              />
            </div>

            {/* Message */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-white/40 uppercase tracking-wider font-medium">Message body</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full bg-black/50 border border-[#8B6914]/30 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#8B6914] transition-colors resize-none"
                placeholder="Your message..."
              />
              <p className="text-xs text-white/25">This message is placed inside a branded Finders email template.</p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                onClick={onClose}
                className="text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
              <Button
                onClick={handleSend}
                disabled={sending || recipientCount === 0 || !subject.trim() || !message.trim()}
                className="bg-[#8B6914] hover:bg-[#C9A84C] text-black font-semibold disabled:opacity-40 disabled:cursor-not-allowed min-w-[140px]"
              >
                {sending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    Sending…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" />
                    Send to {recipientCount} {recipientCount === 1 ? "person" : "people"}
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const { token, verified, checking, login, logout } = useAdminAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [showNotify, setShowNotify] = useState(false);
  const [sortByReferrals, setSortByReferrals] = useState(false);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data: countData, isLoading: countLoading } = useGetWaitlistCount();
  const { data: referralStats, isLoading: referralStatsLoading } = useGetAdminReferralStats({
    query: { queryKey: getGetAdminReferralStatsQueryKey(), refetchInterval: 30_000 },
  });

  const { data: listData, isLoading: listLoading } = useListWaitlistEntries(
    { search: debouncedSearch || undefined, page, limit },
    {
      query: {
        queryKey: getListWaitlistEntriesQueryKey({
          search: debouncedSearch || undefined,
          page,
          limit,
        }),
      },
    }
  );

  const totalPages = listData ? Math.ceil(listData.total / limit) : 1;

  // Sorted view (client-side for current page)
  const displayEntries = React.useMemo(() => {
    if (!listData?.entries) return [];
    if (!sortByReferrals) return listData.entries;
    return [...listData.entries].sort((a, b) => (b.referralCount ?? 0) - (a.referralCount ?? 0));
  }, [listData?.entries, sortByReferrals]);

  const handleExport = () => {
    window.open("/api/waitlist/export", "_blank");
  };

  if (checking) {
    return (
      <div className="min-h-[100dvh] bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#8B6914] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!verified) {
    return <AdminLogin onLogin={login} />;
  }

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A] text-[#E8E8E8] font-sans selection:bg-[#8B6914] selection:text-white">
      {showNotify && token && (
        <NotifyDialog token={token} onClose={() => setShowNotify(false)} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-[#8B6914]/20 bg-[#0A0A0A]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <Crown className="w-6 h-6 text-[#C9A84C]" />
              <span className="font-serif text-xl font-bold tracking-wide text-white">
                Finders
              </span>
            </Link>
            <div className="h-4 w-px bg-white/20 mx-2 hidden sm:block" />
            <h1 className="text-sm font-medium text-white/60 hidden sm:block">
              Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm text-white/40 hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8 md:py-12 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl text-white mb-2">Waitlist Management</h2>
            <p className="text-white/60 text-sm md:text-base">
              View, search, export, and notify your early access signups.
            </p>
          </div>

          <Button
            onClick={() => setShowNotify(true)}
            className="bg-[#8B6914]/20 hover:bg-[#8B6914]/40 border border-[#8B6914]/40 text-[#C9A84C] font-semibold transition-all self-start md:self-auto"
            variant="outline"
          >
            <Mail className="mr-2 h-4 w-4" />
            Notify All
          </Button>
        </div>

        {/* Stat cards row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <Card className="bg-[#111111] border-[#8B6914]/30 shadow-[0_0_15px_rgba(139,105,20,0.1)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-medium text-white/60 uppercase tracking-wider">Total Signups</CardTitle>
              <Users className="h-4 w-4 text-[#C9A84C]" />
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="text-3xl font-serif font-bold text-white">
                {countLoading ? <Skeleton className="h-9 w-20 bg-white/10" /> : (countData?.count?.toLocaleString() || "0")}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#111111] border-[#8B6914]/30 shadow-[0_0_15px_rgba(139,105,20,0.1)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-medium text-white/60 uppercase tracking-wider">Total Referrals</CardTitle>
              <Share2 className="h-4 w-4 text-[#C9A84C]" />
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="text-3xl font-serif font-bold text-white">
                {referralStatsLoading ? <Skeleton className="h-9 w-20 bg-white/10" /> : (referralStats?.totalReferrals ?? 0).toLocaleString()}
              </div>
              <p className="text-xs text-white/30 mt-1">
                {referralStatsLoading ? <Skeleton className="h-3 w-28 bg-white/10 mt-1" /> : `${(referralStats?.totalReferrers ?? 0).toLocaleString()} unique referrers`}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#111111] border-[#8B6914]/30 shadow-[0_0_15px_rgba(139,105,20,0.1)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-medium text-white/60 uppercase tracking-wider">Top Referrer</CardTitle>
              <Trophy className="h-4 w-4 text-[#C9A84C]" />
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {referralStatsLoading ? (
                <Skeleton className="h-9 w-32 bg-white/10" />
              ) : referralStats && referralStats.topReferrerCount > 0 ? (
                <>
                  <div className="text-lg font-serif font-bold text-white truncate">
                    {referralStats.topReferrerName || "Anonymous"}
                  </div>
                  <p className="text-xs text-[#C9A84C] mt-0.5">
                    {referralStats.topReferrerCount} {referralStats.topReferrerCount === 1 ? "referral" : "referrals"} · all time
                  </p>
                </>
              ) : (
                <div className="text-white/30 text-sm pt-1">No referrals yet</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="bg-[#111111] border border-[#8B6914]/20 rounded-xl overflow-hidden shadow-2xl">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-[#8B6914]/20 flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#141414]">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="Search name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-black/50 border-[#8B6914]/30 text-white placeholder:text-white/40 focus-visible:ring-[#8B6914]/50 focus-visible:border-[#8B6914]"
              />
            </div>
            <Button
              onClick={handleExport}
              className="w-full sm:w-auto bg-[#8B6914] hover:bg-[#C9A84C] text-black font-semibold transition-colors"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#8B6914]/20 hover:bg-transparent">
                  <TableHead className="text-white/50 font-medium w-16 text-center">#</TableHead>
                  <TableHead className="text-white/50 font-medium">Name</TableHead>
                  <TableHead className="text-white/50 font-medium">Email</TableHead>
                  <TableHead className="text-white/50 font-medium">
                    <button
                      onClick={() => setSortByReferrals((s) => !s)}
                      className={`flex items-center gap-1.5 transition-colors ${sortByReferrals ? "text-[#C9A84C]" : "text-white/50 hover:text-white/80"}`}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      Referrals
                    </button>
                  </TableHead>
                  <TableHead className="text-white/50 font-medium text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-[#8B6914]/10 hover:bg-white/[0.02]">
                      <TableCell><Skeleton className="h-4 w-8 mx-auto bg-white/10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32 bg-white/10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48 bg-white/10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 bg-white/10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24 ml-auto bg-white/10" /></TableCell>
                    </TableRow>
                  ))
                ) : displayEntries.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="h-32 text-center text-white/50">
                      No entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayEntries.map((entry, idx) => (
                    <TableRow key={entry.id} className="border-[#8B6914]/10 hover:bg-white/[0.02] transition-colors group">
                      <TableCell className="text-center font-mono text-xs text-white/30 group-hover:text-[#C9A84C] transition-colors">
                        {(page - 1) * limit + idx + 1}
                      </TableCell>
                      <TableCell className="font-medium text-white/90">
                        <div className="flex items-center gap-2">
                          {entry.name || <span className="text-white/30 italic">Not provided</span>}
                          {entry.referredBy && (
                            <span className="text-[10px] font-mono text-[#8B6914] bg-[#8B6914]/10 border border-[#8B6914]/20 rounded px-1 py-0.5 leading-none" title={`Referred by ${entry.referredBy}`}>
                              via ref
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-white/70">
                        <a href={`mailto:${entry.email}`} className="hover:text-[#C9A84C] transition-colors">
                          {entry.email}
                        </a>
                      </TableCell>
                      <TableCell>
                        {(entry.referralCount ?? 0) > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#C9A84C]">{entry.referralCount}</span>
                            <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#8B6914] to-[#C9A84C]"
                                style={{ width: `${Math.min(100, ((entry.referralCount ?? 0) / Math.max(1, ...(displayEntries.map(e => e.referralCount ?? 0)))) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-white/20">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-white/50 font-mono text-sm">
                        {format(new Date(entry.createdAt), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {(!listLoading && listData && listData.total > 0) && (
            <div className="p-4 border-t border-[#8B6914]/20 flex items-center justify-between bg-[#141414]">
              <p className="text-sm text-white/40">
                Showing <span className="text-white/80 font-medium">{(page - 1) * limit + 1}</span> to{" "}
                <span className="text-white/80 font-medium">{Math.min(page * limit, listData.total)}</span> of{" "}
                <span className="text-white/80 font-medium">{listData.total}</span> entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-[#8B6914]/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous</span>
                </Button>
                <div className="text-sm text-white/60 font-medium min-w-8 text-center">
                  {page} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="border-[#8B6914]/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
