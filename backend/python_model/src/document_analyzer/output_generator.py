# src/document_analyzer/output_generator.py (Complete Code)
import time
from typing import Dict, List, Any

class OutputGenerator:
    def generate(self, metadata: Dict, extracted_sections: List[Dict], sub_section_analysis: List[Dict]) -> Dict[str, Any]:
        """
        Assembles the final output dictionary in the required JSON format.
        
        Args:
            metadata (Dict): The original metadata from the input JSON.
            extracted_sections (List[Dict]): The list of ranked sections.
            sub_section_analysis (List[Dict]): The list of refined text summaries.
            
        Returns:
            Dict[str, Any]: The final dictionary ready to be written to a JSON file.
        """
        return {
            "metadata": {
                "input_documents": metadata["document_collection"],
                "persona": metadata["persona"],
                "job_to_be_done": metadata["job_to_be_done"],
                "processing_timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            },
            "extracted_section": extracted_sections,
            "sub-section_analysis": sub_section_analysis
        }
