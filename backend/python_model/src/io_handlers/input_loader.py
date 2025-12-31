# src/io_handlers/input_loader.py (DEFINITIVE CORRECTED VERSION)

import json
from pathlib import Path
from typing import Dict, List, Tuple, Any

class InputLoader:
    def __init__(self, collection_dir: Any):
        self.collection_dir = Path(collection_dir)
        self.inputs_path = self.collection_dir / "inputs"

    def parse(self) -> Tuple[Dict[str, Any], List[Path]]:
        if not self.inputs_path.is_dir():
            raise FileNotFoundError(
                f"Required 'inputs' subfolder not found in '{self.collection_dir}'"
            )
            
        input_file_path = self.inputs_path / "challenge1b_input.json"
        if not input_file_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_file_path}")

        with open(input_file_path, 'r', encoding='utf-8') as f:
            raw_metadata = json.load(f)

        if "persona" in raw_metadata and "role" in raw_metadata["persona"]:
            persona_str = raw_metadata["persona"]["role"]
        else:
            raise KeyError("Could not find 'persona' -> 'role' in input JSON.")

        if "job_to_be_done" in raw_metadata and "task" in raw_metadata["job_to_be_done"]:
            job_str = raw_metadata["job_to_be_done"]["task"]
        else:
            raise KeyError("Could not find 'job_to_be_done' -> 'task' in input JSON.")

        if "documents" in raw_metadata:
            doc_filenames = [doc["filename"] for doc in raw_metadata["documents"]]
        else:
            raise KeyError("Could not find 'documents' key in input JSON.")

        # --- THE FIX ---
        # Look for PDFs directly inside the 'inputs' folder, not 'inputs/PDFs'.
        pdf_paths = [self.inputs_path / doc_name for doc_name in doc_filenames]
        # --- END OF FIX ---

        clean_metadata = {
            "persona": persona_str,
            "job_to_be_done": job_str,
            "document_collection": doc_filenames
        }

        return clean_metadata, pdf_paths
