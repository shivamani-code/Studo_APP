import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValue, AnimatePresence } from 'framer-motion';
import { Zap, ArrowRight, Star, Layers, Cpu, Globe, Play, Loader2, Sparkles, AlertCircle, X, ShieldCheck, Mail, User, MessageSquare, Send } from 'lucide-react';
import { DataService } from '../services/dataService';
import { submitContactMessage } from '../services/contactService';
import { supabase } from '../services/supabaseClient';

const AuthOverlay: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorText, setErrorText] = useState<string | null>(null);
  
  if (!isOpen) return null;

  const submit = async () => {
    setStatus('loading');
    setErrorText(null);

    try {
      if (!email.trim() || !password) {
        setStatus('error');
        setErrorText('Email and passkey are required.');
        return;
      }

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          setStatus('error');
          setErrorText(error.message);
          return;
        }
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) {
          setStatus('error');
          setErrorText(error.message);
          return;
        }
      }

      setStatus('idle');
      onClose();
    } catch (e: any) {
      setStatus('error');
      setErrorText(e?.message || 'Authentication failed');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="glass-luxury w-full max-w-md p-10 rounded-[2.5rem] relative"
      >
        <button onClick={onClose} className="absolute top-8 right-8 text-[#666] hover:text-[#d4af37] transition-colors">
          <X size={20} />
        </button>
        
        <div className="text-center mb-10">
          <div className="inline-flex p-3 bg-[#d4af37]/10 rounded-2xl mb-6">
            <ShieldCheck className="text-[#d4af37]" size={24} />
          </div>
          <h2 className="serif-luxury text-3xl text-white mb-2">{mode === 'login' ? 'IDENTITY ACCESS' : 'CREATE CORE'}</h2>
          <p className="text-[10px] text-[#666] font-black uppercase tracking-[0.4em] mono">Studo Intelligence Network</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[8px] font-black text-[#d4af37] uppercase tracking-widest mono">Node ID / Email</label>
            <input 
              type="text" 
              placeholder="aman@studo.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/10 px-6 py-4 rounded-2xl text-white mono text-xs outline-none focus:border-[#d4af37]/50 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[8px] font-black text-[#d4af37] uppercase tracking-widest mono">Passkey</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/10 px-6 py-4 rounded-2xl text-white mono text-xs outline-none focus:border-[#d4af37]/50 transition-all"
            />
          </div>

          {errorText && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest mono">
              {errorText}
            </div>
          )}

          <button 
            onClick={submit}
            disabled={status === 'loading'}
            className="w-full py-5 bg-[#d4af37] text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? 'PROCESSING' : (mode === 'login' ? 'ESTABLISH LINK' : 'INITIALIZE NODE')}
          </button>

          <div className="text-center pt-4">
            <button 
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-[9px] font-black text-[#666] hover:text-[#d4af37] uppercase tracking-widest mono"
            >
              {mode === 'login' ? "Don't have a node? Create one" : "Already registered? Sign in"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Preloader: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState('INITIALIZING');
  
  const statuses = ['INITIALIZING', 'CALIBRATING', 'ARCHITECTING', 'LAUNCHING'];

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 800);
          return 100;
        }
        return prev + Math.floor(Math.random() * 8) + 1;
      });
    }, 40);
    const statusTimer = setInterval(() => {
        setStatus(statuses[Math.floor(Math.random() * statuses.length)]);
    }, 400);
    return () => { clearInterval(timer); clearInterval(statusTimer); };
  }, []);

  return (
    <motion.div exit={{ y: '-100%' }} transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }} className="fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center">
      <div className="relative text-center">
        <motion.p key={status} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[#d4af37] text-[10px] font-black uppercase tracking-[0.5em] mb-4 mono">{status}</motion.p>
        <h1 className="loader-percentage text-white italic">{Math.min(count, 100)}%</h1>
        <div className="mt-8 w-64 h-[1px] bg-white/5 relative mx-auto">
            <motion.div initial={{ width: 0 }} animate={{ width: `${count}%` }} className="absolute inset-y-0 left-0 bg-[#d4af37] shadow-[0_0_15px_#d4af37]" />
        </div>
      </div>
    </motion.div>
  );
};

