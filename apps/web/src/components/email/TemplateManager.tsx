'use client';

import { useState, useEffect } from 'react';

interface Template {
    id: string;
    name: string;
    subject: string;
    html_content: string;
    category: 'transactional' | 'promotional';
}

export default function TemplateManager() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [editing, setEditing] = useState<Partial<Template> | null>(null);
    const [isNew, setIsNew] = useState(false);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        const res = await fetch('/api/v1/admin/email/templates');
        if (res.ok) setTemplates(await res.json());
    };

    const handleSave = async () => {
        if (!editing) return;

        const method = isNew ? 'POST' : 'PUT';
        const url = isNew
            ? '/api/v1/admin/email/templates'
            : `/api/v1/admin/email/templates/${editing.id}`;

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: editing.name,
                subject: editing.subject,
                htmlContent: editing.html_content,
                category: editing.category
            })
        });

        if (res.ok) {
            setEditing(null);
            setIsNew(false);
            fetchTemplates();
        } else {
            alert('Failed to save template');
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            {/* List */}
            <div className="col-span-1 bg-gray-800 rounded-lg p-4 overflow-y-auto border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-200">Templates</h3>
                    <button
                        onClick={() => { setEditing({ category: 'promotional' }); setIsNew(true); }}
                        className="px-2 py-1 bg-blue-600 text-xs rounded hover:bg-blue-500"
                    >
                        + New
                    </button>
                </div>
                <div className="space-y-2">
                    {templates.map(t => (
                        <div
                            key={t.id}
                            onClick={() => { setEditing(t); setIsNew(false); }}
                            className={`p-3 rounded cursor-pointer border ${editing?.id === t.id ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 hover:border-gray-500'}`}
                        >
                            <div className="font-medium text-gray-200">{t.name}</div>
                            <div className="text-xs text-gray-500 mt-1 flex gap-2">
                                <span className={`uppercase ${t.category === 'transactional' ? 'text-green-400' : 'text-purple-400'}`}>
                                    {t.category}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Editor */}
            <div className="col-span-2 bg-gray-900 rounded-lg border border-gray-700 p-4 flex flex-col">
                {editing ? (
                    <div className="flex flex-col h-full space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Name</label>
                                <input
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                                    value={editing.name || ''}
                                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Category</label>
                                <select
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                                    value={editing.category}
                                    onChange={e => setEditing({ ...editing, category: e.target.value as any })}
                                >
                                    <option value="promotional">Promotional</option>
                                    <option value="transactional">Transactional</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Subject</label>
                            <input
                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                                value={editing.subject || ''}
                                onChange={e => setEditing({ ...editing, subject: e.target.value })}
                            />
                        </div>

                        <div className="flex-1 flex flex-col">
                            <label className="block text-xs text-gray-500 mb-1">HTML Content</label>
                            <textarea
                                className="flex-1 w-full bg-black border border-gray-600 rounded p-3 text-sm font-mono text-green-400 resize-none"
                                value={editing.html_content || ''}
                                onChange={e => setEditing({ ...editing, html_content: e.target.value })}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setEditing(null)}
                                className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                            >
                                Save Template
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        Select a template to edit
                    </div>
                )}
            </div>
        </div>
    );
}
