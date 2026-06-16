'use client'

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { FileUpload } from "@/components/ui/file-upload"

interface ImageUploadProps {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  disabled,
  className
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  return (
    <div className={`space-y-4 w-fit ${className}`}>
      <div
        className={`
          relative border-2 border-dashed rounded-none p-4 
          hover:bg-muted/50 transition
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isUploading ? 'opacity-50' : ''}
        `}
      >
        {value ? (
          <div className="relative aspect-square w-[100px]">
            <Image
              src={value}
              alt="Uploaded image"
              fill
              className="object-cover rounded-none"
            />
            {!disabled && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-[-1rem] right-[-1rem]"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <FileUpload
            label={isUploading ? "Uploading..." : "Upload image"}
            accept="image/*"
            maxSizeMB={4}
            onUploadComplete={(file) => {
              setIsUploading(false);
              onChange(file.url);
              toast({
                title: "Success",
                description: "Image uploaded successfully",
              });
            }}
          />
        )}
      </div>
    </div>
  );
}


