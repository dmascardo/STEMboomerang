import { CandidateRecord, ResumeInput, STATE_CODES } from '../types/candidate';
import { normalizeLocation, normalizeEmail, normalizeURL, normalizeName } from './normalization';
import { validateRecord, countFields } from './validation';
import OpenAI from 'openai';

/**
 * Heuristic extraction for highly reliable fields (email, phone)
 * These patterns are very accurate and don't need LLM interpretation
 */
function extractReliableFields(text: string): Partial<CandidateRecord> {
  const extracted: Partial<CandidateRecord> = {};
  
  // Email extraction - highly reliable pattern
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  extracted.email = emailMatch ? emailMatch[0] : null;
  
  // Phone extraction - highly reliable pattern
  const phoneMatch = text.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/);
  extracted.phone = phoneMatch ? phoneMatch[0] : null;
  
  // LinkedIn extraction - highly reliable pattern
  const linkedinMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9-]+/i);
  extracted.linkedin_url = linkedinMatch ? `https://${linkedinMatch[0]}` : null;
  
  // GitHub extraction - highly reliable pattern
  const githubMatch = text.match(/github\.com\/[a-zA-Z0-9-]+/i);
  extracted.github_url = githubMatch ? `https://${githubMatch[0]}` : null;
  
  return extracted;
}

function guessFullName(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerLines = lines.slice(0, 10);

  for (const line of headerLines) {
    if (/@|\d/.test(line)) continue;
    if (/^(education|experience|skills|projects|certifications|summary)\b/i.test(line)) continue;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 5) continue;
    const isAllCaps = line === line.toUpperCase();
    const isTitleCase = /^[A-Z][a-z]+/.test(line);
    if (isAllCaps || isTitleCase) {
      return line;
    }
  }

  const emailLineIndex = lines.findIndex(l => /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(l));
  if (emailLineIndex > 0) {
    const candidateLine = lines[emailLineIndex - 1].trim();
    if (candidateLine && !/[@\d]/.test(candidateLine) && candidateLine.length <= 120) {
      return candidateLine;
    }
  }

  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch && emailMatch.index !== undefined) {
    const beforeEmail = text.slice(0, emailMatch.index);
    const lastChunk = beforeEmail.split('\n').pop() || beforeEmail;
    const sanitized = lastChunk.split('|')[0].trim();
    const words = sanitized.split(/\s+/).filter(w => /^[A-Za-z'-]+$/.test(w));
    if (words.length >= 2) {
      const pick = words.slice(-5);
      const nameCandidate = pick.join(' ').trim();
      if (nameCandidate && nameCandidate.length <= 120) {
        return nameCandidate;
      }
    }
  }

  return null;
}

/**
 * LLM extraction with confidence scoring
 * Uses OpenAI GPT-4o-mini for accurate field extraction
 */
async function extractWithLLM(resumeText: string): Promise<{
  data: Partial<CandidateRecord>;
  extraction_confidence: 'High' | 'Medium' | 'Low';
  uncertain_fields: string[];
  review_reason: string | null;
}> {
  try {
    // Check if API key is configured
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      // Silently use heuristic extraction - no API key needed for testing
      return fallbackExtraction(resumeText);
    }
    
    console.log('🚀 Calling OpenAI API...');
    
    const client = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Only for prototype - in production use a backend
    });
    
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0, // Deterministic output
      messages: [
        {
          role: "system",
          content: `Extract resume fields as JSON. Return ONLY fields you find with high confidence. Use null for missing fields.

Required schema:
{
  "full_name": string or null,
  "city": string or null,
  "state": string (2-letter code like "NM", "CA") or null,
  "school": string or null,
  "degree": string (PhD/MS/BS/BA/MBA) or null,
  "terminal_degree_year": string (YYYY format) or null,
  "current_job_title": string or null,
  "latest_company": string or null,
  "skills": string (comma-separated) or null,
  "professional_summary": string (2-3 sentence summary) or null,
  "certifications": string or null,
  "portfolio_url": string or null,
  "academic_title": string (e.g., "Professor", "Research Scientist") or null,
  "research_area": string or null,
  "publications_summary": string or null,
  "awards_summary": string or null,
  "years_experience_overall": number or null,
  "years_experience_in_field": number or null,
  "title_seniority_signal": string ("Entry", "Mid", "Senior", "Lead", "Executive") or null,
  "education_stage_signal": string ("BS", "MS", "PhD") or null,
  "career_level_overall": string ("Student", "Early Career", "Mid Career", "Senior", "Expert") or null,
  "career_level_target_field": string or null,
  "career_level_confidence": string ("High", "Medium", "Low") or null,
  "career_level_reason": string or null,
  "extraction_confidence": "High" | "Medium" | "Low",
  "uncertain_fields": array of field names you're uncertain about,
  "review_reason": string explaining why manual review might be needed, or null
}

CRITICAL INSTRUCTIONS:
- Do NOT invent information. Return null if uncertain.
- Use null for any field you cannot find with confidence.
- For state, use 2-letter abbreviations (NM, CA, TX, etc.)
- For degree, use standard abbreviations (PhD, MS, BS, BA, MBA)
- extraction_confidence should be "High" if most fields are clear, "Medium" if some ambiguity, "Low" if many fields unclear
- uncertain_fields should list any fields you're not confident about
- review_reason should explain concerns like "Missing contact information" or "Ambiguous work history" or null if no issues`
        },
        {
          role: "user",
          content: resumeText
        }
      ]
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    console.log('✅ OpenAI API success! Confidence:', result.extraction_confidence);
    
    return {
      data: result,
      extraction_confidence: result.extraction_confidence || 'Medium',
      uncertain_fields: result.uncertain_fields || [],
      review_reason: result.review_reason || null
    };
    
  } catch (error) {
    console.error('❌ LLM extraction failed:', error);
    return fallbackExtraction(resumeText);
  }
}

