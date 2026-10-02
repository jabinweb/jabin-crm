'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { FullTableSkeleton } from '@/components/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { confirmAction } from '@/lib/confirm-action';

interface FileRecord {
    id: string;
    filename: string | null;
    originalName: string | null;
    mimeType: string | null;
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
function hasPermission(user: any): boolean {
    if (!user) return false;

    const role = String(user.role || '');
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;

    return false;
}

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const formatDate = (dateString: string) => format(new Date(dateString), 'MMM d, yyyy · h:mm a');

const getFileIcon = (mimeType: string | null) => {
    if (mimeType?.startsWith('image/')) {
        return <FileText className="h-4 w-4 text-blue-500" aria-hidden />;
    }
    if (mimeType === 'application/pdf') {
        return <FileText className="h-4 w-4 text-red-500" aria-hidden />;
    }
    if (mimeType === 'application/epub+zip') {
        return <FileText className="h-4 w-4 text-purple-500" aria-hidden />;
    }
    return <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />;
};

const fileLabel = (file: FileRecord) => file.originalName ?? file.filename ?? 'file';

export default function FileManagerPage() {
    const { data: session, status } = useSession();
    const user = session?.user;
    const [files, setFiles] = useState<FileRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFolder, setSelectedFolder] = useState<string>('all');
    const [deleting, setDeleting] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canRead = hasPermission(user);
    const canUpload = canRead;
    const canDelete = canRead;
    const isLoadingAuth = status === 'loading';

    const fetchFiles = async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const response = await fetch('/api/files');
            const data = await response.json();

