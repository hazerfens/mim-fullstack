"use client"

import * as React from "react"
import { useDropzone } from "react-dropzone"
import { Upload, X, File, Image as ImageIcon, Video, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

export interface FileWithPreview extends File {
  preview?: string
}

interface FileUploadProps {
  value?: string | FileWithPreview
  onChange: (file: FileWithPreview | null) => void
  accept?: Record<string, string[]>
  maxSize?: number
  disabled?: boolean
  className?: string
  label?: string
  description?: string
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i]
}

const getFileIcon = (file: File) => {
  const type = file.type
  if (type.startsWith("image/")) return <ImageIcon className="h-8 w-8" />
  if (type.startsWith("video/")) return <Video className="h-8 w-8" />
  if (type.startsWith("application/pdf")) return <FileText className="h-8 w-8" />
  return <File className="h-8 w-8" />
}

export function FileUpload({
  value,
  onChange,
  accept = {
    "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
    "video/*": [".mp4", ".webm", ".ogg"],
    "application/pdf": [".pdf"],
  },
  maxSize = 10 * 1024 * 1024, // 10MB default
  disabled = false,
  className,
  label,
  description,
}: FileUploadProps) {
  const [preview, setPreview] = React.useState<string | null>(null)
  const [fileInfo, setFileInfo] = React.useState<File | null>(null)

  React.useEffect(() => {
    // Handle initial value
    if (typeof value === "string" && value) {
      setPreview(value)
      setFileInfo(null)
    } else if (value && typeof value === "object") {
      setFileInfo(value)
      if (value.preview) {
        setPreview(value.preview)
      } else if (value.type.startsWith("image/")) {
        const objectUrl = URL.createObjectURL(value)
        setPreview(objectUrl)
        return () => URL.revokeObjectURL(objectUrl)
      }
    }
  }, [value])

  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return

      const file = acceptedFiles[0] as FileWithPreview
      setFileInfo(file)

      // Create preview for images and videos
      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        const objectUrl = URL.createObjectURL(file)
        file.preview = objectUrl
        setPreview(objectUrl)
      } else {
        setPreview(null)
      }

      onChange(file)
    },
    [onChange]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
    disabled,
  })

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPreview(null)
    setFileInfo(null)
    onChange(null)
  }

  const hasFile = preview || fileInfo

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="space-y-1">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      <div
        {...getRootProps()}
        className={cn(
          "relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
          isDragActive && "border-primary bg-primary/5",
          !isDragActive && "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "cursor-not-allowed opacity-50",
          hasFile && "border-solid"
        )}
      >
        <input {...getInputProps()} />

        {hasFile ? (
          <div className="relative w-full h-full min-h-[120px] p-4">
            {/* Remove button */}
            <button
              onClick={handleRemove}
              disabled={disabled}
              className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-1.5 text-destructive-foreground shadow-md transition-opacity hover:opacity-80"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Preview */}
            <div className="flex h-full w-full items-center justify-center">
              {preview && fileInfo?.type.startsWith("image/") ? (
                <Image
                  src={preview}
                  alt="Preview"
                  width={200}
                  height={100}
                  className="max-h-[100px] w-auto rounded-md object-contain"
                />
              ) : preview && fileInfo?.type.startsWith("video/") ? (
                <video
                  src={preview}
                  controls
                  className="max-h-[100px] w-auto rounded-md"
                />
              ) : preview && typeof value === "string" && value.startsWith("data:image") ? (
                <Image
                  src={preview}
                  alt="Preview"
                  width={200}
                  height={100}
                  className="max-h-[100px] w-auto rounded-md object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  {fileInfo && getFileIcon(fileInfo)}
                  {fileInfo && (
                    <div className="text-center">
                      <p className="text-sm font-medium">{fileInfo.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(fileInfo.size)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Max: {formatFileSize(maxSize)}
              </p>
            </div>
          </div>
        )}
      </div>

      {fileRejections.length > 0 && (
        <div className="rounded-md bg-destructive/10 p-3">
          <p className="text-sm text-destructive">
            {fileRejections[0].errors[0].code === "file-too-large"
              ? `Dosya çok büyük. Maksimum: ${formatFileSize(maxSize)}`
              : fileRejections[0].errors[0].code === "file-invalid-type"
              ? "Geçersiz dosya tipi"
              : fileRejections[0].errors[0].message}
          </p>
        </div>
      )}
    </div>
  )
}
