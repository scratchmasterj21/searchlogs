// ConfigPage.tsx
import React, { useEffect, useState, useContext } from 'react';
import { ref, onValue, set, get, child, remove } from 'firebase/database';
import { database } from './firebaseConfig';
import LogoutButton from './Logout';
import { AuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';

interface ConfigData {
    excludedDomains: string[];
    excludedUrls: string[];
    inappropriateKeywords: string[];
}

const ConfigPage: React.FC = () => {
    const [configData, setConfigData] = useState<ConfigData>({
        excludedDomains: [],
        excludedUrls: [],
        inappropriateKeywords: [],
    });
    const [searchExcludedDomains, setSearchExcludedDomains] = useState('');
    const [searchInappropriateKeywords, setSearchInappropriateKeywords] = useState('');
    const [searchExcludedUrls, setSearchExcludedUrls] = useState('');
    const [isBlurred, setIsBlurred] = useState(false);
    const { user } = useContext(AuthContext);

    useEffect(() => {
        const configRef = ref(database, 'config/searchSettings');
        
        onValue(configRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setConfigData({
                    excludedDomains: data.excludedDomains || [],
                    excludedUrls: data.excludedUrls || [],
                    inappropriateKeywords: data.inappropriateKeywords || [],
                });
            }
        });

        let timeout: NodeJS.Timeout;

        const resetTimer = () => {
            clearTimeout(timeout);
            setIsBlurred(false);
            timeout = setTimeout(() => {
                setIsBlurred(true);
            }, 5000);
        };

        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('keydown', resetTimer);

        timeout = setTimeout(() => {
            setIsBlurred(true);
        }, 5000);

        return () => {
            clearTimeout(timeout);
            window.removeEventListener('mousemove', resetTimer);
            window.removeEventListener('keydown', resetTimer);
        };
    }, []);

    const divideIntoColumns = (array: string[], columns: number) => {
        const perColumn = Math.ceil(array.length / columns);
        return new Array(columns).fill('').map((_, columnIndex) => {
            return array.slice(columnIndex * perColumn, (columnIndex + 1) * perColumn);
        });
    };

    const addItemToFirebase = async (category: string, newItem: string) => {
        const categoryRef = ref(database, `config/searchSettings/${category}`);
        const snapshot = await get(categoryRef);
        const data = snapshot.val() || [];
        const existingKeys = Object.keys(data).map(Number).sort((a, b) => a - b);
        let newKey = 0;
        for (let i = 0; i < existingKeys.length; i++) {
            if (existingKeys[i] !== i) {
                newKey = i;
                break;
            } else {
                newKey = i + 1;
            }
        }
        set(child(categoryRef, newKey.toString()), newItem);
    };

    const deleteItemFromFirebase = async (category: string, itemToDelete: string) => {
        const categoryRef = ref(database, `config/searchSettings/${category}`);
        const snapshot = await get(categoryRef);
        const data = snapshot.val();
        if (data) {
            const itemKey = Object.keys(data).find(key => data[key] === itemToDelete);
            if (itemKey) {
                remove(child(categoryRef, itemKey));
            }
        }
    };

    const handleDelete = (category: string, item: string) => {
        if (user?.email !== 'john.limpiada@felice.ed.jp') {
            alert('You do not have permission to delete this item.');
            return;
        }
        
        const confirmed = window.confirm('Are you sure you want to delete this item?');
        if (confirmed) {
            deleteItemFromFirebase(category, item);
        }
    };

    const renderColumns = (data: string[], title: string, searchValue: string, setSearchValue: React.Dispatch<React.SetStateAction<string>>, category: string) => {
        const filteredData = data.filter(item => item.toLowerCase().includes(searchValue.toLowerCase()));
        const columns = divideIntoColumns(filteredData, 3);
        return (
            <div className={`mb-8 ${isBlurred ? 'blur-sm' : ''}`}>
                <h2 className="text-xl font-bold mb-4">{title}</h2>
                <input 
                    type="text" 
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="mb-4 p-2 border rounded w-full"
                    placeholder={`Search or Add ${title}`}
                />
                {filteredData.length === 0 && searchValue && (
                    <div className="mb-4">
                        <button
                            onClick={() => {
                                addItemToFirebase(category, searchValue);
                                setSearchValue('');
                            }}
                            className="p-2 bg-blue-500 text-white rounded"
                        >
                            Add
                        </button>
                    </div>
                )}
                {searchValue && filteredData.length > 0 && (
                    <div className="flex flex-col md:flex-row">
                        {columns.map((columnData, columnIndex) => (
                            <div key={columnIndex} className="w-full md:w-1/3 px-2">
                                {columnData.map((item, index) => (
                                    <p 
                                        key={index} 
                                        className="mb-2 cursor-pointer hover:text-red-500" 
                                        onClick={() => handleDelete(category, item)}
                                    >
                                        {item}
                                    </p>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderImagesColumn = (data: string[], title: string, searchValue: string, setSearchValue: React.Dispatch<React.SetStateAction<string>>, category: string) => {
        const filteredData = data.filter(item => item.toLowerCase().includes(searchValue.toLowerCase()));
        const displayData = searchValue ? data : filteredData;

        return (
            <div className={`mb-8 ${isBlurred ? 'blur-sm' : ''}`}>
                <h2 className="text-xl font-bold mb-4">{title}</h2>

                <input 
                    type="text" 
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="mb-4 p-2 border rounded w-full"
                    placeholder={`Search or Add ${title}`}
                />
                {filteredData.length === 0 && searchValue && (
                    <div className="mb-4">
                        <button
                            onClick={() => {
                                addItemToFirebase(category, searchValue);
                                setSearchValue('');
                            }}
                            className="p-2 bg-blue-500 text-white rounded"
                        >
                            Add
                        </button>
                    </div>
                )}
                {searchValue && (
                    <div className="flex flex-wrap">
                        {displayData.map((item, index) => (
                            <div key={index} className="relative w-1/2 md:w-1/4 p-1">
                                {user?.email === 'john.limpiada@felice.ed.jp' && (
                                    <button 
                                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full px-2 py-1"
                                        onClick={() => handleDelete(category, item)}
                                    >
                                        x
                                    </button>
                                )}
                                <a href={item} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                                    <img src={item} alt={`excluded-url-${index}`} className="w-full h-auto object-cover" />
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="container mx-auto px-4 py-6">
        <nav className="flex flex-col md:flex-row items-center justify-between p-4 bg-blue-600 shadow-lg rounded-lg mb-6">
            <div className="flex items-center mb-2 md:mb-0">
                {user && (
                    <span className="text-white font-semibold underline">
                        User: {user.displayName || 'User'}
                    </span>
                )}
            </div>
            <div className="flex items-center mb-2 md:mb-0">
                <h1 className="text-2xl md:text-3xl text-white font-extrabold text-center">Search Logs</h1>
            </div>
            <div className="flex items-center">
                <LogoutButton />
            </div>
        </nav>
    
        <div className="flex justify-center mb-4 space-x-6">
            <Link to="/" className="text-blue-500 text-lg hover:underline">Search Logs</Link>
            <Link to="/worker-control" className="text-blue-500 text-lg hover:underline flex items-center space-x-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Worker Control</span>
            </Link>
        </div>
    
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-white shadow-md rounded-md">
                {renderColumns(configData.excludedDomains, 'Excluded Domains', searchExcludedDomains, setSearchExcludedDomains, 'excludedDomains')}
            </div>
            <div className="p-4 bg-white shadow-md rounded-md">
                {renderColumns(configData.inappropriateKeywords, 'Inappropriate Keywords', searchInappropriateKeywords, setSearchInappropriateKeywords, 'inappropriateKeywords')}
            </div>
            <div className="p-4 bg-white shadow-md rounded-md">
                {renderImagesColumn(configData.excludedUrls, 'Excluded URLs', searchExcludedUrls, setSearchExcludedUrls, 'excludedUrls')}
            </div>
        </div>
    </div>
    
    );
};

export default ConfigPage;
