import { useState } from "react";
import { Crown, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AdminLoginProps {
  onLogin: (token: string) => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Incorrect password. Try again.");
        setPassword("");
        return;
      }
      const { token } = await res.json();
      localStorage.setItem("admin_token", token);
      onLogin(token);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#8B6914]/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(139,105,20,0.15)]">
            <Lock className="w-7 h-7 text-[#C9A84C]" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-[#C9A84C]" />
            <span className="font-serif text-xl font-bold text-white tracking-wide">Finders</span>
          </div>
          <p className="text-white/40 text-sm">Admin access required</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#111111] border-[#8B6914]/30 text-white placeholder:text-white/30 focus-visible:ring-[#8B6914]/50 focus-visible:border-[#8B6914] h-12 text-center tracking-widest"
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-sm text-center mt-2">{error}</p>
            )}
          </div>
          <Button
            type="submit"
            disabled={loading || !password}
            className="w-full h-12 bg-[#8B6914] hover:bg-[#C9A84C] text-black font-bold transition-colors"
          >
            {loading ? "Verifying..." : "Access Dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
}
