import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { db } from '../../services/firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';

export const UsernameSetupScreen = () => {
    const { currentUser, userProfile, logout } = useAuth();
    const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [checkingName, setCheckingName] = useState(false);
    const [isUnique, setIsUnique] = useState(false);

    // Debounce username check
    useEffect(() => {
        const checkUsername = async () => {
            if (!displayName || displayName.length < 3) {
                setIsUnique(false);
                setError('');
                return;
            }

            if (!/^[a-zA-Z0-9-_]+$/.test(displayName)) {
               setError('Only letters, numbers, hyphens (-) and underscores (_) allowed');
               setIsUnique(false);
               return;
            }

            setCheckingName(true);
            setError('');

            try {
                // Check uniqueness (case-insensitive simulation via client-side check of fetched candidates or direct query)
                // For simplicity/consistency with other parts:
                const usersRef = collection(db, 'users');
                const usersSnapshot = await getDocs(usersRef);
                let taken = false;
                const targetName = displayName.toLowerCase();

                usersSnapshot.forEach((doc) => {
                    if (doc.id === currentUser.uid) return;
                    const name = doc.data().displayName;
                    if (name && name.toLowerCase() === targetName) {
                        taken = true;
                    }
                });

                if (taken) {
                    setError('This username is already taken');
                    setIsUnique(false);
                } else {
                    setIsUnique(true);
                }
            } catch (err) {
                console.error(err);
                setError('Error checking username availability');
            } finally {
                setCheckingName(false);
            }
        };

        const timer = setTimeout(checkUsername, 500);
        return () => clearTimeout(timer);
    }, [displayName, currentUser]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isUnique || error || loading) return;

        setLoading(true);
        try {
            // Update Auth Profile
            await updateProfile(currentUser, {
                displayName: displayName
            });

            // Update Firestore
            await updateDoc(doc(db, 'users', currentUser.uid), {
                displayName: displayName,
                isUsernameSet: true
            });
            
            // Force reload to reflect changes in app (AuthContext should pick it up via onSnapshot)
            // But we might need to trigger a re-render or just let the real-time listener handle it.
        } catch (err) {
            console.error(err);
            setError('Failed to save username');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
            <div className="w-full max-w-md bg-dark-sidebar rounded-lg shadow-2xl p-8 space-y-6">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-dark-text">Choose Your Username</h1>
                    <p className="text-dark-muted mt-2">
                        Welcome to Lumo! Please choose a unique username found across the platform.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Input
                            label="Username"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g. awesome_user"
                            className={error ? '!border-red-500' : isUnique ? '!border-green-500' : ''}
                        />
                        {checkingName && <p className="text-xs text-yellow-500 mt-1">Checking availability...</p>}
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                        {!error && isUnique && !checkingName && <p className="text-xs text-green-500 mt-1">Username available!</p>}
                    </div>

                    <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={loading || !isUnique || !!error || checkingName}
                    >
                        {loading ? 'Setting up...' : 'Start Using Lumo'}
                    </Button>
                </form>
                
                <div className="text-center">
                    <button onClick={logout} className="text-sm text-dark-muted hover:text-white transition-colors">
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
};