/**
 * Fallback to regex-based extraction if LLM fails
 */
function fallbackExtraction(text: string): {
  data: Partial<CandidateRecord>;
  extraction_confidence: 'High' | 'Medium' | 'Low';
  uncertain_fields: string[];
  review_reason: string | null;
} {
  const extracted: Partial<CandidateRecord> = {};
  const uncertainFields: string[] = [];
  const stateNamesPattern = Object.keys(STATE_CODES)
    .map(name => name.replace(/\s+/g, '\\s+'))
    .join('|');
  
  // Name extraction (improved heuristic)
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length > 0) {
    // Try first few lines for name
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      let line = lines[i].trim();
      if (line.includes('|')) {
        line = line.split('|')[0].trim();
      }
      const words = line.split(/\s+/).filter(Boolean);
      // Name is usually 2-4 words, starts with capital, no special chars
      if (words.length >= 2 && words.length <= 5 && !/[@\d]/.test(line)) {
        const isAllCaps = line === line.toUpperCase();
        const isTitleCase = /^[A-Z][a-z]+/.test(line);
        if (isAllCaps || isTitleCase) {
          extracted.full_name = line;
          break;
        }
        if (line.includes(',')) {
          const parts = line.split(',').map(p => p.trim()).filter(Boolean);
          if (parts.length === 2) {
            extracted.full_name = `${parts[1]} ${parts[0]}`.trim();
            break;
          }
        }
      }
    }
    if (!extracted.full_name) {
      uncertainFields.push('full_name');
    }
  }
  if (!extracted.full_name) {
    const emailLineIndex = lines.findIndex(l => /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(l));
    if (emailLineIndex > 0) {
      const candidateLine = lines[emailLineIndex - 1].trim();
      if (candidateLine && !/[@\d]/.test(candidateLine) && candidateLine.length <= 120) {
        extracted.full_name = candidateLine;
        const nameIndex = uncertainFields.indexOf('full_name');
        if (nameIndex >= 0) uncertainFields.splice(nameIndex, 1);
      }
    }
  }
  if (!extracted.full_name) {
    for (const line of lines.slice(0, 8)) {
      const candidateLine = line.trim();
      if (!candidateLine || /[@\d]/.test(candidateLine) || candidateLine.length > 120) {
        continue;
      }
      const words = candidateLine.split(/\s+/).filter(Boolean);
      if (words.length >= 2 && words.length <= 5) {
        const isAllCaps = candidateLine === candidateLine.toUpperCase();
        const isTitleCase = /^[A-Z][a-z]+/.test(candidateLine);
        if (isAllCaps || isTitleCase) {
          extracted.full_name = candidateLine;
          const nameIndex = uncertainFields.indexOf('full_name');
          if (nameIndex >= 0) uncertainFields.splice(nameIndex, 1);
          break;
        }
      }
    }
  }
  
  // Email (already handled by heuristics)
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  extracted.email = emailMatch ? emailMatch[0] : null;
  
  // Phone (already handled by heuristics)
  const phoneMatch = text.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/);
  extracted.phone = phoneMatch ? phoneMatch[0] : null;
  
  // LinkedIn
  const linkedinMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9-]+/i);
  extracted.linkedin_url = linkedinMatch ? `https://${linkedinMatch[0]}` : null;
  
  // GitHub
  const githubMatch = text.match(/github\.com\/[a-zA-Z0-9-]+/i);
  extracted.github_url = githubMatch ? `https://${githubMatch[0]}` : null;
  
  // Education - improved patterns
  const degreePatterns = [
    /Ph\.?D\.?(?:\s+in\s+[A-Za-z\s]+)?/i,
    /Doctor\s+of\s+Philosophy(?:\s+in\s+[A-Za-z\s]+)?/i,
    /M\.?S\.?(?:\s+in\s+[A-Za-z\s]+)?/i,
    /Master\s+of\s+Science(?:\s+in\s+[A-Za-z\s]+)?/i,
    /MBA/i,
    /B\.?S\.?(?:\s+in\s+[A-Za-z\s]+)?/i,
    /Bachelor\s+of\s+Science(?:\s+in\s+[A-Za-z\s]+)?/i,
    /B\.?A\.?(?:\s+in\s+[A-Za-z\s]+)?/i,
    /Bachelor\s+of\s+Arts(?:\s+in\s+[A-Za-z\s]+)?/i
  ];
  
  for (const pattern of degreePatterns) {
    const match = text.match(pattern);
    if (match) {
      let degree = match[0];
      // Normalize to standard format
      if (/ph\.?d|doctor/i.test(degree)) degree = 'PhD';
      else if (/m\.?s\.?|master.*science/i.test(degree)) degree = 'MS';
      else if (/mba/i.test(degree)) degree = 'MBA';
      else if (/b\.?s\.?|bachelor.*science/i.test(degree)) degree = 'BS';
      else if (/b\.?a\.?|bachelor.*arts/i.test(degree)) degree = 'BA';
      extracted.degree = degree;
      extracted.education_stage_signal = degree;
      break;
    }
  }
  if (!extracted.degree) uncertainFields.push('degree');
  
  // School name - look for common university patterns
  const schoolPatterns = [
    /(?:University\s+of\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /(?:[A-Z][a-z]+\s+(?:University|College|Institute))/,
    /(?:[A-Z][a-z]+\s+State\s+University)/,
    /(MIT|Stanford|Harvard|Yale|Princeton|Caltech|Berkeley|UCLA)/
  ];
  
  for (const pattern of schoolPatterns) {
    const match = text.match(pattern);
    if (match) {
      extracted.school = match[0];
      break;
    }
  }
  if (!extracted.school) uncertainFields.push('school');
  
  // Year extraction - look for graduation year (usually recent 4-digit years)
  const yearMatches = text.match(/\b(19\d{2}|20\d{2})\b/g);
  if (yearMatches && yearMatches.length > 0) {
    // Take the most recent year that's not in the future
    const currentYear = new Date().getFullYear();
    const validYears = yearMatches
      .map(y => parseInt(y))
      .filter(y => y <= currentYear && y >= currentYear - 50)
      .sort((a, b) => b - a);
    if (validYears.length > 0) {
      extracted.terminal_degree_year = validYears[0].toString();
    }
  }
  if (!extracted.terminal_degree_year) uncertainFields.push('terminal_degree_year');
  
  // City and state patterns - improved
  const locationPatterns = [
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})\b/,
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s+([A-Z]{2})\b/,
    new RegExp(`([A-Z][a-z]+(?:\\s[A-Z][a-z]+)*),\\s*(${stateNamesPattern})\\b`, 'i'),
    new RegExp(`([A-Z][a-z]+(?:\\s[A-Z][a-z]+)*)\\s+[\\-•]\\s*(${stateNamesPattern})\\b`, 'i'),
    new RegExp(`([A-Z][a-z]+(?:\\s[A-Z][a-z]+)*)\\s+(${stateNamesPattern})\\b`, 'i'),
  ];
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      extracted.city = match[1].replace(/[-•]/g, '').trim();
      extracted.state = match[2].length === 2 ? match[2].toUpperCase() : match[2].toLowerCase();
      break;
    }
  }
  if (!extracted.city || !extracted.state) {
    for (const line of lines) {
      const match = line.match(new RegExp(`(.+?)\\s+(${stateNamesPattern})\\b`, 'i'));
      if (match) {
        const cityCandidate = match[1].replace(/[-•]/g, '').trim();
        if (cityCandidate.length >= 2 && !/university|college|institute/i.test(cityCandidate)) {
          extracted.city = extracted.city || cityCandidate;
          extracted.state = extracted.state || match[2].toLowerCase();
          break;
        }
      }
    }
  }
  if (!extracted.city) uncertainFields.push('city');
  if (!extracted.state) uncertainFields.push('state');
  
  // Job title - look for common title patterns
  const titlePatterns = [
    /(Senior|Lead|Principal|Staff|Junior)?\s*(Software|Data|Machine Learning|Research|Product)\s*(Engineer|Scientist|Analyst|Manager|Developer)/i,
    /(Professor|Assistant Professor|Associate Professor|Research Scientist|Postdoctoral|PhD Student|Graduate Student)/i,
    /(Director|VP|Manager|Coordinator|Specialist)\s+of\s+[A-Za-z\s]+/i
  ];
  
  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match) {
      extracted.current_job_title = match[0];
      break;
    }
  }
  if (!extracted.current_job_title) uncertainFields.push('current_job_title');
  
  // Skills - improved extraction
  const techSkills = [
    'Python', 'JavaScript', 'TypeScript', 'Java', 'C\\+\\+', 'C#', 'Ruby', 'Go', 'Rust', 'Swift',
    'React', 'Angular', 'Vue', 'Node\\.js', 'Django', 'Flask', 'Spring', 'Express',
    'Machine Learning', 'Deep Learning', 'AI', 'NLP', 'Computer Vision',
    'Data Analysis', 'Data Science', 'Statistics', 'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'CI/CD',
    'TensorFlow', 'PyTorch', 'scikit-learn', 'Pandas', 'NumPy'
  ];
  
  const foundSkills = new Set<string>();
  const skillsRegex = new RegExp(`\\b(${techSkills.join('|')})\\b`, 'gi');
  const skillMatches = text.match(skillsRegex);
  if (skillMatches) {
    skillMatches.forEach(skill => foundSkills.add(skill));
    extracted.skills = Array.from(foundSkills).join(', ');
  }
  if (!extracted.skills) uncertainFields.push('skills');
  
  // Years of experience
  const expMatch = text.match(/(\d+)\+?\s*years?\s*(?:of)?\s*experience/i);
  if (expMatch) {
    extracted.years_experience_overall = parseInt(expMatch[1]);
  }
  
  // Determine extraction confidence
  const foundFieldsCount = Object.keys(extracted).filter(k => extracted[k as keyof typeof extracted] !== null).length;
  let confidence: 'High' | 'Medium' | 'Low';
  
  if (foundFieldsCount >= 8) confidence = 'Medium'; // Pretty good extraction
  else if (foundFieldsCount >= 5) confidence = 'Low';
  else confidence = 'Low';
  
  return {
    data: extracted,
    extraction_confidence: confidence,
    uncertain_fields: uncertainFields,
    review_reason: confidence === 'Low' 
      ? 'LLM API unavailable - using heuristic extraction. Manual review recommended for accuracy.'
      : null
  };
}

