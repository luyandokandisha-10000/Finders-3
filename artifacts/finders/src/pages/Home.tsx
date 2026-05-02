import { useState } from "react";
import { motion } from "framer-motion";
import { useJoinWaitlist, useGetWaitlistCount, getGetWaitlistCountQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BriefcaseIcon, DollarSign, Users, ChevronRight, CheckCircle2 } from "lucide-react";
import logo from "@assets/IMG_20260428_115702~2_1777703108675.jpg";

export default function Home() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);

  const { data: waitlistData } = useGetWaitlistCount({
    query: { queryKey: getGetWaitlistCountQueryKey() }
  });

  const joinWaitlist = useJoinWaitlist();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    joinWaitlist.mutate(
      { data: { email, name } },
      {
        onSuccess: () => {
          setHasJoined(true);
          toast({
            title: "You're on the list",
            description: "We'll notify you when we launch.",
          });
        },
        onError: () => {
          toast({
            title: "Something went wrong",
            description: "Please try again later.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const staggerChildren = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground selection:bg-primary selection:text-primary-foreground font-sans overflow-x-hidden">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/30">
              <img src={logo} alt="Finders Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-serif text-xl font-bold tracking-wide text-white">FINDERS</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-primary transition-colors">How It Works</a>
            <a href="#faq" className="hover:text-primary transition-colors">FAQ</a>
          </div>

          <Button 
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6 font-semibold"
            onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
          >
            Join Waitlist
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden flex items-center min-h-[90vh]">
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="container mx-auto px-6 relative z-10">
          <motion.div 
            className="max-w-3xl mx-auto text-center"
            initial="hidden"
            animate="show"
            variants={staggerChildren}
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Exclusive Access
            </motion.div>
            
            <motion.h1 variants={fadeUp} className="font-serif text-5xl md:text-7xl font-bold leading-tight mb-6 text-white">
              The Premium Marketplace for <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C9A84C] to-[#F0D080]">Top Tier Talent</span>
            </motion.h1>
            
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
              Land high-paying gigs, sell your digital products, and connect with elite clients. Finders is where the ambitious get paid.
            </motion.p>
            
            <motion.div variants={fadeUp} id="waitlist" className="bg-card/50 backdrop-blur-sm border border-white/5 p-2 rounded-2xl max-w-md mx-auto shadow-2xl">
              {!hasJoined ? (
                <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-2">
                  <Input 
                    type="text" 
                    placeholder="Your Name" 
                    className="bg-transparent border-none text-white placeholder:text-muted-foreground focus-visible:ring-0 h-12"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <div className="hidden sm:block w-px bg-white/10 my-2" />
                  <Input 
                    type="email" 
                    placeholder="Email Address" 
                    className="bg-transparent border-none text-white placeholder:text-muted-foreground focus-visible:ring-0 h-12"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Button 
                    type="submit" 
                    disabled={joinWaitlist.isPending}
                    className="h-12 px-8 rounded-xl bg-gradient-to-r from-primary to-[#F0D080] text-black font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    {joinWaitlist.isPending ? "Joining..." : "Get Access"}
                  </Button>
                </form>
              ) : (
                <div className="flex items-center justify-center gap-3 h-12 text-primary font-medium">
                  <CheckCircle2 className="w-5 h-5" />
                  You're on the exclusive waitlist.
                </div>
              )}
            </motion.div>
            
            {waitlistData && (
              <motion.p variants={fadeUp} className="mt-6 text-sm text-muted-foreground">
                Join <span className="text-white font-semibold">{waitlistData.count.toLocaleString()}</span> professionals already waiting.
              </motion.p>
            )}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-[#050505]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-5xl font-bold text-white mb-4">Everything You Need to Scale</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">One platform to monetize your skills, network, and creations.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: BriefcaseIcon,
                title: "Find Premium Gigs",
                description: "Access a curated feed of high-paying jobs from verified clients looking for your exact skills."
              },
              {
                icon: DollarSign,
                title: "Sell Your Projects",
                description: "List your apps, templates, artwork, and digital products to a hungry audience of buyers."
              },
              {
                icon: Users,
                title: "Connect with Clients",
                description: "Build your reputation, chat directly with clients, and manage your freelance business."
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-card border border-white/5 p-8 rounded-2xl hover:border-primary/30 transition-colors group"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 relative">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mb-16">
            <h2 className="font-serif text-3xl md:text-5xl font-bold text-white mb-6">How Finders Works</h2>
            <p className="text-xl text-muted-foreground">Three simple steps to unlock your next big opportunity.</p>
          </div>

          <div className="space-y-12">
            {[
              { step: "01", title: "Create Your Profile", desc: "Showcase your portfolio, list your skills, and set your rates. Your profile is your digital storefront." },
              { step: "02", title: "Discover Opportunities", desc: "Browse hand-picked gigs or list your digital products on the marketplace. The algorithm matches you with the best fit." },
              { step: "03", title: "Deliver & Get Paid", desc: "Complete the work, transfer the assets, and receive secure payments directly to your bank account." }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex gap-6 md:gap-10 items-start"
              >
                <div className="text-4xl md:text-6xl font-serif font-bold text-white/10 shrink-0">{item.step}</div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-lg max-w-2xl">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Hype */}
      <section className="py-24 bg-primary text-black">
        <div className="container mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h2 className="font-serif text-4xl md:text-6xl font-bold mb-6">Be Among The First.</h2>
            <p className="text-xl font-medium mb-10 opacity-80">
              We are opening doors to a select group of creators and freelancers. Spots are limited to maintain the quality of the network.
            </p>
            <Button 
              size="lg" 
              className="bg-black text-white hover:bg-black/90 rounded-full h-14 px-10 text-lg font-bold shadow-xl"
              onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
            >
              Secure Your Spot <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 bg-[#050505]">
        <div className="container mx-auto px-6 max-w-3xl">
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-white mb-12 text-center">Questions?</h2>
          
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-white/10">
              <AccordionTrigger className="text-lg font-medium text-white hover:text-primary">What makes Finders different?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                Finders is strictly curated. We don't allow low-quality gigs or race-to-the-bottom pricing. It's a premium environment designed for serious professionals who want to work with serious clients.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border-white/10">
              <AccordionTrigger className="text-lg font-medium text-white hover:text-primary">What can I sell on the platform?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                You can sell full apps, source code, UI/UX kits, notion templates, artwork, 3D models, and any other high-quality digital product.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="border-white/10">
              <AccordionTrigger className="text-lg font-medium text-white hover:text-primary">How do payments work?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                Payments are securely processed through Stripe. For gigs, funds are held in escrow until milestones are met. For products, payouts are instant.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4" className="border-white/10">
              <AccordionTrigger className="text-lg font-medium text-white hover:text-primary">When are you launching?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                We are currently in closed beta. By joining the waitlist, you'll be notified as soon as we open the next wave of invites.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 bg-background">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/30">
              <img src={logo} alt="Finders Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-serif text-lg font-bold text-white">FINDERS</span>
          </div>
          
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Finders. All rights reserved.
          </div>
          
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">Instagram</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
