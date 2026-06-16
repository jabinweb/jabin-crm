'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, FileText, Image as ImageIcon, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UploadedFile {
  filename: string;
  url: string;
  size: number;
  type: string;
}

interface FileUploadProps {
  onUploadComplete?: (file: UploadedFile) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  folder?: string; // Website/project folder name
}

export function FileUpload({ 
  onUploadComplete, 
  accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx',
  maxSizeMB = 10,
  label = 'Upload File',
  folder = 'sciocare' // Default folder
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    console.log('Starting upload for file:', file.name, 'Type:', file.type, 'Size:', file.size);
    
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      toast.error(`File too large. Maximum size: ${maxSizeMB}MB`);
      return;
    }

    // Show preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }

    // Upload file
    console.log('Setting uploading to true');
    setUploading(true);
    toast.info('Uploading file...');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder); // Add folder parameter

      console.log('Sending request to /api/upload');
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadedFile(data);
      console.log('Upload successful, file data:', data);
      toast.success('File uploaded successfully!');
      onUploadComplete?.(data);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload file');
      setPreview(null);
    } finally {
      console.log('Setting uploading to false');
      setUploading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    await uploadFile(file);
  };

  const handleRemove = () => {
    setUploadedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-blue-500" />;
    return <FileText className="w-8 h-8 text-gray-500" />;
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      {!uploadedFile ? (
        <Card 
          className={`border-2 border-dashed transition-colors cursor-pointer ${
            isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-gray-100'
          }`}
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            {uploading ? (
              <>
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                <p className="text-base font-medium text-gray-700">Uploading...</p>
                <p className="text-sm text-gray-500 mt-1">Please wait</p>
              </>
            ) : (
              <>
                <Upload className={`w-16 h-16 mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                <p className="text-base font-semibold text-gray-700 mb-2">{label}</p>
                <p className="text-sm text-gray-500 mb-1">
                  Click to browse or drag and drop
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Max size: {maxSizeMB}MB
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {preview ? (
                <img 
                  src={preview} 
                  alt="Preview" 
                  className="w-16 h-16 object-cover rounded-none"
                />
              ) : (
                <div className="w-16 h-16 flex items-center justify-center bg-white rounded-none">
                  {getFileIcon(uploadedFile.type)}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {uploadedFile.filename}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatFileSize(uploadedFile.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemove}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <a
                  href={uploadedFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                >
                  View file
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
