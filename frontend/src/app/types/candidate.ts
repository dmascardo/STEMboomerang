// Type definitions based on Field Definition Document

import { CandidateOut } from "../../client";

export interface CandidateRecord extends Omit<CandidateOut, 'flag_reasons' | 'required_fields_missing'> {
  flag_reasons: string[] | null;
  required_fields_missing?: string[] | null;
}
// {
//   // System ID
//   id: string;

//   // Required Fields - Core Candidate Record
//   full_name: string | null;
//   email: string | null;
//   phone: string | null;
//   linkedin_url: string | null;
//   city: string | null;
//   state: string | null;
//   school: string | null;
//   degree: string | null;
//   terminal_degree_year: string | null;
//   current_job_title: string | null;
//   resume_source_link: string | null;
//   needs_review: "YES" | "NO";
//   review_reason: string | null;

//   // Optional Fields
//   skills: string | null;
//   professional_summary: string | null;
//   latest_company: string | null;
//   certifications: string | null;
//   portfolio_url: string | null;
//   github_url: string | null;

//   // Academic & Research Context Fields (Optional)
//   academic_title: string | null;
//   research_area: string | null;
//   publications_summary: string | null;
//   awards_summary: string | null;

//   // Derived Fields: Career Level
//   years_experience_overall: number | null;
//   years_experience_in_field: number | null;
//   title_seniority_signal: string | null;
//   education_stage_signal: string | null;
//   career_level_overall: "Student" | "Early Career" | "Mid Career" | "Senior" | null;
//   career_level_target_field: string | null;
//   career_level_confidence: "High" | "Medium" | "Low" | null;
//   career_level_reason: string | null;

//   // Resume Metadata Fields
//   resume_file_name: string | null;
//   resume_file_type: "PDF" | "DOCX" | "TXT" | null;
//   resume_page_count: number | null;
//   resume_text_quality: "High" | "Medium" | "Low" | null;

//   // Data Quality & Confidence Indicators
//   parsed_char_count: number | null;
//   llm_input_char_count: number | null;
//   fields_found_count: number | null;
//   required_fields_found_count: number | null;
//   required_fields_missing: string[] | null;
//   extraction_confidence: "High" | "Medium" | "Low" | null;
//   flag_reasons: string[] | null;
//   flag_details: string | null;

//   // Additional normalized location fields
//   state_full: string | null;
//   location_display: string | null;

//   // Timestamp
//   extracted_at: string;
// }

export interface ResumeInput {
  text: string;
  fileName?: string;
  fileType?: "PDF" | "DOCX" | "TXT";
  sourceLink?: string;
}

export const REQUIRED_FIELDS = [
  'full_name',
  'email',
  'phone',
  'linkedin_url',
  'city',
  'state',
  'school',
  'degree',
  'terminal_degree_year',
  'current_job_title',
] as const;

export const STATE_CODES: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
  "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
  "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
  "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC"
};
