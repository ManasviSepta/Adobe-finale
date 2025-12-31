# src/document_analyzer/section_extractor.py (FIXED PAGE NUMBER VERSION)

from typing import List, Dict
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from keybert import KeyBERT
from collections import defaultdict
import pdfplumber
import re

class SectionExtractor:
    # --- THE FIX #1: More aggressive penalty to guarantee diversity ---
    DIVERSITY_PENALTY = 0.60 

    def __init__(self, model: SentenceTransformer):
        self.model = model
        self.kw_model = KeyBERT(model=self.model)

    def _extract_dynamic_themes(self, text: str, top_n: int = 3) -> Dict[str, float]:
        keywords = self.kw_model.extract_keywords(
            text, keyphrase_ngram_range=(1, 4), stop_words='english',
            use_mmr=True, diversity=0.7, top_n=top_n
        )
        return {kw: score for kw, score in keywords} if keywords else {}

    def _extract_sections_with_real_pages(self, pdf_path: str) -> List[Dict]:
        """
        Extract sections from PDF with accurate page numbers.
        This replaces whatever chunking logic was assigning page_number = 1 to everything.
        """
        sections = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, start=1):
                    text = page.extract_text()
                    if not text or len(text.strip()) < 50:
                        continue
                    
                    # Split page text into logical sections
                    page_sections = self._split_into_sections(text, page_num)
                    sections.extend(page_sections)
                    
        except Exception as e:
            print(f"Error extracting from PDF {pdf_path}: {e}")
            return []
            
        return sections

    def _split_into_sections(self, page_text: str, page_num: int) -> List[Dict]:
        """
        Split a page's text into logical sections with proper titles.
        """
        sections = []
        
        # Common section header patterns
        header_patterns = [
            r'^[A-Z][A-Z\s&-]{2,50}:?\s*$',  # ALL CAPS headers
            r'^\d+\.?\s+[A-Z][A-Za-z\s&-]{5,50}:?\s*$',  # Numbered headers
            r'^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*:?\s*$',  # Title Case headers
            r'^\*\*[A-Za-z\s&-]+\*\*\s*$',  # Bold markdown headers
        ]
        
        lines = page_text.split('\n')
        current_section = {"title": f"Page {page_num} Content", "content": "", "start_line": 0}
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
                
            # Check if this line looks like a section header
            is_header = False
            for pattern in header_patterns:
                if re.match(pattern, line):
                    is_header = True
                    break
            
            if is_header and current_section["content"].strip():
                # Save the previous section
                if len(current_section["content"].split()) >= 10:
                    sections.append({
                        "section_title": current_section["title"],
                        "content": current_section["content"].strip(),
                        "page_number": page_num,  # ✅ REAL PAGE NUMBER
                        "source_file": None,  # Will be set later
                        "start_line": current_section["start_line"],
                        "end_line": i
                    })
                
                # Start new section
                current_section = {
                    "title": line.rstrip(':'),
                    "content": "",
                    "start_line": i
                }
            else:
                # Add to current section content
                current_section["content"] += line + " "
        
        # Don't forget the last section
        if current_section["content"].strip() and len(current_section["content"].split()) >= 10:
            sections.append({
                "section_title": current_section["title"],
                "content": current_section["content"].strip(),
                "page_number": page_num,  # ✅ REAL PAGE NUMBER
                "source_file": None,
                "start_line": current_section["start_line"],
                "end_line": len(lines)
            })
        
        return sections

    def process_pdf_with_real_pages(self, pdf_path: str) -> List[Dict]:
        """
        Main method to extract sections with accurate page numbers.
        Call this instead of your old chunking method.
        """
        sections = self._extract_sections_with_real_pages(pdf_path)
        
        # Add filename to each section
        filename = pdf_path.split('/')[-1]
        for section in sections:
            section["source_file"] = filename
            
        return sections

    def get_sections_with_content(self, docs: List[Dict], req: Dict, k: int) -> List[Dict]:
        """
        Original method unchanged - just now receives sections with correct page numbers
        """
        job_text = req['combined_text']
        query_embedding = req['embedding']
        
        dynamic_themes = self._extract_dynamic_themes(job_text)
        theme_embeddings = {theme: self.model.encode(theme) for theme in dynamic_themes.keys()}

        all_sections = []
        for doc in docs:
            for section in doc.get("sections", []):
                # --- THE FIX #2: Hard filter to reject any title that is clearly a placeholder ---
                if ".pdf" in section["section_title"]:
                    continue # Immediately skip this section

                section_text = f"{section['section_title']}. {section['content'][:500]}"
                if len(section_text.split()) < 10: 
                    continue
                
                section_embedding = self.model.encode(section_text)
                overall_relevance_score = cosine_similarity([section_embedding], [query_embedding])[0][0]
                thematic_score = 0.0
                if dynamic_themes:
                    theme_scores = [
                        cosine_similarity([section_embedding], [theme_emb])[0][0] * theme_weight
                        for theme, theme_emb in theme_embeddings.items()
                        for theme_text, theme_weight in dynamic_themes.items() if theme == theme_text
                    ]
                    thematic_score = np.mean(theme_scores) if theme_scores else 0.0
                
                final_score = (overall_relevance_score * 0.4) + (thematic_score * 0.6)
                all_sections.append({
                    **section, 
                    "document": doc["filename"], 
                    "final_score": final_score
                })

        # The iterative diversity ranker remains the same, but will now be more effective
        # due to the higher penalty and cleaner input data.
        if not all_sections:
            return []

        final_results = []
        candidates = sorted(all_sections, key=lambda s: s["final_score"], reverse=True)
        seen_titles = set()
        
        while len(final_results) < k and candidates:
            best_candidate = None
            best_score = -1.0
            
            doc_counts = defaultdict(int)
            for res in final_results:
                doc_counts[res["document"]] += 1

            for candidate in candidates:
                if candidate["section_title"] in seen_titles:
                    continue
                
                doc_name = candidate["document"]
                penalty = 1.0 - (doc_counts[doc_name] * self.DIVERSITY_PENALTY)
                penalized_score = candidate["final_score"] * penalty
                
                if penalized_score > best_score:
                    best_score = penalized_score
                    best_candidate = candidate
            
            if best_candidate:
                final_results.append(best_candidate)
                seen_titles.add(best_candidate["section_title"])
                candidates.remove(best_candidate)
            else:
                break
                
        return final_results