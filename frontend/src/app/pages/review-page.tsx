import { useParams, useNavigate } from 'react-router';
import { useCandidates } from '../contexts/candidates-context';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { ArrowLeft, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { downloadCSV } from '../utils/csv-export';
import { Input } from '../components/ui/input';

export function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getCandidate, updateCandidate } = useCandidates();

  const candidate = id ? getCandidate(Number(id)) : undefined;

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

  const handleExport = () => {
    downloadCSV([candidate], `candidate-${candidate.id}.csv`);
  };

  const parseOptionalNumber = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {candidate.full_name || 'Unnamed Candidate'}
                </h1>
                <p className="text-gray-600 mt-1">Candidate Record Details</p>
              </div>
            </div>
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Banner */}
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

          {/* Core Information Tab */}
          <TabsContent value="core" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Required Fields</CardTitle>
                <CardDescription>Core candidate information for intake</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FieldDisplay
                    label="Full Name"
                    value={candidate.full_name}
                    required
                    fieldKey="full_name"
                    onUpdate={(value) => updateCandidate(candidate.id, { full_name: value })}
                  />
                  <FieldDisplay
                    label="Email"
                    value={candidate.email}
                    required
                    fieldKey="email"
                    onUpdate={(value) => updateCandidate(candidate.id, { email: value })}
                  />
                  <FieldDisplay
                    label="Phone"
                    value={candidate.phone}
                    required
                    fieldKey="phone"
                    onUpdate={(value) => updateCandidate(candidate.id, { phone: value })}
                  />
                  <FieldDisplay
                    label="LinkedIn URL"
                    value={candidate.linkedin_url}
                    required
                    fieldKey="linkedin_url"
                    onUpdate={(value) => updateCandidate(candidate.id, { linkedin_url: value })}
                  />
                  <FieldDisplay
                    label="City"
                    value={candidate.city}
                    required
                    fieldKey="city"
                    onUpdate={(value) => updateCandidate(candidate.id, { city: value })}
                  />
                  <FieldDisplay
                    label="State"
                    value={candidate.state}
                    required
                    fieldKey="state"
                    onUpdate={(value) => updateCandidate(candidate.id, { state: value })}
                  />
                  <FieldDisplay label="Location Display" value={candidate.location_display} />
                  <FieldDisplay
                    label="School"
                    value={candidate.school}
                    required
                    fieldKey="school"
                    onUpdate={(value) => updateCandidate(candidate.id, { school: value })}
                  />
                  <FieldDisplay
                    label="Degree"
                    value={candidate.degree}
                    required
                    fieldKey="degree"
                    onUpdate={(value) => updateCandidate(candidate.id, { degree: value })}
                  />
                  <FieldDisplay
                    label="Graduation Year"
                    value={candidate.terminal_degree_year}
                    required
                    fieldKey="terminal_degree_year"
                    onUpdate={(value) => updateCandidate(candidate.id, { terminal_degree_year: value })}
                  />
                  <FieldDisplay
                    label="Current Job Title"
                    value={candidate.current_job_title}
                    required
                    fieldKey="current_job_title"
                    onUpdate={(value) => updateCandidate(candidate.id, { current_job_title: value })}
                  />
                  <FieldDisplay
                    label="Latest Company"
                    value={candidate.latest_company}
                    fieldKey="latest_company"
                    onUpdate={(value) => updateCandidate(candidate.id, { latest_company: value })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Optional Fields Tab */}
          <TabsContent value="optional" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Professional Information</CardTitle>
                <CardDescription>Additional candidate details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <FieldDisplay
                    label="Professional Summary"
                    value={candidate.professional_summary}
                    fullWidth
                    fieldKey="professional_summary"
                    onUpdate={(value) => updateCandidate(candidate.id, { professional_summary: value })}
                  />
                  <FieldDisplay
                    label="Skills"
                    value={candidate.skills}
                    fullWidth
                    fieldKey="skills"
                    onUpdate={(value) => updateCandidate(candidate.id, { skills: value })}
                  />
                  <FieldDisplay
                    label="Certifications"
                    value={candidate.certifications}
                    fullWidth
                    fieldKey="certifications"
                    onUpdate={(value) => updateCandidate(candidate.id, { certifications: value })}
                  />

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FieldDisplay
                      label="Portfolio URL"
                      value={candidate.portfolio_url}
                      fieldKey="portfolio_url"
                      onUpdate={(value) => updateCandidate(candidate.id, { portfolio_url: value })}
                    />
                    <FieldDisplay
                      label="GitHub URL"
                      value={candidate.github_url}
                      fieldKey="github_url"
                      onUpdate={(value) => updateCandidate(candidate.id, { github_url: value })}
                    />
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
                    <FieldDisplay
                      label="Academic Title"
                      value={candidate.academic_title}
                      fieldKey="academic_title"
                      onUpdate={(value) => updateCandidate(candidate.id, { academic_title: value })}
                    />
                    <FieldDisplay
                      label="Research Area"
                      value={candidate.research_area}
                      fieldKey="research_area"
                      onUpdate={(value) => updateCandidate(candidate.id, { research_area: value })}
                    />
                  </div>
                  <FieldDisplay
                    label="Publications Summary"
                    value={candidate.publications_summary}
                    fullWidth
                    fieldKey="publications_summary"
                    onUpdate={(value) => updateCandidate(candidate.id, { publications_summary: value })}
                  />
                  <FieldDisplay
                    label="Awards Summary"
                    value={candidate.awards_summary}
                    fullWidth
                    fieldKey="awards_summary"
                    onUpdate={(value) => updateCandidate(candidate.id, { awards_summary: value })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Career Analysis Tab */}
          <TabsContent value="career" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Career Level Analysis</CardTitle>
                <CardDescription>Derived career insights based on experience and title</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label>Overall Career Level</Label>
                      {!candidate.career_level_overall && (
                        <div className="mt-2">
                          <Input
                            aria-label="Overall Career Level"
                            placeholder="Enter overall career level"
                            onBlur={(event) => {
                              const next = event.target.value.trim();
                              if (!next) return;
                              updateCandidate(candidate.id, { career_level_overall: next as any });
                              event.target.value = '';
                            }}
                          />
                        </div>
                      )}
                      <div className="mt-2">
                        {candidate.career_level_overall ? (
                          <Badge variant="outline" className="text-base">
                            {candidate.career_level_overall}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>Confidence</Label>
                      {!candidate.career_level_confidence && (
                        <div className="mt-2">
                          <Input
                            aria-label="Career Level Confidence"
                            placeholder="Enter confidence"
                            onBlur={(event) => {
                              const next = event.target.value.trim();
                              if (!next) return;
                              updateCandidate(candidate.id, { career_level_confidence: next as any });
                              event.target.value = '';
                            }}
                          />
                        </div>
                      )}
                      <div className="mt-2">
                        {candidate.career_level_confidence ? (
                          <Badge
                            variant="outline"
                            className={
                              candidate.career_level_confidence === 'High'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : candidate.career_level_confidence === 'Medium'
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                            }
                          >
                            {candidate.career_level_confidence}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>Years Experience</Label>
                      {!candidate.years_experience_overall && (
                        <div className="mt-2">
                          <Input
                            aria-label="Years Experience"
                            placeholder="Enter years"
                            onBlur={(event) => {
                              const parsed = parseOptionalNumber(event.target.value);
                              if (parsed === null) return;
                              updateCandidate(candidate.id, { years_experience_overall: parsed });
                              event.target.value = '';
                            }}
                          />
                        </div>
                      )}
                      <div className="mt-2 text-base">
                        {candidate.years_experience_overall || '—'}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FieldDisplay
                      label="Title Seniority Signal"
                      value={candidate.title_seniority_signal}
                      onUpdate={(value) => updateCandidate(candidate.id, { title_seniority_signal: value })}
                    />
                    <FieldDisplay
                      label="Education Stage Signal"
                      value={candidate.education_stage_signal}
                      onUpdate={(value) => updateCandidate(candidate.id, { education_stage_signal: value })}
                    />
                    <FieldDisplay
                      label="Years in Field"
                      value={candidate.years_experience_in_field?.toString()}
                      onUpdate={(value) => {
                        const parsed = parseOptionalNumber(value);
                        if (parsed !== null) {
                          updateCandidate(candidate.id, { years_experience_in_field: parsed });
                        }
                      }}
                    />
                    <FieldDisplay
                      label="Target Field Level"
                      value={candidate.career_level_target_field}
                      onUpdate={(value) => updateCandidate(candidate.id, { career_level_target_field: value })}
                    />
                  </div>

                  <FieldDisplay
                    label="Analysis Reason"
                    value={candidate.career_level_reason}
                    fullWidth
                    onUpdate={(value) => updateCandidate(candidate.id, { career_level_reason: value })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quality Metrics Tab */}
          <TabsContent value="quality" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Extraction Quality Metrics</CardTitle>
                <CardDescription>Confidence indicators and data quality assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <MetricDisplay
                      label="Parsed Characters"
                      value={candidate.parsed_char_count?.toLocaleString()}
                    />
                    <MetricDisplay
                      label="LLM Input Characters"
                      value={candidate.llm_input_char_count?.toLocaleString()}
                    />
                    <MetricDisplay
                      label="Fields Found"
                      value={candidate.fields_found_count}
                    />
                    <MetricDisplay
                      label="Required Fields"
                      value={`${candidate.required_fields_found_count} / 10`}
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label>Extraction Confidence</Label>
                      <div className="mt-2">
                        {candidate.extraction_confidence ? (
                          <Badge
                            variant="outline"
                            className={
                              candidate.extraction_confidence === 'High'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : candidate.extraction_confidence === 'Medium'
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                            }
                          >
                            {candidate.extraction_confidence}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>Resume Text Quality</Label>
                      <div className="mt-2">
                        {candidate.resume_text_quality ? (
                          <Badge
                            variant="outline"
                            className={
                              candidate.resume_text_quality === 'High'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : candidate.resume_text_quality === 'Medium'
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                            }
                          >
                            {candidate.resume_text_quality}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>Review Status</Label>
                      <div className="mt-2">
                        <Badge
                          variant="outline"
                          className={
                            candidate.needs_review === 'YES'
                              ? 'bg-orange-50 text-orange-700 border-orange-200'
                              : 'bg-green-50 text-green-700 border-green-200'
                          }
                        >
                          {candidate.needs_review === 'YES' ? 'Needs Review' : 'Ready'}
                        </Badge>
                      </div>
                    </div>
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
                    <FieldDisplay label="Resume File Name" value={candidate.resume_file_name} />
                    <FieldDisplay label="File Type" value={candidate.resume_file_type} />
                    <FieldDisplay
                      label="Source Link"
                      value={candidate.resume_source_link}
                      fieldKey="resume_source_link"
                      onUpdate={(value) => updateCandidate(candidate.id, { resume_source_link: value })}
                    />
                    <FieldDisplay label="Extracted At" value={new Date(candidate.extracted_at).toLocaleString()} />
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
  onUpdate,
}: {
  label: string;
  value: string | number | null | undefined;
  required?: boolean;
  fullWidth?: boolean;
  fieldKey?: string;
  onUpdate?: (value: string) => void;
}) {
  const displayValue = value || '—';
  const isEmpty = !value;

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
      <div className={`mt-2 ${isEmpty ? 'text-gray-400' : 'text-gray-900'}`}>
        {isEmpty && onUpdate ? (
          <Input
            aria-label={label}
            placeholder={`Enter ${label.toLowerCase()}`}
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (next) {
                onUpdate(next);
                event.target.value = '';
              }
            }}
          />
        ) : (
          <p className="text-sm">{displayValue}</p>
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
