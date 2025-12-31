# src/document_analyzer/requirement_modeler.py

from sentence_transformers import SentenceTransformer
from typing import Dict

class RequirementModeler:
    """Models the user's request into a format the engine can use."""

    def __init__(self, model: SentenceTransformer):
        self.model = model

    def parse_persona_and_job(self, persona: str, job_to_be_done: str) -> Dict:
        """
        Combines persona and job into a single text and computes its embedding.
        
        Returns:
            A dictionary containing the combined text and its vector embedding.
        """
        combined_text = f"Persona: {persona}. Task: {job_to_be_done}"
        
        embedding = self.model.encode(combined_text, convert_to_tensor=False)

        return {
            "combined_text": combined_text,
            "embedding": embedding
        }

    def parse_job_to_be_done(self, job_to_be_done: str) -> Dict:
        """
        Processes only the job to be done and computes its embedding.
        
        Returns:
            A dictionary containing the job text and its vector embedding.
        """
        job_text = f"Task: {job_to_be_done}"
        
        embedding = self.model.encode(job_text, convert_to_tensor=False)

        return {
            "combined_text": job_text,
            "embedding": embedding
        }
