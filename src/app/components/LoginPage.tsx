import image_e51b9bfbb12add0500f305c394b7a96ec1a4e537 from "../../assets/e51b9bfbb12add0500f305c394b7a96ec1a4e537.png";
import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { LogoIcon } from "./ui/LogoIcon";

import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";
  const { login } = useAuth();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4 sm:p-8">
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="card-gradient backdrop-blur-xl rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col md:flex-row overflow-hidden border border-white/10 relative group"
      >
        {/* Spotlight Effect Layer */}
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300 ease-in-out"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(800px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(124, 58, 237, 0.12), transparent 40%)`,
          }}
        />

        {/* Content Layer */}
        <div className="relative z-10 w-full flex flex-col md:flex-row">
          {/* Left Side - Graphic */}
          <div className="hidden md:flex md:w-1/2 bg-black/20 p-8 flex-col justify-center relative items-center border-r border-white/5">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-blue-500/10 to-transparent blur-2xl"></div>
            <div className="relative z-10 w-full max-w-xs">
              <img
                src={image_e51b9bfbb12add0500f305c394b7a96ec1a4e537}
                className="w-full h-auto object-contain drop-shadow-2xl transition-transform duration-500 hover:scale-105"
                alt="NerveSenseAI Illustration"
              />
            </div>
            <div className="relative z-10 mt-10 text-center">
              <h3 className="text-2xl font-bold text-white mb-3">Hire Smarter</h3>
              <p className="text-white/60 text-sm leading-relaxed max-w-xs mx-auto">
                AI-powered real-time multimodal analysis delivering objective interview insights.
              </p>
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="w-full md:w-1/2 p-8 sm:p-10 lg:p-12 relative">
            {/* Logo */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <LogoIcon className="w-8 h-8" />
              <span style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                <span className="text-primary">NerveSense</span>
                <span className="text-foreground">AI</span>
              </span>
            </div>

            <form onSubmit={handleLogin}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }} className="text-foreground mb-1">
                Welcome Back
              </h2>
              <p className="text-muted-foreground mb-8" style={{ fontSize: "0.9rem" }}>
                Sign in to your NerveSenseAI account
              </p>

              {error && (
                <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              {/* Email */}
              <label className="block mb-1.5 text-foreground" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Email Address
              </label>
              <div className="relative mb-5">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-medium"
                  style={{ fontSize: "0.95rem" }}
                />
              </div>

              {/* Password */}
              <label className="block mb-1.5 text-foreground" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Password
              </label>
              <div className="relative mb-5">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-medium"
                  style={{ fontSize: "0.95rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>

              {/* Remember me / Forgot */}
              <div className="flex items-center justify-between mb-8">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 accent-primary cursor-pointer"
                  />
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors text-sm font-medium">Remember me</span>
                </label>
                <button type="button" className="text-primary hover:text-blue-400 hover:underline transition-colors text-sm font-semibold">
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-blue-500 text-primary-foreground rounded-xl py-3.5 shadow-lg shadow-primary/20 hover:opacity-90 hover:shadow-primary/40 transition-all disabled:opacity-60 font-semibold"
                style={{ fontSize: "1rem" }}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Sign Up link */}
              <p className="text-center mt-6 text-muted-foreground text-sm font-medium">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/signup")}
                  className="text-primary hover:text-blue-400 hover:underline transition-colors font-semibold ml-1"
                >
                  Sign Up
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