/**
 * Converts plain text resume to markdown format
 */
function convertToMarkdown(text: string): string {
  const sections = [
    'education', 'experience', 'work experience', 'employment',
    'skills', 'technical skills', 'publications', 'research',
    'awards', 'certifications', 'summary', 'objective'
  ];
  
  let markdown = text;
  
  sections.forEach(section => {
    const regex = new RegExp(`^(${section})\\s*:?\\s*$`, 'gim');
    markdown = markdown.replace(regex, `## ${section.charAt(0).toUpperCase() + section.slice(1)}`);
  });
  
  return markdown;
}

/**
 * Main extraction function
 * Hybrid approach: Heuristics for reliable fields, LLM for complex extraction
 */
export async function extractCandidateData(input: ResumeInput): Promise<CandidateRecord> {
  const { text, fileName, fileType, sourceLink } = input;
  
  // Step 1: Extract highly reliable fields with heuristics (email, phone, URLs)
  const heuristicData = extractReliableFields(text);
  
  // Step 2: Convert to Markdown for better LLM parsing
  const markdown = convertToMarkdown(text);
  
  // Step 3: Track character counts
  const parsedCharCount = text.length;
  const llmInputCharCount = markdown.length;
  
  // Step 4: Use LLM for complex field extraction
  const llmResult = await extractWithLLM(markdown);
  
  // Step 5: Merge heuristic and LLM data (heuristics take precedence for reliable fields)
  const mergedData = {
    ...llmResult.data,
    email: heuristicData.email || llmResult.data.email,
    phone: heuristicData.phone || llmResult.data.phone,
    linkedin_url: heuristicData.linkedin_url || llmResult.data.linkedin_url,
    github_url: heuristicData.github_url || llmResult.data.github_url,
  };
  if (!mergedData.full_name) {
    mergedData.full_name = guessFullName(text);
  }
  
  // Step 6: Apply normalization
  const locationData = normalizeLocation(mergedData.city, mergedData.state);
  const normalizedEmail = normalizeEmail(mergedData.email);
  const normalizedLinkedIn = normalizeURL(mergedData.linkedin_url);
  const normalizedGitHub = normalizeURL(mergedData.github_url);
  const normalizedPortfolio = normalizeURL(mergedData.portfolio_url);
  const normalizedName = normalizeName(mergedData.full_name);
  
  // Step 7: Assess text quality
  const textQuality: "High" | "Medium" | "Low" = 
    parsedCharCount > 2000 ? "High" :
    parsedCharCount > 500 ? "Medium" : "Low";
  
  // Step 8: Count fields
  const { totalFields, requiredFields } = countFields(mergedData);
  
  // Step 9: Create preliminary record
  const preliminaryRecord: Partial<CandidateRecord> = {
    ...mergedData,
    full_name: normalizedName,
    email: normalizedEmail,
    linkedin_url: normalizedLinkedIn,
    github_url: normalizedGitHub,
    portfolio_url: normalizedPortfolio,
    ...locationData,
    resume_source_link: sourceLink || null,
    resume_file_name: fileName || null,
    resume_file_type: fileType || null,
    resume_text_quality: textQuality,
    parsed_char_count: parsedCharCount,
    llm_input_char_count: llmInputCharCount,
    fields_found_count: totalFields,
    required_fields_found_count: requiredFields,
    extraction_confidence: llmResult.extraction_confidence,
  };
  
  // Step 10: Validate and flag
  const validation = validateRecord(preliminaryRecord);
  
  // Step 11: Determine final review status
  // Combine LLM review reason with validation flags
  let finalReviewReason = llmResult.review_reason;
  if (validation.needsReview && validation.flagDetails) {
    finalReviewReason = finalReviewReason 
      ? `${finalReviewReason}; ${validation.flagDetails}`
      : validation.flagDetails;
  }
  
  const needsReview = validation.needsReview || 
                     llmResult.extraction_confidence === 'Low' || 
                     llmResult.uncertain_fields.length > 3;
  
  // Step 12: Create final record
  const finalRecord: CandidateRecord = {
    id: generateId(),
    full_name: preliminaryRecord.full_name || null,
    email: preliminaryRecord.email || null,
    phone: preliminaryRecord.phone || null,
    linkedin_url: preliminaryRecord.linkedin_url || null,
    city: preliminaryRecord.city || null,
    state: preliminaryRecord.state || null,
    school: preliminaryRecord.school || null,
    degree: preliminaryRecord.degree || null,
    terminal_degree_year: preliminaryRecord.terminal_degree_year || null,
    current_job_title: preliminaryRecord.current_job_title || null,
    resume_source_link: preliminaryRecord.resume_source_link || null,
    needs_review: needsReview ? "YES" : "NO",
    review_reason: finalReviewReason,
    skills: preliminaryRecord.skills || null,
    professional_summary: preliminaryRecord.professional_summary || null,
    latest_company: preliminaryRecord.latest_company || null,
    certifications: preliminaryRecord.certifications || null,
    portfolio_url: preliminaryRecord.portfolio_url || null,
    github_url: preliminaryRecord.github_url || null,
    academic_title: preliminaryRecord.academic_title || null,
    research_area: preliminaryRecord.research_area || null,
    publications_summary: preliminaryRecord.publications_summary || null,
    awards_summary: preliminaryRecord.awards_summary || null,
    years_experience_overall: preliminaryRecord.years_experience_overall || null,
    years_experience_in_field: preliminaryRecord.years_experience_in_field || null,
    title_seniority_signal: preliminaryRecord.title_seniority_signal || null,
    education_stage_signal: preliminaryRecord.education_stage_signal || null,
    career_level_overall: preliminaryRecord.career_level_overall || null,
    career_level_target_field: preliminaryRecord.career_level_target_field || null,
    career_level_confidence: preliminaryRecord.career_level_confidence || null,
    career_level_reason: preliminaryRecord.career_level_reason || null,
    resume_file_name: preliminaryRecord.resume_file_name || null,
    resume_file_type: preliminaryRecord.resume_file_type || null,
    resume_page_count: preliminaryRecord.resume_page_count || null,
    resume_text_quality: preliminaryRecord.resume_text_quality || null,
    parsed_char_count: preliminaryRecord.parsed_char_count || null,
    llm_input_char_count: preliminaryRecord.llm_input_char_count || null,
    fields_found_count: preliminaryRecord.fields_found_count || null,
    required_fields_found_count: preliminaryRecord.required_fields_found_count || null,
    required_fields_missing: validation.missingRequired,
    extraction_confidence: preliminaryRecord.extraction_confidence || null,
    flag_reasons: validation.flagReasons,
    flag_details: validation.flagDetails,
    state_full: preliminaryRecord.state_full || null,
    location_display: preliminaryRecord.location_display || null,
    extracted_at: new Date().toISOString(),
  };
  
  return finalRecord;
}

function generateId(): string {
  return `cand_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
