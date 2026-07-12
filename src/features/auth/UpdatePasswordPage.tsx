import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { normalizeError } from '../../lib/errors';
import { useAuth } from './AuthProvider';
import styles from './auth.module.css';

export function UpdatePasswordPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 10) {
      setMessage('Use pelo menos 10 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setMessage('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    try {
      await auth.updatePassword(password);
      toast.success('Senha atualizada.');
      void navigate('/');
    } catch (caught) {
      setMessage(normalizeError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.simpleAuthPage}>
      <form className={styles.updateBox} onSubmit={(event) => void submit(event)}>
        <span className={styles.updateIcon}>
          <KeyRound />
        </span>
        <h1>Definir nova senha</h1>
        <p>Escolha uma senha exclusiva e não compartilhe no chat ou no código.</p>
        <TextField
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <TextField
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
        {message && (
          <p className={styles.formMessage} role="alert">
            {message}
          </p>
        )}
        <Button type="submit" fullWidth loading={busy}>
          Salvar nova senha
        </Button>
      </form>
    </main>
  );
}
