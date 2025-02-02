// LoginPage.js
import { useContext, useEffect } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthProvider.tsx'; // Import the AuthContext from where you've defined it
import {app} from './firebaseConfig.tsx'; // Import the initialized app

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, setUser} = useContext(AuthContext); // Use setUser from AuthContext to set the user after login

  useEffect(() => {
    if (!user || !user.email || !user.email.endsWith('@felice.ed.jp')) {
      return; // Exit if no user, no email, or email does not match domain
    }
    
    navigate('/');
  }, [user, navigate]);

  const handleLogin = async () => {
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

    // Restrict access to a specific workspace domain using setCustomParameters
    provider.setCustomParameters({
      hd: 'felice.ed.jp', // Replace with your workspace domain
    });

    try {
      const result = await signInWithPopup(auth, provider);
      // This gives you a Google Access Token. You can use it to access the Google API.
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential) {

     // const _token = credential.accessToken;
      
      // The signed-in user info.
      const user = result.user;

      // Check if the domain is the expected one (your workspace)
      if (user.email && user.email.endsWith('@felice.ed.jp')) {
        setUser(user); // Set the user in your context
        navigate('/'); // Redirect to the home page after login
        return; // Stop further execution
      } else {
        throw new Error('Invalid domain');
      }
    }
    } catch (error) {
      console.error(error);
      navigate('/login'); // Example redirection on error
    }
  };

  return (
<div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
  <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg z-10">
    <div className="grid  place-items-center">
      <img src="https://i.imgur.com/J0CKBhr.png" />
      <h2 className="text-3xl font-extrabold text-gray-900 text-center">
Felice Search Logs      </h2>
    </div>
    <div className="mt-8 space-y-6">
      <button
        onClick={handleLogin}
        className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <span className="absolute left-0 inset-y-0 flex items-center pl-3">
          {/* Icon code will go here */}
        </span>
        Login with Google
      </button>
    </div>
  </div>
</div>

  );
};

export default LoginPage;
