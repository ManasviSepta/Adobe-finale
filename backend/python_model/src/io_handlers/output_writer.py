# src/io_handlers/output_writer.py (Correct Code)

import json
from pathlib import Path
from typing import Dict, Any

class OutputWriter:
    """
    Handles writing the final output JSON to the specified directory.
    """

    def __init__(self, output_dir: Path):
        """
        Initializes the writer with the target directory where the output will be saved.

        Args:
            output_dir (Path): The Path object pointing to the collection directory.
        """
        self.output_dir = output_dir
        self.output_filename = "challenge1b_output.json"

    def write(self, data: Dict[str, Any]):
        """
        Writes the final data dictionary to the 'challenge1b_output.json' file
        in the specified directory.

        Args:
            data (Dict[str, Any]): The final dictionary to be written as JSON.
        """
        output_path = self.output_dir / self.output_filename

        try:
            # Open the file in write mode with UTF-8 encoding
            with open(output_path, 'w', encoding='utf-8') as f:
                # Dump the data to the file with an indent for readability
                json.dump(data, f, indent=4)
        except Exception as e:
            # Basic error handling in case the file can't be written
            print(f"Error: Could not write output to file at {output_path}.")
            print(f"Reason: {e}")
