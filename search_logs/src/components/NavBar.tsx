import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../AuthProvider';
import LogoutButton from '../Logout';

interface NavLinkDef {
    to: string;
    label: string;
}

const LINKS: NavLinkDef[] = [
    { to: '/', label: 'Search Logs' },
    { to: '/flagged', label: 'Flagged' },
    { to: '/analytics', label: 'Analytics' },
    { to: '/ai-chats', label: 'AI Chats' },
    { to: '/ai-analytics', label: 'AI Analytics' },
    { to: '/devices', label: 'Devices' },
    { to: '/worker-control', label: 'Worker Control' },
    { to: '/config', label: 'Config' },
];

// Shared top navigation used by every dashboard page so the link set and styling stay
// consistent. Pass a `title` to label the current page.
const NavBar: React.FC<{ title: string }> = ({ title }) => {
    const { user } = useContext(AuthContext);
    const location = useLocation();

    return (
        <nav className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-xl rounded-xl mb-8 overflow-hidden">
            <div className="px-6 py-4">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                    <div className="flex items-center min-w-0">
                        {user && (
                            <div className="min-w-0">
                                <p className="text-white font-semibold text-sm truncate">{user.displayName || 'User'}</p>
                                <p className="text-blue-100 text-xs truncate">{user.email}</p>
                            </div>
                        )}
                    </div>

                    <h1 className="text-xl sm:text-2xl text-white font-extrabold whitespace-nowrap">{title}</h1>

                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {LINKS.map(link => {
                            const active = location.pathname === link.to;
                            return (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                        active
                                            ? 'bg-white text-blue-700 font-semibold'
                                            : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            );
                        })}
                        <LogoutButton />
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default NavBar;
