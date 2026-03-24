import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCandidates } from '../contexts/candidates-context';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ArrowLeft, Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { extractCandidateData } from '../utils/llm-extraction';
import { CandidateRecord } from '../types/candidate';
import { extractTextFromPDF, isPDF } from '../utils/pdf-extractor';
import { toast } from 'sonner';

// ---- PDF fallback (works in Vite/WebStorm) ----
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfjsWorker;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function extractTextFromPdfFallback(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .filter(Boolean);

    fullText += strings.join(' ') + '\n';
  }

  return fullText.trim();
}

export function UploadPage() {
  const navigate = useNavigate();
  const { addCandidate } = useCandidates();

  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sourceLink, setSourceLink] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const parseJsonList = (value: string | null | undefined): string[] | null => {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const toNumber = (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizeFileType = (value: string | null | undefined): "PDF" | "DOCX" | "TXT" | null => {
    if (!value) return null;
    const lower = value.toLowerCase();
    if (lower === 'pdf') return 'PDF';
    if (lower === 'docx') return 'DOCX';
    if (lower === 'txt') return 'TXT';
    return null;
  };

  const uploadToBackend = async (file: File): Promise<CandidateRecord> => {
    const formData = new FormData();
    formData.append('file', file);
    if (sourceLink.trim()) {
      formData.append('resume_source_link', sourceLink.trim());
    }

    const response = await fetch(`${API_BASE_URL}/resumes/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let detail = 'Backend upload failed';
      try {
        const errorData = await response.json();
        if (typeof errorData?.detail === 'string') {
          detail = errorData.detail;
        }
      } catch {
        // Keep the fallback message if the error body is not JSON.
      }
      throw new Error(detail);
    }

    const data = await response.json();
    const candidate = data.candidate;

    return {
      ...candidate,
      flag_reasons: candidate.flag_reasons?.split(',') || null,
      required_fields_missing: candidate.required_fields_missing?.split(',') || undefined,
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isDocx = file.name.toLowerCase().endsWith('.docx');
    if (isDocx) {
      setError('DOCX will be processed by the backend on submit. Preview is not available.');
    }

    setFileName(file.name);
    setUploadedFile(file);
    setError('');
    setIsExtracting(true);
    if (isDocx) {
      setResumeText('');
      setIsExtracting(false);
      return;
    }

    try {
      let text = '';

      // Check if it's a PDF
      if (isPDF(file)) {
        toast.info('Extracting text from PDF...');

        // Try your existing extractor first
        try {
          text = await extractTextFromPDF(file);
          toast.success('PDF text extracted successfully!');
        } catch (pdfError) {
          console.warn('Primary PDF extractor failed. Trying fallback...', pdfError);

          // Fallback: pdfjs-dist direct extraction
          try {
            text = await extractTextFromPdfFallback(file);
            toast.success('PDF text extracted successfully (fallback)!');
          } catch (fallbackError) {
            console.error('PDF extraction failed (fallback):', fallbackError);
            setError(
              'Preview extraction failed for this PDF. You can still submit the file to the backend, or paste the resume text manually. ' +
              'Tip: scanned/image-only PDFs may require OCR.'
            );
            toast.error('PDF preview extraction failed');
            setIsExtracting(false);
            return;
          }
        }
      } else {
        // For .txt files, read as text
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve(event.target?.result as string);
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
      }

      setResumeText(text);
    } catch (err) {
      console.error('File upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to read file. Please try again.');
      toast.error('Failed to extract text from file');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleProcess = async () => {
    if (!resumeText.trim()) {
      if (!uploadedFile) {
        setError('Please provide resume text or upload a file');
        return;
      }
    }

    setError('');
    setIsProcessing(true);
    setProgress(0);

    try {
      // Simulate progress
      setProgress(20);
      await new Promise(resolve => setTimeout(resolve, 300));

      setProgress(40);
      let candidate: CandidateRecord;
      if (uploadedFile) {
        candidate = await uploadToBackend(uploadedFile);
      } else {
        candidate = await extractCandidateData({
          text: resumeText,
          fileName: fileName || undefined,
          fileType: fileName.endsWith('.pdf') ? 'PDF' : fileName.endsWith('.docx') ? 'DOCX' : 'TXT',
          sourceLink: sourceLink || undefined,
        });
      }

      setProgress(80);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Add to candidates
      addCandidate(candidate);

      setProgress(100);

      toast.success('Resume processed successfully!');

      // Navigate to review page
      setTimeout(() => {
        navigate(`/review/${candidate.id}`);
      }, 500);

    } catch (err) {
      setError('Failed to process resume. Please try again.');
      toast.error('Processing failed');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadSampleResume = () => {
    const sample = `Jane Smith
Albuquerque, New Mexico
jane.smith@email.com | (505) 555-1234
linkedin.com/in/janesmith | github.com/janesmith

PROFESSIONAL SUMMARY
Experienced software engineer with 4 years of experience in full-stack web development, specializing in React, TypeScript, and Python. Passionate about creating accessible and performant web applications.

EDUCATION
Bachelor of Science in Computer Science
New Mexico State University, Las Cruces, NM
Graduated: May 2020

EXPERIENCE
Software Engineer
Tech Innovations Inc., Albuquerque, NM
June 2020 - Present
• Developed and maintained web applications using React and TypeScript
• Collaborated with cross-functional teams to deliver features on time
• Implemented automated testing strategies improving code coverage by 40%

TECHNICAL SKILLS
Languages: JavaScript, TypeScript, Python, HTML, CSS
Frameworks: React, Node.js, Express, Django
Tools: Git, Docker, AWS, CI/CD

CERTIFICATIONS
AWS Certified Developer - Associate (2022)`;

    setResumeText(sample);
    setFileName('jane_smith_resume.txt');
    setSourceLink('https://drive.google.com/sample-resume-link');
    toast.info('Sample resume loaded');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Upload Resume</h1>
              <p className="text-gray-600 mt-1">Extract candidate information from resume</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Resume Input</CardTitle>
            <CardDescription>
              Upload a resume file or paste the text below. The system will extract structured candidate data using LLM-based parsing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="file-upload">Upload File (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="file-upload"
                  type="file"
                  accept=".txt,.pdf,.docx"
                  onChange={handleFileUpload}
                  disabled={isProcessing || isExtracting}
                />
                <Button
                  variant="outline"
                  onClick={loadSampleResume}
                  disabled={isProcessing || isExtracting}
                >
                  Load Sample
                </Button>
              </div>
              {isExtracting && (
                <p className="text-sm text-blue-600 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extracting text from PDF...
                </p>
              )}
              {fileName && !isExtracting && (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {fileName}
                </p>
              )}
            </div>

            {/* Source Link */}
            <div className="space-y-2">
              <Label htmlFor="source-link">Google Drive Source Link (Optional)</Label>
              <Input
                id="source-link"
                type="url"
                placeholder="https://drive.google.com/..."
                value={sourceLink}
                onChange={(e) => setSourceLink(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            {/* Resume Text */}
            <div className="space-y-2">
              <Label htmlFor="resume-text">Resume Text</Label>
              <Textarea
                id="resume-text"
                placeholder="Paste resume text here..."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                disabled={isProcessing}
                rows={15}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500">
                {resumeText.length} characters
              </p>
            </div>

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Progress */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Processing resume...</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleProcess}
                disabled={isProcessing || (!uploadedFile && !resumeText.trim())}
                size="lg"
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Process Resume
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                disabled={isProcessing}
                size="lg"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
              <li>Resume text is converted to Markdown format for better structure</li>
              <li>LLM extracts structured data matching the field definitions</li>
              <li>Data is normalized (locations, emails, URLs)</li>
              <li>Heuristic validation checks data quality</li>
              <li>Records are flagged if required fields are missing or confidence is low</li>
              <li>Results are ready for review and CSV export</li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
