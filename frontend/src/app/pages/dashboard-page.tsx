import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCandidates } from '../contexts/candidates-context';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Upload, FileText, AlertCircle, CheckCircle, Download, Trash2 } from 'lucide-react';
import { downloadCSV } from '../utils/csv-export';
import stemLogo from '../../assets/b3d32faed1940d68631ddd16b33aceaa647d5928.png';
import { useAuth } from '../contexts/auth-context';
import { toast } from 'sonner';

export function DashboardPage() {
  const navigate = useNavigate();
  const { candidates, clearCandidates, deleteCandidates } = useCandidates();
  const { username, logout } = useAuth();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const needsReviewCount = candidates.filter(c => c.needs_review === 'YES').length;
  const readyCount = candidates.filter(c => c.needs_review === 'NO').length;
  const allSelected = useMemo(
    () => candidates.length > 0 && selectedIds.length === candidates.length,
    [candidates.length, selectedIds.length],
  );

  const handleExport = () => {
    downloadCSV(candidates, `stem-boomerang-candidates-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const toggleSelection = (candidateId: number, checked: boolean) => {
    setSelectedIds((prev) => (
      checked ? [...prev, candidateId] : prev.filter((id) => id !== candidateId)
    ));
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? candidates.map((candidate) => candidate.id) : []);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    try {
      await deleteCandidates(selectedIds);
      setSelectedIds([]);
      toast.success(`${selectedIds.length} candidate record${selectedIds.length === 1 ? '' : 's'} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete candidates');
    }
  };

  return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={stemLogo}
                  alt="STEM Boomerang New Mexico"
                  className="h-10 w-auto"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-gray-500 sm:inline">Signed in as {username}</span>
                <Button onClick={() => navigate('/upload')} size="lg">
                  <Upload className="mr-2 h-5 w-5" />
                  Upload Resume
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

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
                <FileText className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{candidates.length}</div>
                <p className="text-xs text-gray-500 mt-1">Resumes processed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ready for Review</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{readyCount}</div>
                <p className="text-xs text-gray-500 mt-1">No issues detected</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{needsReviewCount}</div>
                <p className="text-xs text-gray-500 mt-1">Flagged for attention</p>
              </CardContent>
            </Card>
          </div>

          {/* Candidates Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Extracted Candidates</CardTitle>
                  <CardDescription>Review and manage parsed resume data</CardDescription>
                </div>
                {candidates.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={handleDeleteSelected}
                        disabled={selectedIds.length === 0}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Selected
                      </Button>
                      <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                      <Button variant="outline" onClick={clearCandidates}>
                        Clear All
                      </Button>
                    </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {candidates.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No candidates yet</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by uploading a resume.</p>
                    <div className="mt-6">
                      <Button onClick={() => navigate('/upload')}>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Resume
                      </Button>
                    </div>
                  </div>
              ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              aria-label="Select all candidates"
                              checked={allSelected}
                              onChange={(event) => toggleSelectAll(event.target.checked)}
                              className="h-4 w-4 accent-[#1B7D87]"
                            />
                          </TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>School</TableHead>
                          <TableHead>Current Role</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {candidates.map(candidate => (
                            <TableRow key={candidate.id}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${candidate.full_name || candidate.email || `candidate ${candidate.id}`}`}
                                  checked={selectedIds.includes(candidate.id)}
                                  onChange={(event) => toggleSelection(candidate.id, event.target.checked)}
                                  className="h-4 w-4 accent-[#1B7D87]"
                                />
                              </TableCell>
                              <TableCell>
                                {candidate.needs_review === 'YES' ? (
                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                      <AlertCircle className="mr-1 h-3 w-3" />
                                      Review
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      <CheckCircle className="mr-1 h-3 w-3" />
                                      Ready
                                    </Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{candidate.full_name || '—'}</TableCell>
                              <TableCell>{candidate.email || '—'}</TableCell>
                              <TableCell>{candidate.location_display || '—'}</TableCell>
                              <TableCell>{candidate.school || '—'}</TableCell>
                              <TableCell>{candidate.current_job_title || '—'}</TableCell>
                              <TableCell>
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
                              </TableCell>
                              <TableCell>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/review/${candidate.id}`)}
                                >
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
  );
}
