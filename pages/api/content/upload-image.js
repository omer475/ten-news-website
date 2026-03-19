import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: { bodyParser: false }
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10MB max

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const file = files.image?.[0] || files.image;
    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const fileData = fs.readFileSync(file.filepath);
    const ext = file.originalFilename?.split('.').pop() || 'jpg';
    const fileName = `ugc/${uuidv4()}.${ext}`;

    const { data, error } = await supabase.storage
      .from('user-content')
      .upload(fileName, fileData, {
        contentType: file.mimetype || 'image/jpeg',
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', error);
      return res.status(500).json({ error: 'Failed to upload image' });
    }

    const { data: publicUrl } = supabase.storage
      .from('user-content')
      .getPublicUrl(fileName);

    return res.status(200).json({ url: publicUrl.publicUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
