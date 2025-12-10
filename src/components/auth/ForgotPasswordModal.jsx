import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';
import { Input } from '../shared/Input';
import { Button } from '../shared/Button';
import { MdClose } from 'react-icons/md';

export const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { success, error } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
      success('Password reset email sent! Check your inbox.');
      setTimeout(() => {
        onClose();
        setSent(false);
        setEmail('');
      }, 3000);
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        error('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        error('Invalid email address.');
      } else {
        error('Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-sidebar rounded-lg shadow-2xl w-full max-w-md p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-dark-muted hover:text-dark-text transition-colors"
        >
          <MdClose size={24} />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-dark-text mb-2">Reset Password</h2>
          <p className="text-dark-muted text-sm">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {/* Form */}
        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                disabled={loading || !email}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-md text-sm text-center">
            ✓ Reset email sent successfully! Check your inbox.
          </div>
        )}
      </div>
    </div>
  );
};
