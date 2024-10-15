import React, { useState, useCallback } from 'react';
import { Upload, FileType, Loader2, AlertCircle, Globe } from 'lucide-react';
import Dropzone from 'react-dropzone';
import { createWorker } from 'tesseract.js';
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface FileWithPreview extends File {
  preview: string;
}

const SUPPORTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/tiff': ['.tiff', '.tif'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg']
};

const LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'chi_tra', name: 'Chinese (Traditional)' }
];

function App() {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('eng');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(
      acceptedFiles.map((file) =>
        Object.assign(file, {
          preview: URL.createObjectURL(file),
        })
      )
    );
    setError(null);
  }, []);

  const processImage = async (worker: Tesseract.Worker, file: File) => {
    const { data: { text } } = await worker.recognize(file);
    return text;
  };

  const processPDF = async (worker: Tesseract.Worker, file: File) => {
    const fileURL = URL.createObjectURL(file);
    const pdf = await pdfjs.getDocument(fileURL).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context!, viewport }).promise;
      const pageText = await worker.recognize(canvas.toDataURL('image/png'));
      text += `Page ${i}:\n${pageText.data.text}\n\n`;
    }
    URL.revokeObjectURL(fileURL);
    return text;
  };

  const processFiles = async () => {
    setIsProcessing(true);
    setProgress(0);
    setResults('');
    setError(null);

    const worker = await createWorker({
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setProgress(parseInt(m.progress.toString()) * 100);
        }
      },
    });

    try {
      await worker.loadLanguage(selectedLanguage);
      await worker.initialize(selectedLanguage);

      let combinedResult = '';

      for (const file of files) {
        try {
          let text;
          if (file.type === 'application/pdf') {
            text = await processPDF(worker, file);
          } else {
            text = await processImage(worker, file);
          }
          combinedResult += `File: ${file.name}\n\n${text}\n\n`;
        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
          combinedResult += `File: ${file.name}\n\nError: Unable to process this file. It may be corrupted or in an unsupported format.\n\n`;
        }
      }

      setResults(combinedResult);
    } catch (error) {
      console.error('OCR Error:', error);
      setError('An error occurred during OCR processing. Please try again with different files.');
    } finally {
      await worker.terminate();
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-8 text-center text-indigo-600">Local OCR File Upload</h1>
        
        <div className="mb-6">
          <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
            Select OCR Language
          </label>
          <div className="relative">
            <select
              id="language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-indigo-500"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <Globe className="h-5 w-5" />
            </div>
          </div>
        </div>

        <Dropzone onDrop={onDrop} accept={SUPPORTED_FILE_TYPES}>
          {({getRootProps, getInputProps}) => (
            <div {...getRootProps()} className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 transition duration-300">
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">Drag 'n' drop some files here, or click to select files</p>
              <p className="text-xs text-gray-500">(PDF, TIFF, PNG, and JPEG files are accepted)</p>
            </div>
          )}
        </Dropzone>

        {error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Uploaded Files:</h2>
            <ul className="space-y-2">
              {files.map((file) => (
                <li key={file.name} className="flex items-center space-x-2">
                  <FileType className="h-5 w-5 text-indigo-500" />
                  <span>{file.name}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={processFiles}
              disabled={isProcessing}
              className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition duration-300 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="inline-block h-5 w-5 animate-spin mr-2" />
                  Processing... {progress.toFixed(0)}%
                </>
              ) : (
                'Process Files'
              )}
            </button>
          </div>
        )}

        {isProcessing && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}

        {results && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">OCR Results:</h2>
            <div className="bg-gray-100 p-4 rounded-md max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{results}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;