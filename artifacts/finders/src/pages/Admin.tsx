import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Users,
  ArrowLeft,
  Crown,
  LogOut
} from "lucide-react";
import {
  useListWaitlistEntries,
  useGetWaitlistCount,
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

export default function Admin() {
  const { token, verified, checking, login, logout } = useAdminAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [page, setPage] = useState(1);
  const limit = 10;

  // Reset page when search changes
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data: countData, isLoading: countLoading } = useGetWaitlistCount();

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
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-[#8B6914]/20 bg-[#0A0A0A]/80 backdrop-blur-md">
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
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to site</span>
            </Link>
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
              View, search, and export your early access signups.
            </p>
          </div>

          <Card className="bg-[#111111] border-[#8B6914]/30 shadow-[0_0_15px_rgba(139,105,20,0.1)] shrink-0 w-full md:w-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-6">
              <CardTitle className="text-sm font-medium text-white/70 uppercase tracking-wider">
                Total Signups
              </CardTitle>
              <Users className="h-4 w-4 text-[#C9A84C]" />
            </CardHeader>
            <CardContent className="px-6 pb-4">
              <div className="text-3xl font-serif font-bold text-white">
                {countLoading ? (
                  <Skeleton className="h-9 w-20 bg-white/10" />
                ) : (
                  countData?.count?.toLocaleString() || "0"
                )}
              </div>
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
                      <TableCell><Skeleton className="h-4 w-24 ml-auto bg-white/10" /></TableCell>
                    </TableRow>
                  ))
                ) : listData?.entries.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="h-32 text-center text-white/50">
                      No entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  listData?.entries.map((entry, idx) => (
                    <TableRow key={entry.id} className="border-[#8B6914]/10 hover:bg-white/[0.02] transition-colors group">
                      <TableCell className="text-center font-mono text-xs text-white/30 group-hover:text-[#C9A84C] transition-colors">
                        {(page - 1) * limit + idx + 1}
                      </TableCell>
                      <TableCell className="font-medium text-white/90">
                        {entry.name || <span className="text-white/30 italic">Not provided</span>}
                      </TableCell>
                      <TableCell className="text-white/70">
                        <a href={`mailto:${entry.email}`} className="hover:text-[#C9A84C] transition-colors">
                          {entry.email}
                        </a>
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
