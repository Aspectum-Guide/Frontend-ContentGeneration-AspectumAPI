import { useState } from 'react';

export default function useCityImage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const setPreviewFromUrl = (url: string) => {
    setImagePreview(url);
  };

  const clear = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  return {
    imagePreview,
    imageFile,
    handleFileChange,
    setPreviewFromUrl,
    clear,
  };
}
