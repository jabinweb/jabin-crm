'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Trash2,
    ExternalLink,
    RefreshCw,
    Search,
    FileText,
    Download,
    Upload,
    Folder
} from 'lucide-react';
import { toast } from 'sonner';

interface FileRecord {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    folder: string;
    isPublic: boolean;
    description: string | null;
    createdAt: string;
    uploadedBy: string | null;
    metadata?: Record<string, any>;
}

// Client-side permission check helper
function hasPermission(user: any, resource: string, action: string): boolean {
    if (!user) return false;

    // Super admin and admin have all permissions
    if (user.role === 'super_admin' || user.role === 'admin') return true;

    // Moderators can read files
    if (user.role === 'moderator' && action === 'read') return true;

    return false;
}

export default function FileManagerPage() {
    const { data: session, status } = useSession();
    const user = session?.user;
    const [files, setFiles] = useState<FileRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFolder, setSelectedFolder] = useState<string>('all');
    const [deleting, setDeleting] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [bulkDeleting, setBulkDeleting] = useState(false);

    const canRead = hasPermission(user, 'files', 'read');
    const canUpload = hasPermission(user, 'files', 'create');
    const canDelete = hasPermission(user, 'files', 'delete');
    const isLoadingAuth = status === 'loading';

    useEffect(() => {
        if (!isLoadingAuth && !canRead) {
            window.location.href = '/';
            return;
        }

        if (canRead) {
            fetchFiles();
        }
    }, [canRead, isLoadingAuth]);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/files');
            const data = await response.json();

            if (response.ok) {
                setFiles(data.files || []);
            } else {
                toast.error('Failed to load files');
            }
        } catch (error) {
            console.error('Error fetching files:', error);
            toast.error('Error loading files');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', selectedFolder === 'all' ? 'default' : selectedFolder);
            formData.append('isPublic', 'true');

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('File uploaded successfully');
                fetchFiles();
                // Reset input
                event.target.value = '';
            } else {
                toast.error(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Error uploading file');
        } finally {
            setUploading(false);
        }
    };

    const deleteFile = async (fileId: string, filename: string) => {
        if (!confirm(`Delete ${filename}?`)) return;

        setDeleting(fileId);
        try {
            const response = await fetch(`/api/files/${fileId}`, {
                method: 'DELETE',
            });

            const data = await response.json();
            if (response.ok) {
                toast.success('File deleted');
                fetchFiles();
            } else {
                toast.error(data.error || 'Failed to delete file');
            }
        } catch (error) {
            console.error('Error deleting file:', error);
            toast.error('Error deleting file');
        } finally {
            setDeleting(null);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) {
            return <FileText className="w-4 h-4 text-blue-500" />;
        }
        if (mimeType === 'application/pdf') {
            return <FileText className="w-4 h-4 text-red-500" />;
        }
        if (mimeType === 'application/epub+zip') {
            return <FileText className="w-4 h-4 text-purple-500" />;
        }
        return <FileText className="w-4 h-4 text-gray-500" />;
    };

    const folders = Array.from(new Set(files.map(f => f.folder)));
    const filteredFiles = files.filter(file => {
        const matchesSearch = file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
            file.originalName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFolder = selectedFolder === 'all' || file.folder === selectedFolder;
        return matchesSearch && matchesFolder;
    });

    const totalSize = filteredFiles.reduce((sum, file) => sum + file.size, 0);


    // Pagination
    const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedFiles = filteredFiles.slice(startIndex, endIndex);

    // Bulk selection
    const toggleFileSelection = (fileId: string) => {
        const newSelected = new Set(selectedFiles);
        if (newSelected.has(fileId)) {
            newSelected.delete(fileId);
        } else {
            newSelected.add(fileId);
        }
        setSelectedFiles(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedFiles.size === paginatedFiles.length) {
            setSelectedFiles(new Set());
        } else {
            setSelectedFiles(new Set(paginatedFiles.map(f => f.id)));
        }
    };

    const bulkDeleteFiles = async () => {
        if (selectedFiles.size === 0) return;

        if (!confirm(`Delete ${selectedFiles.size} selected files?`)) return;

        setBulkDeleting(true);
        try {
            const deletePromises = Array.from(selectedFiles).map(fileId =>
                fetch(`/api/files/${fileId}`, { method: 'DELETE' })
            );

            await Promise.all(deletePromises);
            toast.success(`${selectedFiles.size} files deleted`);
            setSelectedFiles(new Set());
            fetchFiles();
        } catch (error) {
            console.error('Error bulk deleting files:', error);
            toast.error('Error deleting some files');
        } finally {
            setBulkDeleting(false);
        }
    };

    if (!canRead) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">File Manager</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage files across all folders
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {canUpload && (
                            <div className="relative">
                                <input
                                    type="file"
                                    id="file-upload"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                />
                                <Button asChild disabled={uploading}>
                                    <label htmlFor="file-upload" className="cursor-pointer">
                                        <Upload className="w-4 h-4 mr-2" />
                                        {uploading ? 'Uploading...' : 'Upload File'}
                                    </label>
                                </Button>
                            </div>
                        )}
                        <Button onClick={fetchFiles} disabled={loading} variant="outline">
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Files
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{filteredFiles.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Size
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatFileSize(totalSize)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Folders
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{folders.length}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Bulk Actions */}
                {selectedFiles.size > 0 && (
                    <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                    {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelectedFiles(new Set())}
                                    >
                                        Clear Selection
                                    </Button>
                                    {canDelete && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={bulkDeleteFiles}
                                            disabled={bulkDeleting}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            {bulkDeleting ? 'Deleting...' : 'Delete Selected'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Files Table */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>
                                Files ({filteredFiles.length})
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Show</span>
                                <Select value={itemsPerPage.toString()} onValueChange={(v) => {
                                    setItemsPerPage(Number(v));
                                    setCurrentPage(1);
                                }}>
                                    <SelectTrigger className="w-20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto overflow-y-visible scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40 transition-colors">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <input
                                                type="checkbox"
                                                checked={selectedFiles.size === paginatedFiles.length && paginatedFiles.length > 0}
                                                onChange={toggleSelectAll}
                                                className="rounded border-gray-300"
                                            />
                                        </TableHead>
                                        <TableHead className="w-12"></TableHead>
                                        <TableHead>Filename</TableHead>
                                        <TableHead>Folder</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Uploaded</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                Loading files...
                                            </TableCell>
                                        </TableRow>
                                    ) : paginatedFiles.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                No files found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedFiles.map((file) => (
                                            <TableRow key={file.id}>
                                                <TableCell>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedFiles.has(file.id)}
                                                        onChange={() => toggleFileSelection(file.id)}
                                                        className="rounded border-gray-300"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {getFileIcon(file.mimeType)}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    <div className="flex flex-col">
                                                        <span>{file.originalName}</span>
                                                        {file.description && (
                                                            <span className="text-xs text-muted-foreground">{file.description}</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">
                                                        {file.folder}
                                                    </span>
                                                </TableCell>
                                                <TableCell>{formatFileSize(file.size)}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {formatDate(file.createdAt)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            asChild
                                                        >
                                                            <a href={file.url} target="_blank" rel="noopener noreferrer">
                                                                <ExternalLink className="w-4 h-4" />
                                                            </a>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            asChild
                                                        >
                                                            <a href={file.url} download>
                                                                <Download className="w-4 h-4" />
                                                            </a>
                                                        </Button>
                                                        {canDelete && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => deleteFile(file.id, file.originalName)}
                                                                disabled={deleting === file.id}
                                                            >
                                                                <Trash2 className="w-4 h-4 text-red-500" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                <div className="text-sm text-muted-foreground">
                                    Showing {startIndex + 1} to {Math.min(endIndex, filteredFiles.length)} of {filteredFiles.length} files
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        Previous
                                    </Button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum: number;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }

                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={currentPage === pageNum ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className="w-8"
                                                >
                                                    {pageNum}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}