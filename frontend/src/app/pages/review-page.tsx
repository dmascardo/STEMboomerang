import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, AlertCircle, CheckCircle, Download, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useCandidates } from '../contexts/candidates-context';
import { useAuth } from '../contexts/auth-context';
import { CandidateRecord } from '../types/candidate';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { downloadCSV } from '../utils/csv-export';

export function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getCandidate, updateCandidate } = useCandidates();
  const { logout } = useAuth();
  const [draft, setDraft] = useState<Partial<CandidateRecord> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const candidate = id ? getCandidate(Number(id)) : undefined;

  useEffect(() => {
    if (candidate) {
      setDraft(candidate);
    }
  }, [candidate]);

  if (!candidate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Candidate Not Found</CardTitle>
            <CardDescription>The requested candidate record does not exist.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const form = draft ?? candidate;

  const handleExport = () => {
    downloadCSV([candidate], `candidate-${candidate.id}.csv`);
  };

  const handleDraftChange = <K extends keyof CandidateRecord>(field: K, value: CandidateRecord[K]) => {
    setDraft((prev) => ({
      ...(prev ?? candidate),
      [field]: value,
    }));
  };

  const parseOptionalNumber = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleSave = async () => {
    if (!draft) return;

    setIsSaving(true);
    try {
      await updateCandidate(candidate.id, draft);
      toast.success('Candidate details saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save candidate details');
    } finally {
      setIsSaving(false);
    }
  };

  const createdAtLabel = new Date(candidate.created_at).toLocaleString();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {form.full_name || 'Unnamed Candidate'}
                </h1>
                <p className="text-gray-600 mt-1">Candidate Record Details</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => {
                logout();
                navigate('/login');
              }}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {candidate.needs_review === 'YES' && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-orange-900">Manual Review Required</h3>
                  <p className="text-sm text-orange-700 mt-1">{candidate.review_reason}</p>
                  {candidate.flag_reasons && candidate.flag_reasons.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {candidate.flag_reasons.map((reason, idx) => (
                        <li key={idx} className="text-sm text-orange-700">• {reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {candidate.needs_review === 'NO' && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-900">Ready for Processing</h3>
                  <p className="text-sm text-green-700 mt-1">All required fields extracted successfully</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="core" className="space-y-6">
          <TabsList>
            <TabsTrigger value="core">Core Information</TabsTrigger>
            <TabsTrigger value="optional">Optional Fields</TabsTrigger>
            <TabsTrigger value="career">Career Analysis</TabsTrigger>
            <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="core" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Required Fields</CardTitle>
                <CardDescription>Core candidate information for intake</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FieldDisplay label="Full Name" value={form.full_name} required onChange={(value) => handleDraftChange('full_name', value)} />
                  <FieldDisplay label="Email" value={form.email} required onChange={(value) => handleDraftChange('email', value)} />
                  <FieldDisplay label="Phone" value={form.phone} required onChange={(value) => handleDraftChange('phone', value)} />
                  <FieldDisplay label="LinkedIn URL" value={form.linkedin_url} required onChange={(value) => handleDraftChange('linkedin_url', value)} />
                  <FieldDisplay label="City" value={form.city} required onChange={(value) => handleDraftChange('city', value)} />
                  <FieldDisplay label="State" value={form.state} required onChange={(value) => handleDraftChange('state', value)} />
                  <FieldDisplay label="Location Display" value={form.location_display} readOnly />
                  <FieldDisplay label="School" value={form.school} required onChange={(value) => handleDraftChange('school', value)} />
                  <FieldDisplay label="Degree" value={form.degree} required onChange={(value) => handleDraftChange('degree', value)} />
                  <FieldDisplay label="Graduation Year" value={form.terminal_degree_year} required onChange={(value) => handleDraftChange('terminal_degree_year', value)} />
                  <FieldDisplay label="Current Job Title" value={form.current_job_title} required onChange={(value) => handleDraftChange('current_job_title', value)} />
                  <FieldDisplay label="Latest Company" value={form.latest_company} onChange={(value) => handleDraftChange('latest_company', value)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="optional" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Professional Information</CardTitle>
                <CardDescription>Additional candidate details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <FieldDisplay label="Professional Summary" value={form.professional_summary} fullWidth multiline onChange={(value) => handleDraftChange('professional_summary', value)} />
                  <FieldDisplay label="Skills" value={form.skills} fullWidth multiline onChange={(value) => handleDraftChange('skills', value)} />
                  <FieldDisplay label="Certifications" value={form.certifications} fullWidth multiline onChange={(value) => handleDraftChange('certifications', value)} />

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FieldDisplay label="Portfolio URL" value={form.portfolio_url} onChange={(value) => handleDraftChange('portfolio_url', value)} />
                    <FieldDisplay label="GitHub URL" value={form.github_url} onChange={(value) => handleDraftChange('github_url', value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Academic & Research Context</CardTitle>
                <CardDescription>For academic and research candidates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FieldDisplay label="Academic Title" value={form.academic_title} onChange={(value) => handleDraftChange('academic_title', value)} />
                    <FieldDisplay label="Research Area" value={form.research_area} onChange={(value) => handleDraftChange('research_area', value)} />
                  </div>
                  <FieldDisplay label="Publications Summary" value={form.publications_summary} fullWidth multiline onChange={(value) => handleDraftChange('publications_summary', value)} />
                  <FieldDisplay label="Awards Summary" value={form.awards_summary} fullWidth multiline onChange={(value) => handleDraftChange('awards_summary', value)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="career" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Career Level Analysis</CardTitle>
                <CardDescription>Derived career insights based on experience and title</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FieldDisplay label="Overall Career Level" value={form.career_level_overall} onChange={(value) => handleDraftChange('career_level_overall', value)} />
                    <FieldDisplay label="Confidence" value={form.career_level_confidence} onChange={(value) => handleDraftChange('career_level_confidence', value)} />
                    <FieldDisplay
                      label="Years Experience"
                      value={form.years_experience_overall?.toString()}
                      onChange={(value) => handleDraftChange('years_experience_overall', parseOptionalNumber(value))}
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FieldDisplay label="Title Seniority Signal" value={form.title_seniority_signal} onChange={(value) => handleDraftChange('title_seniority_signal', value)} />
                    <FieldDisplay label="Education Stage Signal" value={form.education_stage_signal} onChange={(value) => handleDraftChange('education_stage_signal', value)} />
                    <FieldDisplay
                      label="Years in Field"
                      value={form.years_experience_in_field?.toString()}
                      onChange={(value) => handleDraftChange('years_experience_in_field', parseOptionalNumber(value))}
                    />
                    <FieldDisplay label="Target Field Level" value={form.career_level_target_field} onChange={(value) => handleDraftChange('career_level_target_field', value)} />
                  </div>

                  <FieldDisplay label="Analysis Reason" value={form.career_level_reason} fullWidth multiline onChange={(value) => handleDraftChange('career_level_reason', value)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Extraction Quality Metrics</CardTitle>
                <CardDescription>Confidence indicators and data quality assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <MetricDisplay label="Parsed Characters" value={candidate.parsed_char_count?.toLocaleString()} />
                    <MetricDisplay label="LLM Input Characters" value={candidate.llm_input_char_count?.toLocaleString()} />
                    <MetricDisplay label="Fields Found" value={candidate.fields_found_count} />
                    <MetricDisplay label="Required Fields" value={`${candidate.required_fields_found_count} / 10`} />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <MetricDisplay label="Extraction Confidence" value={candidate.extraction_confidence} />
                    <MetricDisplay label="Resume Text Quality" value={candidate.resume_text_quality} />
                    <MetricDisplay label="Review Status" value={candidate.needs_review === 'YES' ? 'Needs Review' : 'Ready'} />
                  </div>

                  <Separator />

                  {candidate.required_fields_missing && candidate.required_fields_missing.length > 0 && (
                    <div>
                      <Label>Missing Required Fields</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {candidate.required_fields_missing.map((field, idx) => (
                          <Badge key={idx} variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FieldDisplay label="Resume File Name" value={candidate.resume_file_name} readOnly />
                    <FieldDisplay label="File Type" value={candidate.resume_file_type} readOnly />
                    <FieldDisplay label="Source Link" value={form.resume_source_link} onChange={(value) => handleDraftChange('resume_source_link', value)} />
                    <FieldDisplay label="Extracted At" value={createdAtLabel} readOnly />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function FieldDisplay({
  label,
  value,
  required = false,
  fullWidth = false,
  readOnly = false,
  multiline = false,
  onChange,
}: {
  label: string;
  value: string | number | null | undefined;
  required?: boolean;
  fullWidth?: boolean;
  readOnly?: boolean;
  multiline?: boolean;
  onChange?: (value: string) => void;
}) {
  const displayValue = value ?? '';
  const isEmpty = !String(displayValue).trim();

  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <Label className="flex items-center gap-2">
        {label}
        {required && isEmpty && (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
            Missing
          </Badge>
        )}
      </Label>
      <div className="mt-2">
        {readOnly || !onChange ? (
          <p className={`text-sm ${isEmpty ? 'text-gray-400' : 'text-gray-900'}`}>
            {String(displayValue || '—')}
          </p>
        ) : multiline ? (
          <Textarea
            aria-label={label}
            placeholder={`Enter ${label.toLowerCase()}`}
            value={String(displayValue)}
            onChange={(event) => onChange(event.target.value)}
            rows={4}
          />
        ) : (
          <Input
            aria-label={label}
            placeholder={`Enter ${label.toLowerCase()}`}
            value={String(displayValue)}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </div>
    </div>
  );
}

function MetricDisplay({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <Label className="text-xs text-gray-500">{label}</Label>
      <div className="mt-1 text-2xl font-bold text-gray-900">
        {value || '—'}
      </div>
    </div>
  );
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-sm font-medium text-gray-700 ${className}`}>{children}</div>;
}
