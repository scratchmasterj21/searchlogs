// ConfigPage.tsx
import React, { useEffect, useState, useContext } from 'react';
import { ref, onValue, set, get, child, remove } from 'firebase/database';
import { database } from './firebaseConfig';
import { AuthContext } from './AuthProvider';
import { useAdmins } from './hooks/useAdmins';
import NavBar from './components/NavBar';

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
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkText, setBulkText] = useState('');
    const { user } = useContext(AuthContext);
    const { isAdmin } = useAdmins();

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

    const showToastMessage = (message: string) => {
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    const addItemToFirebase = async (category: string, newItem: string, showWarning = true) => {
        const categoryRef = ref(database, `config/searchSettings/${category}`);
        const snapshot = await get(categoryRef);
        const data = snapshot.val() || [];
        
        // Check for exact duplicates
        const existingItems = Object.values(data) as string[];
        if (existingItems.includes(newItem)) {
            showToastMessage('⚠️ This exact item already exists!');
            return;
        }
        
        // Check for similar items (case-insensitive)
        const similarItems = existingItems.filter(item => 
            item.toLowerCase() === newItem.toLowerCase() && item !== newItem
        );
        
        if (showWarning && similarItems.length > 0) {
            showToastMessage(`ℹ️ Similar item exists: "${similarItems[0]}" - Added anyway`);
        }
        
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
        await set(child(categoryRef, newKey.toString()), newItem);
        
        if (!showWarning || similarItems.length === 0) {
            showToastMessage('✅ Item added successfully!');
        }
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
        if (!isAdmin(user?.email)) {
            alert('You do not have permission to delete this item.');
            return;
        }
        
        const confirmed = window.confirm('Are you sure you want to delete this item?');
        if (confirmed) {
            deleteItemFromFirebase(category, item);
        }
    };

    const handleBulkAdd = async () => {
        if (!bulkText.trim()) {
            showToastMessage('⚠️ Please enter items to add');
            return;
        }

        const items = bulkText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (items.length === 0) {
            showToastMessage('⚠️ No valid items to add');
            return;
        }

        let addedCount = 0;
        let skippedCount = 0;

        for (const item of items) {
            try {
                await addItemToFirebase(bulkCategory, item, false);
                addedCount++;
            } catch (error) {
                skippedCount++;
                console.error(`Error adding ${item}:`, error);
            }
        }

        showToastMessage(`✅ Added ${addedCount} items${skippedCount > 0 ? `, skipped ${skippedCount} duplicates` : ''}`);
        setBulkText('');
        setShowBulkModal(false);
    };

    const renderColumns = (data: string[], title: string, searchValue: string, setSearchValue: React.Dispatch<React.SetStateAction<string>>, category: string) => {
        const filteredData = data.filter(item => item.toLowerCase().includes(searchValue.toLowerCase()));
        const columns = divideIntoColumns(filteredData, 3);
        const hasExactMatch = data.some(item => item.toLowerCase() === searchValue.toLowerCase());
        
        return (
            <div className={`mb-8 ${isBlurred ? 'blur-sm' : ''}`}>
                <h2 className="text-xl font-bold mb-4">{title}</h2>
                <div className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="flex-1 p-2 border rounded"
                        placeholder={`Search or Add ${title}`}
                    />
                    <button
                        onClick={() => {
                            setBulkCategory(category);
                            setShowBulkModal(true);
                        }}
                        className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors whitespace-nowrap"
                        title="Bulk Add Multiple Items"
                    >
                        + Bulk Add
                    </button>
                </div>
                {searchValue && (
                    <div className="mb-4 flex gap-2">
                        <button
                            onClick={() => {
                                addItemToFirebase(category, searchValue);
                                setSearchValue('');
                            }}
                            className={`px-4 py-2 rounded transition-colors ${
                                hasExactMatch 
                                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                            disabled={hasExactMatch}
                        >
                            {hasExactMatch ? '✓ Already Exists' : `+ Add "${searchValue}"`}
                        </button>
                        {filteredData.length > 0 && !hasExactMatch && (
                            <span className="text-sm text-gray-500 self-center">
                                {filteredData.length} similar item{filteredData.length > 1 ? 's' : ''} found below
                            </span>
                        )}
                    </div>
                )}
                {searchValue && filteredData.length > 0 && (
                    <div className="flex flex-col md:flex-row">
                        {columns.map((columnData, columnIndex) => (
                            <div key={columnIndex} className="w-full md:w-1/3 px-2">
                                {columnData.map((item, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        aria-label={`Delete ${item}`}
                                        className="block w-full text-left mb-2 cursor-pointer hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-300 rounded"
                                        onClick={() => handleDelete(category, item)}
                                    >
                                        {item}
                                    </button>
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
        const hasExactMatch = data.some(item => item.toLowerCase() === searchValue.toLowerCase());

        return (
            <div className={`mb-8 ${isBlurred ? 'blur-sm' : ''}`}>
                <h2 className="text-xl font-bold mb-4">{title}</h2>

                <div className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="flex-1 p-2 border rounded"
                        placeholder={`Search or Add ${title}`}
                    />
                    <button
                        onClick={() => {
                            setBulkCategory(category);
                            setShowBulkModal(true);
                        }}
                        className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors whitespace-nowrap"
                        title="Bulk Add Multiple URLs"
                    >
                        + Bulk Add
                    </button>
                </div>
                {searchValue && (
                    <div className="mb-4">
                        <button
                            onClick={() => {
                                addItemToFirebase(category, searchValue);
                                setSearchValue('');
                            }}
                            className={`px-4 py-2 rounded transition-colors ${
                                hasExactMatch 
                                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                            disabled={hasExactMatch}
                        >
                            {hasExactMatch ? '✓ Already Exists' : `+ Add URL`}
                        </button>
                    </div>
                )}
                {searchValue && (
                    <div className="flex flex-wrap">
                        {displayData.map((item, index) => (
                            <div key={index} className="relative w-1/2 md:w-1/4 p-1">
                                {isAdmin(user?.email) && (
                                    <button 
                                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full px-2 py-1 z-10"
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
        {/* Toast Notification */}
        {showToast && (
            <div className="fixed top-4 right-4 z-50 bg-white border-l-4 border-blue-500 shadow-lg rounded-lg p-4 max-w-md animate-fade-in">
                <p className="text-gray-800 font-medium">{toastMessage}</p>
            </div>
        )}

        {/* Bulk Add Modal */}
        {showBulkModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                    <div className="p-6 border-b">
                        <h2 className="text-2xl font-bold text-gray-800">Bulk Add Items</h2>
                        <p className="text-sm text-gray-600 mt-1">Add multiple items (one per line)</p>
                    </div>
                    <div className="p-6">
                        <textarea
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                            className="w-full h-64 p-3 border rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent font-mono text-sm"
                            placeholder="google.com&#10;www.google.com&#10;m.google.com&#10;images.google.com&#10;&#10;(One item per line)"
                        />
                        <p className="text-sm text-gray-500 mt-2">
                            Lines: {bulkText.split('\n').filter(line => line.trim()).length}
                        </p>
                    </div>
                    <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setShowBulkModal(false);
                                setBulkText('');
                            }}
                            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleBulkAdd}
                            className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                        >
                            Add All Items
                        </button>
                    </div>
                </div>
            </div>
        )}

        <NavBar title="Configuration" />
    
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