const MagneticButton: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({ children, onClick, className }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 15, stiffness: 150 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const { clientX, clientY, currentTarget } = e;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    mouseX.set((clientX - centerX) * 0.35);
    mouseY.set((clientY - centerY) * 0.35);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.button style={{ x, y }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={onClick} className={className}>
      {children}
    </motion.button>
  );
};

const LandingPage: React.FC = () => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [introReady, setIntroReady] = useState<boolean>(() => (window as any).__studoSplashDone === true);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const loadingMessages = [
    "Initializing quantum processors...",
    "Calibrating neural networks...",
    "Establishing secure connections...",
    "Optimizing performance metrics...",
    "Finalizing system integration..."
  ];

  useEffect(() => {
    if ((window as any).__studoSplashDone === true) {
      setIntroReady(true);
      return;
    }
    const onSplashDone = () => setIntroReady(true);
    window.addEventListener('studo_splash_done', onSplashDone);
    return () => window.removeEventListener('studo_splash_done', onSplashDone);
  }, []);

  const generateCinematicBackground = async () => {
    setIsGenerating(true);
    setErrorStatus(null);
    setLoadingStep(0);
    
    const loadingInterval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % loadingMessages.length);
    }, 800);
    
    try {
      // Simulate background generation
      await new Promise(resolve => setTimeout(resolve, 4000));
      setVideoUrl("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
    } catch (error) {
      setErrorStatus("Failed to generate cinematic background. Please try again.");
    } finally {
      clearInterval(loadingInterval);
      setIsGenerating(false);
    }
  };

  const { scrollYProgress } = useScroll({ target: mediaRef, offset: ["start end", "end start"] });
  const mediaScale = useTransform(scrollYProgress, [0, 0.4], [0.85, 1]);
  const mediaY = useTransform(scrollYProgress, [0, 1], [-50, 50]);
  const springMediaScale = useSpring(mediaScale, { stiffness: 60, damping: 20 });

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await submitContactMessage({
        name: contactForm.name,
        email: contactForm.email,
        description: contactForm.description
      });

      if (res.ok === false) {
        throw new Error(res.error);
      }

      console.log('Contact form submitted:', contactForm);
      alert('Thank you for your message! We will get back to you soon.');

      setContactForm({ name: '', email: '', description: '' });
    } catch (error) {
      try {
        DataService.saveContactSubmission({
          name: contactForm.name,
          email: contactForm.email,
          description: contactForm.description
        });
      } catch {
      }
      console.error('Failed to submit contact form:', error);
      alert('Failed to submit your message right now. Your message was saved locally. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToContact = (e: React.MouseEvent) => {
    e.preventDefault();
    const contactElement = document.getElementById('contact');
    if (contactElement) {
      contactElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <AnimatePresence>
        <AuthOverlay isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      </AnimatePresence>

      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <AnimatePresence>
            {videoUrl ? (
                <motion.video initial={{ opacity: 0 }} animate={{ opacity: 0.35 }} autoPlay loop muted playsInline className="w-full h-full object-cover scale-110" src={videoUrl} />
            ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.08),transparent_70%)]" />
            )}
        </AnimatePresence>
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] opacity-10">
            <svg viewBox="0 0 100 100" className="w-full h-full animate-[spin_60s_linear_infinite]">
                <circle cx="50" cy="50" r="48" fill="none" stroke="#d4af37" strokeWidth="0.1" />
                <circle cx="50" cy="50" r="30" fill="none" stroke="#d4af37" strokeWidth="0.05" />
                <path d="M50 2 L50 98 M2 50 L98 50" stroke="#d4af37" strokeWidth="0.02" />
            </svg>
        </div>
      </div>

      <nav className="fixed top-0 w-full z-50 px-4 sm:px-6 md:px-10 py-4 sm:py-6 md:py-8 flex justify-between items-center backdrop-blur-md border-b border-white/[0.03]">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center space-x-3">
          <div className="bg-[#d4af37] p-1.5 rounded shadow-[0_0_20px_rgba(212,175,55,0.4)]">
            <Zap className="text-black w-4 h-4" />
          </div>
          <span className="text-xl font-black uppercase tracking-tighter text-white">Studo</span>
        </motion.div>
        
        <div className="flex items-center gap-3 sm:gap-6">
            <div className="hidden md:flex items-center space-x-10 text-[10px] font-black uppercase tracking-[0.3em] text-[#666] mono">
                <button onClick={scrollToContact} className="hover:text-[#d4af37] transition-colors">Contact</button>
            </div>
            <button onClick={() => setIsAuthOpen(true)} className="text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors">Sign In</button>
            <MagneticButton onClick={() => setIsAuthOpen(true)} className="px-4 sm:px-10 py-3 bg-[#d4af37] text-black rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl hover:bg-white hover:scale-105 transition-all">
                Access System
            </MagneticButton>
        </div>
      </nav>

      <section className="relative min-h-screen flex flex-col items-center justify-center text-center z-10 px-8">
        <AnimatePresence mode="wait">
        {introReady && (
        <motion.div key="intro" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#d4af37] mb-12 block mono">Engineering Success Through Intelligence</span>
            
            <h1 className="serif-luxury text-[14vw] md:text-[11vw] font-normal leading-[0.85] tracking-tighter mb-16 text-white">
                <motion.span initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.7 }} className="block">STUDO</motion.span>
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2, delay: 1.2 }} className="block text-gold italic text-[10vw] md:text-[8vw] -mt-4">Academic Luxury</motion.span>
            </h1>

            <p className="max-w-xl mx-auto text-[#666] text-sm md:text-base font-medium mono leading-relaxed mb-16 uppercase tracking-wider">The space between strategy and academic art. A digital ecosystem for the modern scholar.</p>

            <div className="flex flex-col md:flex-row items-center justify-center gap-12">
                <MagneticButton onClick={() => setIsAuthOpen(true)} className="group px-14 py-6 bg-white text-black rounded-full text-xs font-black uppercase tracking-[0.2em] flex items-center gap-4 hover:bg-[#d4af37] transition-all">
                    Enter Dashboard <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </MagneticButton>
            </div>
        </motion.div>
        )}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="absolute bottom-12 flex flex-col items-center gap-4">
            <span className="text-[8px] font-black uppercase tracking-[0.5em] text-[#333] mono">Scroll to Explore</span>
            <div className="w-[1px] h-12 bg-gradient-to-b from-[#d4af37] to-transparent" />
        </motion.div>
      </section>

      <section ref={mediaRef} className="py-40 px-10">
        <motion.div style={{ scale: springMediaScale, y: mediaY }} className="relative w-full max-w-7xl mx-auto aspect-video rounded-[3rem] bg-[#0a0a0a] border border-white/[0.03] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
            {isGenerating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] p-12">
                    <Loader2 className="w-16 h-16 text-[#d4af37] animate-spin mb-8 opacity-20" />
                    <AnimatePresence mode="wait">
                        <motion.p key={loadingStep} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="text-[10px] font-black uppercase tracking-[0.5em] text-[#d4af37] mono text-center">{loadingMessages[loadingStep]}</motion.p>
                    </AnimatePresence>
                </div>
            ) : errorStatus ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 bg-black">
                    <AlertCircle className="text-rose-500 mb-6" size={48} />
                    <h3 className="text-white uppercase font-black tracking-tighter text-3xl mb-4">Core Integrity Error</h3>
                    <p className="text-[#666] mono text-xs mb-10 max-w-sm text-center">{errorStatus}</p>
                    <button onClick={generateCinematicBackground} className="px-8 py-3 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10">Retry Sync</button>
                </div>
            ) : (
                <>
                    <img src="https://picsum.photos/seed/luxury-studo/1600/900?grayscale" className="w-full h-full object-cover opacity-40 mix-blend-luminosity" alt="Studo Luxury Interior" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <h2 className="serif-luxury text-6xl text-white mb-6">The Archive</h2>
                            <button className="px-10 py-3 bg-white/5 border border-white/10 backdrop-blur-xl rounded-full text-[9px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-black transition-all">View Collection</button>
                        </div>
                    </div>
                </>
            )}
        </motion.div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-40 px-10 bg-gradient-to-b from-transparent to-black/50">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="w-full max-w-4xl mx-auto"
        >
          <div className="text-center mb-20">
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#d4af37] mb-8 block mono">Get In Touch</span>
            <h2 className="serif-luxury text-6xl md:text-7xl text-white mb-8">Connect With Studo</h2>
            <p className="text-[#666] text-sm md:text-base font-medium mono leading-relaxed max-w-2xl mx-auto uppercase tracking-wider">Transform your academic journey with intelligent design and strategic excellence.</p>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="glass-luxury p-12 rounded-[3rem]"
          >
            <form onSubmit={handleContactSubmit} className="space-y-8">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666] mb-4 block mono">Name</label>
                <div className="relative">
                  <User className="absolute left-6 top-1/2 -translate-y-1/2 text-[#666]" size={20} />
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full pl-16 pr-6 py-5 bg-white/5 border border-white/10 rounded-full text-white placeholder-[#666] focus:outline-none focus:border-[#d4af37] transition-all"
                    placeholder="Enter your name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666] mb-4 block mono">Email</label>
                <div className="relative">
                  <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-[#666]" size={20} />
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full pl-16 pr-6 py-5 bg-white/5 border border-white/10 rounded-full text-white placeholder-[#666] focus:outline-none focus:border-[#d4af37] transition-all"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666] mb-4 block mono">Description</label>
                <div className="relative">
                  <MessageSquare className="absolute left-6 top-6 text-[#666]" size={20} />
                  <textarea
                    value={contactForm.description}
                    onChange={(e) => setContactForm({ ...contactForm, description: e.target.value })}
                    className="w-full pl-16 pr-6 py-5 bg-white/5 border border-white/10 rounded-3xl text-white placeholder-[#666] focus:outline-none focus:border-[#d4af37] transition-all resize-none h-32"
                    placeholder="Tell us about your needs..."
                    required
                  />
                </div>
              </div>

              <MagneticButton
                type="submit"
                disabled={isSubmitting}
                className="group w-full px-14 py-6 bg-[#d4af37] text-black rounded-full text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Sending...
                  </>
                ) : (
                  <>
                    Submit Message
                    <Send size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </MagneticButton>
            </form>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/[0.03] bg-black/50 backdrop-blur-xl">
        <div className="px-10 py-20">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-[#d4af37] p-1.5 rounded shadow-[0_0_20px_rgba(212,175,55,0.4)]">
                  <Zap className="text-black w-4 h-4" />
                </div>
                <span className="text-xl font-black uppercase tracking-tighter text-white">Studo</span>
              </div>
              <p className="text-[#666] text-sm font-medium mono leading-relaxed max-w-md uppercase tracking-wider mb-8">Engineering Success Through Intelligence. A digital ecosystem for the modern scholar.</p>
              <div className="flex space-x-6">
                <a href="#" className="text-[#666] hover:text-[#d4af37] transition-colors">
                  <Globe size={20} />
                </a>
                <a href="#" className="text-[#666] hover:text-[#d4af37] transition-colors">
                  <Mail size={20} />
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white mb-6 mono">Navigation</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-[#666] hover:text-[#d4af37] transition-colors text-sm mono">Home</a></li>
                <li><button onClick={scrollToContact} className="text-[#666] hover:text-[#d4af37] transition-colors text-sm mono text-left">Contact</button></li>
                <li><a href="#" className="text-[#666] hover:text-[#d4af37] transition-colors text-sm mono">Dashboard</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white mb-6 mono">Legal</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-[#666] hover:text-[#d4af37] transition-colors text-sm mono">Privacy Policy</a></li>
                <li><a href="#" className="text-[#666] hover:text-[#d4af37] transition-colors text-sm mono">Terms of Service</a></li>
                <li><a href="#" className="text-[#666] hover:text-[#d4af37] transition-colors text-sm mono">Cookie Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-20 pt-10 border-t border-white/[0.03]">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-[#666] text-xs font-medium mono uppercase tracking-wider mb-4 md:mb-0">© 2024 Studo. All rights reserved.</p>
              <p className="text-[#666] text-xs font-medium mono uppercase tracking-wider">Crafted with precision and excellence.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
