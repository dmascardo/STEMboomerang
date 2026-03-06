import { CandidateRecord } from '../types/candidate';

/**
 * Converts candidate records to CSV format
 */
export function exportToCSV(records: CandidateRecord[]): string {
  if (records.length === 0) return '';
  
  // Define column order matching the spec
  const columns = [
    // Required Fields
    'full_name',
    'email',
    'phone',
    'linkedin_url',
    'city',
    'state',
    'location_display',
    'school',
    'degree',
    'terminal_degree_year',
    'current_job_title',
    
    // Optional Fields
    'skills',
    'professional_summary',
    'latest_company',
    'certifications',
    'portfolio_url',
    'github_url',
    
    // Academic Fields
    'academic_title',
    'research_area',
    'publications_summary',
    'awards_summary',
    
    // Career Level
    'years_experience_overall',
    'years_experience_in_field',
    'career_level_overall',
    'career_level_confidence',
    'career_level_reason',
    
    // Metadata
    'resume_file_name',
    'resume_file_type',
    'resume_text_quality',
    
    // Quality Indicators
    'extraction_confidence',
    'fields_found_count',
    'required_fields_found_count',
    'required_fields_missing',
    
    // Flagging
    'needs_review',
    'review_reason',
    'flag_reasons',
    
    // System
    'id',
    'resume_source_link',
    'extracted_at',
  ];
  
  // Create header row
  const header = columns.join(',');
  
  // Create data rows
  const rows = records.map(record => {
    return columns.map(col => {
      const value = record[col as keyof CandidateRecord];
      
      // Handle arrays
      if (Array.isArray(value)) {
        return `"${value.join('; ')}"`;
      }
      
      // Handle strings with commas or quotes
      if (typeof value === 'string') {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }
      
      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }
      
      return String(value);
    }).join(',');
  });
  
  return [header, ...rows].join('\n');
}

/**
 * Downloads CSV file
 */
export function downloadCSV(records: CandidateRecord[], filename: string = 'candidates.csv') {
  const csv = exportToCSV(records);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
