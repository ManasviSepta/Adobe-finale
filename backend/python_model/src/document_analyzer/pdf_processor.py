# src/document_analyzer/pdf_processor.py (DEFINITIVE KEYWORD-FREE VERSION)

import pdfplumber
import numpy as np
from typing import List, Dict

class PDFProcessor:
    # REMOVED: The SUBHEADING_KEYWORDS list has been completely removed to keep the processor general.

    def _get_median_font_size(self, page: pdfplumber.page.Page) -> float:
        sizes = [word.get('size', 0) for word in page.extract_words() if word.get('size')]
        if not sizes: return 10.0
        return np.median(sizes)

    def extract_text_with_structure(self, file_path: str) -> Dict:
        doc_filename = file_path.split('\\')[-1].split('/')[-1]
        doc_data = {"filename": doc_filename, "sections": []}
        try:
            with pdfplumber.open(file_path) as pdf:
                if not pdf.pages: return doc_data
                median_body_size = self._get_median_font_size(pdf.pages[0])
                title_size_threshold = median_body_size * 1.15
                current_section_title = None
                current_section_content = ""
                current_section_page = 1

                for page_num, page in enumerate(pdf.pages, 1):
                    lines = page.extract_text_lines(layout=True, strip=True)
                    for line in lines:
                        line_text = line['text'].strip()
                        if not line_text or not line['chars']: continue
                        if current_section_title is None:
                            current_section_title = line_text

                        # --- NEW: Simplified title heuristic relying only on structure ---
                        first_char = line['chars'][0]
                        font_name = first_char.get('fontname', '').lower()
                        font_size = first_char.get('size', 0)
                        
                        is_bold = 'bold' in font_name or 'black' in font_name
                        is_large_enough = font_size > title_size_threshold
                        is_short_line = 3 < len(line_text.split()) < 12  # Titles have a reasonable length
                        ends_with_punctuation = line_text.endswith('.') or line_text.endswith(',')

                        # The logic is now purely structural, with no keyword checks.
                        is_title = is_large_enough and is_bold and is_short_line and not ends_with_punctuation

                        if is_title:
                            if current_section_content.strip():
                                doc_data["sections"].append({ "section_title": current_section_title, "content": current_section_content.strip(), "page_number": current_section_page })
                            current_section_title = line_text
                            current_section_content = ""
                            current_section_page = page_num
                        else:
                            current_section_content += line_text + " "

                if current_section_content.strip():
                    doc_data["sections"].append({ "section_title": current_section_title, "content": current_section_content.strip(), "page_number": current_section_page })
        except Exception as e:
            print(f"❌ An unexpected error occurred while processing {file_path}: {e}")
            if not doc_data["sections"]:
                doc_data["sections"].append({"section_title": f"Error processing {doc_filename}", "content": str(e), "page_number": 1})
        return doc_data
