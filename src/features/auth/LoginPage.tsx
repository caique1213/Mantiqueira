import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { StatePanel } from '../../components/ui/StatePanel';
import { normalizeError } from '../../lib/errors';
import { useAuth } from './AuthProvider';
import styles from './auth.module.css';

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (auth.session) return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await auth.signIn(email.trim(), password);
      toast.success('Acesso autorizado.');
    } catch (caught) {
      const error = normalizeError(caught);
      setMessage(
        /invalid login credentials/i.test(error.message)
          ? 'E-mail ou senha incorretos.'
          : error.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setMessage('Informe seu e-mail antes de solicitar a redefinição.');
      return;
    }
    try {
      await auth.requestPasswordReset(email.trim());
      toast.success('Se o e-mail estiver cadastrado, você receberá o link de redefinição.');
    } catch (caught) {
      setMessage(normalizeError(caught).message);
    }
  }

  if (!auth.configured) {
    return (
      <div className={styles.setupPage}>
        <StatePanel
          kind="configuration"
          title="Ambiente ainda não conectado"
          description="Copie .env.example para .env.local e informe a URL e a chave publicável do novo projeto Supabase. Nunca use service_role no frontend."
        />
      </div>
    );
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginVisual} aria-label="Apresentação do sistema">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <Wrench />
          </span>
          <span>
            <strong>Mantiqueira</strong>
            <small>Maintenance Hub</small>
          </span>
        </div>

        <div className={styles.visualCopy}>
          <span className={styles.eyebrow}>MANUTENÇÃO · ATIVOS · HISTÓRICO</span>
          <h1>
            Todo o galpão.
            <br />
            Em uma visão.
          </h1>
          <p>
            Localize ativos, acompanhe ordens de serviço e preserve cada instalação em um mapa
            técnico vivo da operação.
          </p>
        </div>

        <div className={styles.trustLine}>
          <ShieldCheck aria-hidden="true" />
          <span>Acesso autenticado e protegido por políticas do banco.</span>
        </div>
      </section>

      <section className={styles.loginPanel}>
        <div className={styles.loginBox}>
          <span className={styles.eyebrow}>ACESSO INTERNO</span>
          <h2>Entrar no sistema</h2>
          <p>Use o usuário criado ou convidado pelo administrador.</p>

          <form className={styles.loginForm} onSubmit={(event) => void handleSubmit(event)}>
            <div className={styles.fieldWithIcon}>
              <Mail aria-hidden="true" />
              <TextField
                label="E-mail"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className={styles.passwordField}>
              <div className={styles.fieldWithIcon}>
                <LockKeyhole aria-hidden="true" />
                <TextField
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>

            {message && (
              <p className={styles.formMessage} role="alert">
                {message}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={submitting}
              trailingIcon={<ArrowRight />}
            >
              Entrar
            </Button>
            <button
              type="button"
              className={styles.forgotButton}
              onClick={() => void handleForgotPassword()}
            >
              Esqueci minha senha
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
