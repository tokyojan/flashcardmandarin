import { useState } from "react";
import { authClient } from "../lib/auth-client";

type Mode = "signin" | "signup";

export function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signup") {
      await authClient.signUp.email(
        { email, password, name, username },
        {
          onSuccess: () => setLoading(false),
          onError: (ctx) => {
            setError(ctx.error.message || "Sign up failed");
            setLoading(false);
          },
        }
      );
    } else {
      const isEmail = identifier.includes("@");
      const onSuccess = () => setLoading(false);
      const onError = (ctx: { error: { message?: string } }) => {
        setError(ctx.error.message || "Sign in failed");
        setLoading(false);
      };
      if (isEmail) {
        await authClient.signIn.email(
          { email: identifier, password },
          { onSuccess, onError }
        );
      } else {
        await authClient.signIn.username(
          { username: identifier, password },
          { onSuccess, onError }
        );
      }
    }
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setError("");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">{"\u6C49"}</span>
          <h1>Mandarin Flashcards</h1>
          <p>Master Chinese characters with spaced repetition</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab${mode === "signin" ? " active" : ""}`}
            onClick={() => switchMode()}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`auth-tab${mode === "signup" ? " active" : ""}`}
            onClick={() => switchMode()}
            type="button"
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <label className="auth-field">
              <span>Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                autoComplete="name"
              />
            </label>
          )}

          {mode === "signup" ? (
            <>
              <label className="auth-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </label>
              <label className="auth-field">
                <span>Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                  required
                  autoComplete="username"
                />
              </label>
            </>
          ) : (
            <label className="auth-field">
              <span>Email or Username</span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or username"
                required
                autoComplete="username"
              />
            </label>
          )}

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Min 8 characters" : "Your password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Social login buttons — uncomment when OAuth credentials are configured in .env */}
      </div>
    </div>
  );
}
