import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../shared/Input';
import { Button } from '../shared/Button';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';

export const RegisterPage = ({ onSwitchToLogin }) => {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingUsernames, setExistingUsernames] = useState([]);

  // Load existing usernames on mount
  useEffect(() => {
    const loadUsernames = async () => {
      try {
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const usernames = [];
        usersSnapshot.forEach((doc) => {
          const name = doc.data().displayName;
          if (name) usernames.push(name.toLowerCase());
        });
        setExistingUsernames(usernames);
      } catch (err) {
        console.error('Error loading usernames:', err);
      }
    };
    loadUsernames();
  }, []);

  // Validate username in real-time
  useEffect(() => {
    const username = formData.displayName;
    if (username) {
      // Check length
      if (username.length < 3) {
        setUsernameError('Username must be at least 3 characters');
        return;
      }

      // Check allowed characters (alphanumeric, hyphen, underscore, no spaces)
      if (!/^[a-zA-Z0-9-_]+$/.test(username)) {
        setUsernameError('Only letters, numbers, hyphens (-) and underscores (_) allowed');
        return;
      }

      // Check if taken
      const usernameLower = username.toLowerCase();
      if (existingUsernames.includes(usernameLower)) {
        setUsernameError('This username is already taken');
      } else {
        setUsernameError('');
      }
    } else {
      setUsernameError('');
    }
  }, [formData.displayName, existingUsernames]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (usernameError) {
      setError(usernameError);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await register(formData.email, formData.password, formData.displayName);
    } catch (err) {
      setError(err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="w-full max-w-md bg-dark-sidebar rounded-lg shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-dark-text mb-2">Create Account</h1>
          <p className="text-dark-muted">Join Lumo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              label="Display Name"
              type="text"
              placeholder="Enter your display name"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              required
            />
            {usernameError && (
              <p className="text-xs text-admin mt-1">{usernameError}</p>
            )}
            {formData.displayName && !usernameError && (
              <p className="text-xs text-green-500 mt-1">✓ Username available</p>
            )}
          </div>

          <Input
            label="Email"
            type="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />

          <Input
            label="Confirm Password"
            type="password"
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            required
          />

          {error && (
            <div className="bg-admin/10 border border-admin/30 text-admin px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading || !!usernameError}
          >
            {loading ? 'Creating account...' : 'Register'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <div className="text-dark-muted text-sm">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-brand-primary hover:underline"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
