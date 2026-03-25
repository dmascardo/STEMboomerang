import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import stemLogo from '../../assets/b3d32faed1940d68631ddd16b33aceaa647d5928.png';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/auth-context';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(username.trim(), password);
      toast.success('Login successful');
      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(27,125,135,0.18),_transparent_42%),linear-gradient(135deg,#f6fbfc_0%,#fff8f4_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden rounded-3xl border border-white/70 bg-white/65 p-10 shadow-[0_24px_80px_rgba(27,125,135,0.12)] backdrop-blur lg:block">
            <img
              src={stemLogo}
              alt="STEM Boomerang New Mexico"
              className="h-12 w-auto"
            />
            <div className="mt-10 space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1B7D87]">
                Candidate Intake Portal
              </p>
              <h1 className="max-w-md text-4xl font-semibold leading-tight text-slate-900">
                Sign in to review and process STEM Boomerang resumes.
              </h1>
              <p className="max-w-lg text-base leading-7 text-slate-600">
                Access the candidate intake portal with your assigned credentials.
              </p>
            </div>
          </section>

          <Card className="border-white/80 bg-white/90 shadow-[0_28px_70px_rgba(15,23,42,0.14)] backdrop-blur">
            <CardHeader className="space-y-3">
              <img
                src={stemLogo}
                alt="STEM Boomerang New Mexico"
                className="h-10 w-auto lg:hidden"
              />
              <CardTitle>Login</CardTitle>
              <CardDescription>Enter your username and password to continue.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Username"
                    autoComplete="username"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                  />
                </div>

                {error ? (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}

                <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
