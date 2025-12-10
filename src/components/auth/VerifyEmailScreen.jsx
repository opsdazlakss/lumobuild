import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../shared/Button';

export const VerifyEmailScreen = () => {
    const { currentUser, logout, resendVerification } = useAuth();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleResend = async () => {
        setLoading(true);
        try {
            await resendVerification();
            setMessage('Verification email sent! Check your inbox.');
        } catch (err) {
            setMessage('Error sending email: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReload = async () => {
        setLoading(true);
        try {
            await currentUser.reload();
            if (currentUser.emailVerified) {
                window.location.reload(); // Refresh app state
            } else {
                setMessage('Email is not verified yet. Please check your inbox.');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
            <div className="w-full max-w-md bg-dark-sidebar rounded-lg shadow-2xl p-8 text-center space-y-6">
                <div className="bg-brand-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-3xl">
                    📧
                </div>
                <h1 className="text-2xl font-bold text-dark-text">Verify Your Email</h1>
                <p className="text-dark-muted">
                    We've sent a verification email to <br/>
                    <span className="font-semibold text-white">{currentUser?.email}</span>
                </p>
                <div className="bg-yellow-500/10 text-yellow-500 p-3 rounded-md text-sm">
                    ⚠️ Please check your <b>Spam/Junk</b> folder if you don't see the email in your inbox.
                </div>
                <p className="text-sm text-dark-muted">
                    You must verify your email address to access Lumo. To prevent spam, unverified accounts are restricted.
                </p>

                {message && (
                    <div className="p-3 bg-brand-primary/20 text-brand-primary rounded-md text-sm">
                        {message}
                    </div>
                )}

                <div className="space-y-3 pt-4">
                    <Button 
                        onClick={handleReload} 
                        className="w-full"
                        disabled={loading}
                    >
                        I've Verified My Email
                    </Button>
                    
                    <Button 
                        onClick={handleResend} 
                        variant="secondary" 
                        className="w-full"
                        disabled={loading}
                    >
                        Resend Verification Email
                    </Button>

                    <button 
                        onClick={logout}
                        className="text-sm text-dark-muted hover:text-dark-text underline mt-4"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
};
