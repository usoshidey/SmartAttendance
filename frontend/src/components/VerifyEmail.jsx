import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!token) {
      setMessage('Invalid link. No verification token found.');
      return;
    }

    const verifyToken = async () => {
      try {
        // IMPORTANT: Make sure this URL matches your backend API address and port
        const apiUrl = process.env.REACT_APP_API_URL || 'http://10.29.8.13:6005';
        
        const response = await fetch(`${apiUrl}/auth/verify-email?token=${token}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (response.ok) {
          setMessage('Email successfully verified! Redirecting to dashboard...');
          
          // Save the access token to local storage so you stay logged in
          localStorage.setItem('access_token', data.access_token);
          
          // Wait 1.5 seconds so the user sees the success message, then redirect
          setTimeout(() => {
            navigate('/dashboard'); // Change this to your actual dashboard route if it's different
          }, 1500);
        } else {
          // The token was expired or invalid
          setMessage(data.detail || 'Verification failed. The link may have expired.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setMessage('Network error. Could not connect to the server.');
      }
    };

    verifyToken();
  }, [token, navigate]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0d0d1a', color: '#e0e0ff', fontFamily: 'monospace' }}>
      <div style={{ textAlign: 'center', padding: '2rem', background: '#1a1a2e', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)' }}>
        <h2 style={{ color: '#6366f1', marginBottom: '1rem' }}>◈ Smart Attendance</h2>
        <p style={{ fontSize: '1.2rem' }}>{message}</p>
        
        {/* Show a login button if verification failed */}
        {message.includes('failed') || message.includes('Invalid') ? (
          <button 
            onClick={() => navigate('/login')}
            style={{ marginTop: '1.5rem', padding: '10px 20px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Back to Login
          </button>
        ) : null}
      </div>
    </div>
  );
}