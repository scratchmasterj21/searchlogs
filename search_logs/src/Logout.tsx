import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';

const LogoutButton = () => {
  const navigate = useNavigate();
  const auth = getAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Consider setting the user to null here if you're not relying on the onAuthStateChanged listener to do it
      navigate('/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <div>
      <button onClick={handleLogout}
      className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-red-800 focus:ring-opacity-75"
      >
        Logout
      </button>
    </div>
  );
};

export default LogoutButton;
