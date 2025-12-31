# src/document_analyzer/subsection_analyzer.py (UPGRADED WITH CONTEXT WINDOW)

from nltk.tokenize import sent_tokenize
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import nltk
from typing import Dict, List

try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)

class SubsectionAnalyzer:
    def __init__(self, model: SentenceTransformer):
        self.model = model

    def analyze_subsections(self, sections: List[Dict], req_model: Dict) -> List[Dict]:
        summary_outputs = []
        if not sections: return []
        
        query_embedding = req_model["embedding"]
        for section in sections:
            content = section["content"]
            sents = [s.strip() for s in sent_tokenize(content) if len(s.strip().split()) > 4]

            if len(sents) < 3:
                # If section is too short, just return the whole content
                refined_text = content
            else:
                sentence_embeddings = self.model.encode(sents)
                sim_scores = cosine_similarity(sentence_embeddings, [query_embedding]).flatten()
                
                # --- NEW: Context Window Summarization ---
                best_sent_idx = np.argmax(sim_scores)
                
                # Define a window around the best sentence
                start_idx = max(0, best_sent_idx - 1)
                end_idx = min(len(sents), best_sent_idx + 2) # Grab best sentence and the next one
                
                # Join the sentences in the window to form a coherent paragraph
                refined_text = " ".join(sents[start_idx:end_idx])
            
            summary_outputs.append({
                "document": section["document"],
                "refined_text": refined_text,
                "page_number": section["page_number"]
            })
        return summary_outputs