            if (response.ok) {
                setFiles(data.files || []);
            } else {
                setLoadError(true);
                toast.error('Failed to load files');
            }
        } catch (error) {
            console.error('Error fetching files:', error);
            setLoadError(true);
            toast.error('Error loading files');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isLoadingAuth && !canRead) {
            window.location.href = '/';
            return;
        }

        if (canRead) {
            fetchFiles();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canRead, isLoadingAuth]);

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
                toast.success('File uploaded');
                fetchFiles();
            } else {
                toast.error(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Error uploading file');
        } finally {
            setUploading(false);
            // Allow re-selecting the same file
            event.target.value = '';
        }
    };

    const deleteFile = async (fileId: string, filename: string) => {
        const ok = await confirmAction({
            title: `Delete ${filename}?`,
            description: 'The file is removed from storage. Links to it will stop working.',
            confirmLabel: 'Delete',
            variant: 'destructive',
        });
        if (!ok) return;

        setDeleting(fileId);
        try {
            const response = await fetch(`/api/files/${fileId}`, {
                method: 'DELETE',
            });

            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                toast.success('File deleted');
                setSelectedFiles((prev) => {
                    const next = new Set(prev);
                    next.delete(fileId);
                    return next;
                });
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

    const folders = Array.from(new Set(files.map((f) => f.folder))).sort();
    const query = searchQuery.trim().toLowerCase();
    const filteredFiles = files.filter((file) => {
        const matchesSearch =
            !query ||
            (file.filename ?? '').toLowerCase().includes(query) ||
            (file.originalName ?? '').toLowerCase().includes(query);
        const matchesFolder = selectedFolder === 'all' || file.folder === selectedFolder;
        return matchesSearch && matchesFolder;
    });
    const isFiltered = !!query || selectedFolder !== 'all';

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

    const allOnPageSelected =
        paginatedFiles.length > 0 && paginatedFiles.every((f) => selectedFiles.has(f.id));

    const toggleSelectAll = () => {
        if (allOnPageSelected) {
            setSelectedFiles(new Set());
        } else {
            setSelectedFiles(new Set(paginatedFiles.map((f) => f.id)));
        }
    };

    const bulkDeleteFiles = async () => {
        if (selectedFiles.size === 0) return;

        const count = selectedFiles.size;
        const ok = await confirmAction({
            title: `Delete ${count} selected file${count === 1 ? '' : 's'}?`,
            description: 'The files are removed from storage. Links to them will stop working.',
            confirmLabel: 'Delete',
            variant: 'destructive',
        });
        if (!ok) return;

        setBulkDeleting(true);
        try {
            const results = await Promise.all(
                Array.from(selectedFiles).map((fileId) =>
                    fetch(`/api/files/${fileId}`, { method: 'DELETE' })
                        .then((res) => res.ok)
                        .catch(() => false)
                )
            );
            const failed = results.filter((ok) => !ok).length;
            const deleted = results.length - failed;
            if (failed === 0) {
                toast.success(`${deleted} file${deleted === 1 ? '' : 's'} deleted`);
            } else {
                toast.error(`${failed} of ${results.length} files could not be deleted`);
            }
            setSelectedFiles(new Set());
            fetchFiles();
        } finally {
            setBulkDeleting(false);
        }
    };

    const resetPaging = () => {
        setCurrentPage(1);
        setSelectedFiles(new Set());
    };

    if (!canRead) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Uploaded files across all folders
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={fetchFiles} disabled={loading} variant="outline">
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    {canUpload && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleFileUpload}
                                disabled={uploading}
                            />
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                {uploading
                                    ? 'Uploading…'
                                    : selectedFolder === 'all'
                                        ? 'Upload file'
                                        : `Upload to ${selectedFolder}`}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {isFiltered ? 'Matching files' : 'Total files'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold tabular-nums">
                            {loading ? '—' : filteredFiles.length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total size
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold tabular-nums">
                            {loading ? '—' : formatFileSize(totalSize)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Folders
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold tabular-nums">
                            {loading ? '—' : folders.length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Bulk Actions */}
            {selectedFiles.size > 0 && (
                <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">
                                {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedFiles(new Set())}
                                >
                                    Clear selection
                                </Button>
                                {canDelete && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={bulkDeleteFiles}
                                        disabled={bulkDeleting}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        {bulkDeleting ? 'Deleting…' : 'Delete selected'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Files Table */}
            <Card>
                <CardHeader className="space-y-3">
                    <CardTitle className="text-base">Files</CardTitle>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative min-w-0 flex-1">
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden
                            />
                            <Input
                                type="search"
                                placeholder="Search by file name"
                                aria-label="Search files"
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    resetPaging();
                                }}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Select
                                value={selectedFolder}
                                onValueChange={(v) => {
                                    setSelectedFolder(v);
                                    resetPaging();
                                }}
                            >
                                <SelectTrigger className="w-full sm:w-44" aria-label="Folder">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All folders</SelectItem>
                                    {folders.map((folder) => (
                                        <SelectItem key={folder} value={folder}>
                                            {folder}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={itemsPerPage.toString()}
                                onValueChange={(v) => {
                                    setItemsPerPage(Number(v));
                                    resetPaging();
                                }}
                            >
                                <SelectTrigger className="w-28 shrink-0" aria-label="Rows per page">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10 / page</SelectItem>
                                    <SelectItem value="25">25 / page</SelectItem>
                                    <SelectItem value="50">50 / page</SelectItem>
                                    <SelectItem value="100">100 / page</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="min-w-0">
                    {loading ? (
                        <FullTableSkeleton columnCount={7} rowCount={6} />
                    ) : loadError ? (
                        <EmptyState
                            icon={FileText}
                            title="Couldn't load files"
                            description="Something went wrong while fetching the file list."
                            actionLabel="Try again"
                            onAction={fetchFiles}
                            className="py-10"
                        />
                    ) : filteredFiles.length === 0 ? (
                        isFiltered ? (
                            <EmptyState
                                icon={Search}
                                title="No files match"
                                description="Try a different name or folder."
                                actionLabel="Clear filters"
                                onAction={() => {
                                    setSearchQuery('');
                                    setSelectedFolder('all');
                                    resetPaging();
                                }}
                                className="py-10"
                            />
                        ) : (
                            <EmptyState
                                icon={FileText}
                                title="No files yet"
                                description="Files uploaded anywhere on the platform will appear here."
                                actionLabel={canUpload ? 'Upload file' : undefined}
                                onAction={canUpload ? () => fileInputRef.current?.click() : undefined}
                                className="py-10"
                            />
                        )
                    ) : (
                        <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <input
                                                type="checkbox"
                                                aria-label="Select all files on this page"
                                                checked={allOnPageSelected}
                                                onChange={toggleSelectAll}
                                                className="h-4 w-4 rounded border-input"
                                            />
                                        </TableHead>
                                        <TableHead className="w-10">
                                            <span className="sr-only">Type</span>
                                        </TableHead>
                                        <TableHead>File name</TableHead>
                                        <TableHead>Folder</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Uploaded</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedFiles.map((file) => (
                                        <TableRow key={file.id}>
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Select ${fileLabel(file)}`}
                                                    checked={selectedFiles.has(file.id)}
                                                    onChange={() => toggleFileSelection(file.id)}
                                                    className="h-4 w-4 rounded border-input"
                                                />
                                            </TableCell>
                                            <TableCell>{getFileIcon(file.mimeType)}</TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex min-w-[10rem] max-w-xs flex-col">
                                                    <span className="truncate">{fileLabel(file)}</span>
                                                    {file.description && (
                                                        <span className="truncate text-xs text-muted-foreground">
                                                            {file.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="rounded bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                                                    {file.folder}
                                                </span>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap tabular-nums">
                                                {formatFileSize(file.size)}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                                {formatDate(file.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <a
                                                            href={file.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            aria-label={`Open ${fileLabel(file)}`}
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <a
                                                            href={file.url}
                                                            download
                                                            aria-label={`Download ${fileLabel(file)}`}
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                    {canDelete && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label={`Delete ${fileLabel(file)}`}
                                                            onClick={() => deleteFile(file.id, fileLabel(file))}
                                                            disabled={deleting === file.id}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination */}
                    {!loading && totalPages > 1 && (
                        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-muted-foreground">
                                Showing {startIndex + 1}–{Math.min(endIndex, filteredFiles.length)} of{' '}
                                {filteredFiles.length} files
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                                                className="w-9"
                                                aria-label={`Page ${pageNum}`}
                                                aria-current={currentPage === pageNum ? 'page' : undefined}
                                            >
                                                {pageNum}
                                            </Button>
                                        );
                                    })}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
    );
}
