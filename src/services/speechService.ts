import { supabase } from '@/api/client';
import { inferAudioExtension } from '@/lib/audioFormat';

/**
 * Speech Service
 * Handles Text-to-Speech and Speech-to-Text via Supabase Edge Functions
 */

/**
 * Synthesize speech from text
 * @param text The text to convert to speech
 * @param voice The voice to use (shimmer, onyx, etc.)
 * @returns A promise that resolves to a URL for the audio blob
 */
export const synthesizeSpeech = async (text: string, voice: string = 'onyx'): Promise<string> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Using fetch directly is more reliable for binary data (Blobs) than supabase.functions.invoke
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ text, voice }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    if (blob.size === 0) throw new Error('Received empty audio blob');
    
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error synthesizing speech:', error);
    throw error;
  }
};

/**
 * Transcribe audio blob to text
 * @param audioBlob The audio blob to transcribe
 * @param language Optional language code (e.g., 'en', 'he')
 * @returns A promise that resolves to the transcribed text
 */
export const transcribeAudio = async (audioBlob: Blob, language?: string): Promise<string> => {
  try {
    if (audioBlob.size === 0) {
      throw new Error('Recording is empty');
    }

    const ext = await inferAudioExtension(audioBlob);
    const { data: { session } } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${ext}`);
    if (language) {
      formData.append('language', language);
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speech-to-text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data.text ?? '';
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
};
