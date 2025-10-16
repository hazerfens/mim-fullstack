import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Simple UUID generator
function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companySlug = formData.get('companySlug') as string;
    const fileType = formData.get('fileType') as string; // 'logo' or 'logo2'

    if (!file || !companySlug || !fileType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

  // Debug: log incoming file details
  console.log('[upload] companySlug=', companySlug, 'fileType=', fileType, 'fileName=', file.name, 'size=', file.size);

  // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get file extension
    const extension = path.extname(file.name) || '.png';

    // Create unique filename
    const filename = `${fileType}_${generateId()}${extension}`;

    // Create directory structure: public/companies/{slug}/logos/
    const uploadDir = path.join(
      process.cwd(),
      'public',
      'companies',
      companySlug,
      'logos'
    );

    // Ensure directory exists
    await mkdir(uploadDir, { recursive: true });

    // Write file
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    // Return URL path
    const url = `/companies/${companySlug}/logos/${filename}`;

    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
